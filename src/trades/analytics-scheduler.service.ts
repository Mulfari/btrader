import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { TradeAggregate } from './trade-aggregate.entity';
import { VolumeProfile } from './volume-profile.entity';
import { MarketSentiment } from './market-sentiment.entity';

@Injectable()
export class AnalyticsSchedulerService {
  private readonly logger = new Logger(AnalyticsSchedulerService.name);
  
  // Símbolos a procesar automáticamente
  private readonly SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'];
  
  // Timeframes para Volume Profile
  private readonly TIMEFRAMES = ['5m', '15m', '1h', '4h'] as const;

  // 🟢 Control de pausa
  private isPaused = false;

  constructor(
    private readonly advancedAnalyticsService: AdvancedAnalyticsService,
    private readonly schedulerRegistry: SchedulerRegistry,
    @InjectRepository(TradeAggregate)
    private tradeRepository: Repository<TradeAggregate>,
    @InjectRepository(VolumeProfile)
    private volumeProfileRepository: Repository<VolumeProfile>,
    @InjectRepository(MarketSentiment)
    private marketSentimentRepository: Repository<MarketSentiment>,
  ) {}

  // 🟢 Métodos de control
  pause() {
    this.isPaused = true;
    
    // Pausar la tarea cron principal
    try {
      const job = this.schedulerRegistry.getCronJob('generateAnalytics');
      job.stop();
      this.logger.warn('⏸️ Análisis automático PAUSADO');
    } catch (error) {
      this.logger.warn('⚠️ No se pudo pausar la tarea cron:', error.message);
    }
  }

  resume() {
    this.isPaused = false;
    
    // Reanudar la tarea cron principal
    try {
      const job = this.schedulerRegistry.getCronJob('generateAnalytics');
      job.start();
      this.logger.log('▶️ Análisis automático REANUDADO');
    } catch (error) {
      this.logger.warn('⚠️ No se pudo reanudar la tarea cron:', error.message);
    }
  }

  getSchedulerStatus() {
    return {
      isPaused: this.isPaused,
      isJobRunning: this.isJobRunning(),
      symbols: this.SYMBOLS,
      timeframes: this.TIMEFRAMES,
      nextRun: this.isPaused ? null : this.getNextRunTime()
    };
  }

  private isJobRunning(): boolean {
    try {
      const job = this.schedulerRegistry.getCronJob('generateAnalytics');
      return !this.isPaused; // Si no está pausado, el job está activo
    } catch (error) {
      return false;
    }
  }

  /**
   * 🎯 Tarea principal: Ejecutar cada 5 minutos
   */
  @Cron('0 */5 * * * *', {
    name: 'generateAnalytics',
    timeZone: 'UTC',
  })
  async generateAnalyticsEvery5Minutes() {
    // 🟢 No ejecutar si está pausado
    if (this.isPaused) {
      this.logger.debug('⏸️ Análisis pausado - saltando ejecución');
      return;
    }

    this.logger.log('🚀 Iniciando generación automática de análisis...');
    
    const startTime = Date.now();
    let processedSymbols = 0;
    let errors = 0;

    for (const symbol of this.SYMBOLS) {
      try {
        await this.processSymbol(symbol);
        processedSymbols++;
        this.logger.log(`✅ ${symbol} procesado exitosamente`);
      } catch (error) {
        errors++;
        this.logger.error(`❌ Error procesando ${symbol}:`, error.message);
      }
    }

    const duration = Date.now() - startTime;
    this.logger.log(
      `🎉 Análisis completado: ${processedSymbols}/${this.SYMBOLS.length} símbolos procesados ` +
      `en ${duration}ms (${errors} errores)`
    );
  }

  /**
   * 🎯 Procesar un símbolo específico
   */
  private async processSymbol(symbol: string) {
    const hasNewData = await this.hasNewDataSince(symbol, 5); // Últimos 5 minutos

    if (!hasNewData) {
      this.logger.debug(`⏭️ ${symbol}: Sin datos nuevos, saltando análisis`);
      return;
    }

    this.logger.log(`📊 ${symbol}: Generando análisis (datos nuevos detectados)`);

    // Generar análisis en paralelo para optimizar tiempo
    const promises = [
      this.generateFearGreedAnalysis(symbol),
      ...this.TIMEFRAMES.map(tf => this.generateVolumeProfileAnalysis(symbol, tf))
    ];

    await Promise.allSettled(promises);
  }

  /**
   * 😰 Generar Fear & Greed Index
   */
  private async generateFearGreedAnalysis(symbol: string) {
    try {
      // Verificar si ya existe análisis reciente (últimos 6 minutos)
      const recentSentiment = await this.marketSentimentRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' }
      });

      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      
      if (recentSentiment && recentSentiment.timestamp > sixMinutesAgo) {
        this.logger.debug(`⏭️ ${symbol}: Fear & Greed Index reciente existe, saltando`);
        return;
      }

      await this.advancedAnalyticsService.calculateFearGreedIndex(symbol);
      this.logger.log(`😰 ${symbol}: Fear & Greed Index generado`);
      
    } catch (error) {
      this.logger.warn(`⚠️ ${symbol}: Error generando Fear & Greed Index - ${error.message}`);
    }
  }

  /**
   * 📊 Generar Volume Profile
   */
  private async generateVolumeProfileAnalysis(symbol: string, timeframe: string) {
    try {
      // Verificar si ya existe análisis reciente para este timeframe
      const recentProfile = await this.volumeProfileRepository.findOne({
        where: { symbol, timeframe },
        order: { timestamp: 'DESC' }
      });

      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      
      if (recentProfile && recentProfile.timestamp > sixMinutesAgo) {
        this.logger.debug(`⏭️ ${symbol}-${timeframe}: Volume Profile reciente existe, saltando`);
        return;
      }

      await this.advancedAnalyticsService.generateVolumeProfile(
        symbol, 
        timeframe as any, 
        50 // Número estándar de niveles
      );
      
      this.logger.log(`📊 ${symbol}-${timeframe}: Volume Profile generado`);
      
    } catch (error) {
      this.logger.warn(`⚠️ ${symbol}-${timeframe}: Error generando Volume Profile - ${error.message}`);
    }
  }

  /**
   * 🔍 Verificar si hay datos nuevos
   */
  private async hasNewDataSince(symbol: string, minutes: number): Promise<boolean> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    const recentTradeCount = await this.tradeRepository.count({
      where: {
        symbol,
        timestamp: Between(since, new Date())
      }
    });

    return recentTradeCount > 0;
  }

  /**
   * 🧹 Limpieza semanal de datos antiguos (opcional)
   */
  @Cron('0 0 2 * * 0', { // Domingos a las 2 AM
    name: 'weeklyCleanup',
    timeZone: 'UTC',
  })
  async weeklyDataCleanup() {
    // 🟢 No ejecutar si está pausado
    if (this.isPaused) {
      this.logger.debug('⏸️ Limpieza pausada - saltando ejecución');
      return;
    }

    this.logger.log('🧹 Iniciando limpieza semanal de datos antiguos...');
    
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Mantener solo los últimos 30 días de Volume Profile
      const deletedVP = await this.volumeProfileRepository
        .createQueryBuilder()
        .delete()
        .where('timestamp < :thirtyDaysAgo', { thirtyDaysAgo })
        .execute();
      
      // Mantener solo los últimos 30 días de Market Sentiment
      const deletedMS = await this.marketSentimentRepository
        .createQueryBuilder()
        .delete()
        .where('timestamp < :thirtyDaysAgo', { thirtyDaysAgo })
        .execute();

      this.logger.log(
        `🧹 Limpieza completada: ${deletedVP.affected || 0} Volume Profiles y ` +
        `${deletedMS.affected || 0} Market Sentiments eliminados`
      );
      
    } catch (error) {
      this.logger.error('❌ Error en limpieza semanal:', error.message);
    }
  }

  /**
   * 📈 Ejecutar análisis manual (para testing)
   */
  async runManualAnalysis(symbol?: string, timeframe?: string) {
    this.logger.log(`🎯 Ejecutando análisis manual${symbol ? ` para ${symbol}` : ''}`);
    
    const symbolsToProcess = symbol ? [symbol] : this.SYMBOLS;
    
    for (const sym of symbolsToProcess) {
      await this.processSymbol(sym);
    }
    
    this.logger.log('✅ Análisis manual completado');
  }

  /**
   * 📊 Obtener estadísticas del scheduler
   */
  async getSchedulerStats() {
    const stats = {
      symbols: this.SYMBOLS,
      timeframes: this.TIMEFRAMES,
      nextRun: this.isPaused ? null : this.getNextRunTime(),
      status: this.isPaused ? 'paused' : 'active',
      isPaused: this.isPaused,
      isJobRunning: this.isJobRunning()
    };

    // Contar registros por símbolo
    const symbolStats = {};
    for (const symbol of this.SYMBOLS) {
      const vpCount = await this.volumeProfileRepository.count({ where: { symbol } });
      const msCount = await this.marketSentimentRepository.count({ where: { symbol } });
      
      symbolStats[symbol] = {
        volumeProfileRecords: vpCount,
        marketSentimentRecords: msCount
      };
    }

    return {
      ...stats,
      symbolStats
    };
  }

  /**
   * ⏰ Calcular próxima ejecución
   */
  private getNextRunTime(): Date {
    const now = new Date();
    const minutes = now.getMinutes();
    const nextFiveMinuteMark = Math.ceil(minutes / 5) * 5;
    
    const nextRun = new Date(now);
    nextRun.setMinutes(nextFiveMinuteMark, 0, 0);
    
    // Si es el mismo minuto, agregar 5 minutos
    if (nextRun <= now) {
      nextRun.setMinutes(nextRun.getMinutes() + 5);
    }
    
    return nextRun;
  }

  /**
   * 🎛️ Configurar símbolos dinámicamente
   */
  updateSymbols(symbols: string[]) {
    (this.SYMBOLS as any) = symbols;
    this.logger.log(`🔄 Símbolos actualizados: ${symbols.join(', ')}`);
  }
} 