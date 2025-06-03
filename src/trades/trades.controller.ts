import { Controller, Get, Param, Query, Post } from '@nestjs/common';
import { TradesService } from './trades.service';
import { BybitWebSocketService } from './bybit-websocket.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';
import { LongShortRatio } from './long-short-ratio.entity';
import { Liquidation } from './liquidation.entity';

@Controller('trades')
export class TradesController {
  constructor(
    private readonly tradesService: TradesService,
    private readonly bybitService: BybitWebSocketService,
    @InjectRepository(TradeAggregate)
    private readonly tradeRepository: Repository<TradeAggregate>,
    @InjectRepository(OrderbookSnapshot)
    private readonly orderbookRepository: Repository<OrderbookSnapshot>,
    @InjectRepository(OpenInterest)
    private readonly openInterestRepository: Repository<OpenInterest>,
    @InjectRepository(FundingRate)
    private readonly fundingRateRepository: Repository<FundingRate>,
    @InjectRepository(LongShortRatio)
    private readonly longShortRatioRepository: Repository<LongShortRatio>,
    @InjectRepository(Liquidation)
    private readonly liquidationRepository: Repository<Liquidation>,
  ) {}

  // Obtener datos actuales (acumulador en memoria)
  @Get(':symbol/current')
  async getCurrentData(@Param('symbol') symbol: string) {
    return this.tradesService.getCurrentData(symbol.toUpperCase());
  }

  // Obtener datos históricos por rango de fechas
  @Get(':symbol/history')
  async getHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h por defecto
    const toDate = to ? new Date(to) : new Date();
    const limitNum = limit ? parseInt(limit) : 1000;

    return this.tradesService.getHistory(symbol.toUpperCase(), fromDate, toDate, limitNum);
  }

  // Obtener datos de un día específico
  @Get(':symbol/day/:date')
  async getDayData(
    @Param('symbol') symbol: string,
    @Param('date') date: string,
  ) {
    const targetDate = new Date(date);
    return this.tradesService.getDayData(symbol.toUpperCase(), targetDate);
  }

  // Obtener resumen agregado (por minutos/horas)
  @Get(':symbol/summary')
  async getSummary(
    @Param('symbol') symbol: string,
    @Query('interval') interval: 'minute' | 'hour' = 'minute',
    @Query('duration') duration?: string,
  ) {
    const durationHours = duration ? parseInt(duration) : 24;
    return this.tradesService.getSummary(symbol.toUpperCase(), interval, durationHours);
  }

  // Obtener símbolos disponibles
  @Get('symbols')
  async getAvailableSymbols() {
    return this.tradesService.getAvailableSymbols();
  }

  // 🟢 Control de recolección de datos
  @Post('control/pause')
  async pauseDataCollection() {
    this.bybitService.pause();
    return { 
      message: '⏸️ Recolección de datos pausada exitosamente',
      status: 'paused',
      timestamp: new Date().toISOString()
    };
  }

  @Post('control/resume')
  async resumeDataCollection() {
    this.bybitService.resume();
    return { 
      message: '▶️ Recolección de datos reanudada exitosamente',
      status: 'active',
      timestamp: new Date().toISOString()
    };
  }

  @Get('control/status')
  async getCollectionStatus() {
    const status = this.bybitService.getStatus();
    return {
      ...status,
      message: status.isPaused ? 'Recolección pausada' : 'Recolección activa',
      timestamp: new Date().toISOString()
    };
  }

  // 🟢 Endpoints para Orderbook
  @Get(':symbol/orderbook/current')
  async getCurrentOrderbook(@Param('symbol') symbol: string) {
    const status = this.bybitService.getStatus();
    const orderbookData = status.orderbookData[symbol.toUpperCase()];
    
    if (!orderbookData) {
      return {
        symbol: symbol.toUpperCase(),
        bidPrice: 0,
        askPrice: 0,
        spread: 0,
        midPrice: 0,
        imbalance: 0.5,
        lastUpdate: new Date(),
        message: 'Sin datos de orderbook disponibles'
      };
    }

    return {
      symbol: symbol.toUpperCase(),
      ...orderbookData,
      timestamp: new Date().toISOString()
    };
  }

  @Get(':symbol/orderbook/history')
  async getOrderbookHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 60 * 60 * 1000); // 1h por defecto
    const toDate = to ? new Date(to) : new Date();
    const limitNum = limit ? parseInt(limit) : 1000;

    return this.tradesService.getOrderbookHistory(symbol.toUpperCase(), fromDate, toDate, limitNum);
  }

  @Get(':symbol/orderbook/spread-analysis')
  async getSpreadAnalysis(
    @Param('symbol') symbol: string,
    @Query('duration') duration?: string,
  ) {
    const durationMinutes = duration ? parseInt(duration) : 60; // 1 hora por defecto
    return this.tradesService.getSpreadAnalysis(symbol.toUpperCase(), durationMinutes);
  }

  // 🟢 Endpoints para Open Interest
  @Get(':symbol/open-interest/current')
  async getCurrentOpenInterest(@Param('symbol') symbol: string) {
    const status = this.bybitService.getStatus();
    const oiData = status.openInterestData[symbol.toUpperCase()];
    
    if (!oiData) {
      return {
        symbol: symbol.toUpperCase(),
        openInterest: 0,
        deltaOI: 0,
        price: 0,
        trend: 'neutral',
        message: 'Sin datos de Open Interest disponibles'
      };
    }

    const trend = oiData.deltaOI > 0 ? 'increasing' : oiData.deltaOI < 0 ? 'decreasing' : 'stable';
    
    return {
      symbol: symbol.toUpperCase(),
      ...oiData,
      trend,
      timestamp: new Date().toISOString()
    };
  }

  @Get(':symbol/open-interest/history')
  async getOpenInterestHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h por defecto
    const toDate = to ? new Date(to) : new Date();
    const limitNum = limit ? parseInt(limit) : 1000;

    return this.tradesService.getOpenInterestHistory(symbol.toUpperCase(), fromDate, toDate, limitNum);
  }

  @Get(':symbol/open-interest/analysis')
  async getOpenInterestAnalysis(
    @Param('symbol') symbol: string,
    @Query('duration') duration?: string,
  ) {
    const durationHours = duration ? parseInt(duration) : 24; // 24 horas por defecto
    return this.tradesService.getOpenInterestAnalysis(symbol.toUpperCase(), durationHours);
  }

  // 🎯 FUNDING RATE ENDPOINTS
  
  @Get(':symbol/funding-rate/current')
  async getCurrentFundingRate(@Param('symbol') symbol: string) {
    try {
      const latest = await this.fundingRateRepository
        .createQueryBuilder('fr')
        .where('fr.symbol = :symbol', { symbol: symbol.toUpperCase() })
        .orderBy('fr.timestamp', 'DESC')
        .limit(1)
        .getOne();

      if (!latest) {
        return { error: 'No funding rate data found' };
      }

      return {
        symbol: latest.symbol,
        current_funding_rate: parseFloat(latest.current_funding_rate.toString()),
        predicted_funding_rate: parseFloat(latest.predicted_funding_rate.toString()),
        current_funding_rate_percent: (parseFloat(latest.current_funding_rate.toString()) * 100).toFixed(4),
        predicted_funding_rate_percent: (parseFloat(latest.predicted_funding_rate.toString()) * 100).toFixed(4),
        next_funding_time: new Date(latest.next_funding_time).toISOString(),
        mark_price: parseFloat(latest.mark_price.toString()),
        index_price: parseFloat(latest.index_price.toString()),
        market_sentiment: latest.market_sentiment,
        long_short_bias: parseFloat(latest.long_short_bias.toString()),
        is_extreme: latest.is_extreme,
        reversal_signal: latest.reversal_signal || null,
        timestamp: latest.timestamp
      };
    } catch (error) {
      return { error: 'Error fetching current funding rate', details: error.message };
    }
  }

  @Get(':symbol/funding-rate/history')
  async getFundingRateHistory(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      const queryLimit = limit ? parseInt(limit) : 24; // Default 24 horas
      let query = this.fundingRateRepository
        .createQueryBuilder('fr')
        .where('fr.symbol = :symbol', { symbol: symbol.toUpperCase() });

      if (startDate) {
        query = query.andWhere('fr.timestamp >= :startDate', { startDate: new Date(startDate) });
      }
      if (endDate) {
        query = query.andWhere('fr.timestamp <= :endDate', { endDate: new Date(endDate) });
      }

      const fundingRates = await query
        .orderBy('fr.timestamp', 'DESC')
        .limit(queryLimit)
        .getMany();

      return {
        symbol: symbol.toUpperCase(),
        count: fundingRates.length,
        data: fundingRates.map(fr => ({
          timestamp: fr.timestamp,
          current_funding_rate: parseFloat(fr.current_funding_rate.toString()),
          predicted_funding_rate: parseFloat(fr.predicted_funding_rate.toString()),
          current_funding_rate_percent: (parseFloat(fr.current_funding_rate.toString()) * 100).toFixed(4),
          next_funding_time: new Date(fr.next_funding_time).toISOString(),
          mark_price: parseFloat(fr.mark_price.toString()),
          market_sentiment: fr.market_sentiment,
          long_short_bias: parseFloat(fr.long_short_bias.toString()),
          is_extreme: fr.is_extreme,
          reversal_signal: fr.reversal_signal || null
        }))
      };
    } catch (error) {
      return { error: 'Error fetching funding rate history', details: error.message };
    }
  }

  @Get(':symbol/funding-rate/bias-analysis')
  async getFundingRateBiasAnalysis(@Param('symbol') symbol: string) {
    try {
      // Obtener datos de las últimas 24 horas
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [latest, recent24h, recent8h, recent1h] = await Promise.all([
        // Último registro
        this.fundingRateRepository
          .createQueryBuilder('fr')
          .where('fr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .orderBy('fr.timestamp', 'DESC')
          .limit(1)
          .getOne(),
        
        // Últimas 24 horas
        this.fundingRateRepository
          .createQueryBuilder('fr')
          .where('fr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('fr.timestamp >= :twentyFourHoursAgo', { twentyFourHoursAgo })
          .orderBy('fr.timestamp', 'DESC')
          .getMany(),

        // Últimas 8 horas
        this.fundingRateRepository
          .createQueryBuilder('fr')
          .where('fr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('fr.timestamp >= :eightHoursAgo', { eightHoursAgo })
          .orderBy('fr.timestamp', 'DESC')
          .getMany(),

        // Última hora
        this.fundingRateRepository
          .createQueryBuilder('fr')
          .where('fr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('fr.timestamp >= :oneHourAgo', { oneHourAgo })
          .orderBy('fr.timestamp', 'DESC')
          .getMany()
      ]);

      if (!latest) {
        return { error: 'No funding rate data found' };
      }

      // Calcular estadísticas
      const avg24h = recent24h.length > 0 
        ? recent24h.reduce((sum, fr) => sum + parseFloat(fr.current_funding_rate.toString()), 0) / recent24h.length
        : 0;
      
      const avg8h = recent8h.length > 0 
        ? recent8h.reduce((sum, fr) => sum + parseFloat(fr.current_funding_rate.toString()), 0) / recent8h.length
        : 0;

      const avg1h = recent1h.length > 0 
        ? recent1h.reduce((sum, fr) => sum + parseFloat(fr.current_funding_rate.toString()), 0) / recent1h.length
        : 0;

      // Detectar tendencias
      const currentRate = parseFloat(latest.current_funding_rate.toString());
      const trend24h = currentRate - avg24h;
      const trend8h = currentRate - avg8h;

      // Contar extremos
      const extremeCount24h = recent24h.filter(fr => fr.is_extreme).length;
      const extremePercentage = recent24h.length > 0 ? (extremeCount24h / recent24h.length) * 100 : 0;

      // Detectar patrones de reversal
      const reversalSignals = recent24h.filter(fr => fr.reversal_signal && fr.reversal_signal.length > 0);

      return {
        symbol: symbol.toUpperCase(),
        current_analysis: {
          current_funding_rate: currentRate,
          current_funding_rate_percent: (currentRate * 100).toFixed(4),
          market_sentiment: latest.market_sentiment,
          long_short_bias: parseFloat(latest.long_short_bias.toString()),
          is_extreme: latest.is_extreme,
          reversal_signal: latest.reversal_signal || null
        },
        averages: {
          avg_1h: avg1h,
          avg_8h: avg8h,
          avg_24h: avg24h,
          avg_1h_percent: (avg1h * 100).toFixed(4),
          avg_8h_percent: (avg8h * 100).toFixed(4),
          avg_24h_percent: (avg24h * 100).toFixed(4)
        },
        trends: {
          trend_24h: trend24h,
          trend_8h: trend8h,
          trend_24h_percent: (trend24h * 100).toFixed(4),
          trend_8h_percent: (trend8h * 100).toFixed(4),
          direction_24h: trend24h > 0 ? 'increasing' : trend24h < 0 ? 'decreasing' : 'stable',
          direction_8h: trend8h > 0 ? 'increasing' : trend8h < 0 ? 'decreasing' : 'stable'
        },
        extreme_analysis: {
          extreme_count_24h: extremeCount24h,
          extreme_percentage_24h: extremePercentage.toFixed(2),
          total_samples_24h: recent24h.length
        },
        reversal_signals: {
          count_24h: reversalSignals.length,
          latest_signals: reversalSignals.slice(0, 5).map(fr => ({
            signal: fr.reversal_signal,
            timestamp: fr.timestamp,
            funding_rate: parseFloat(fr.current_funding_rate.toString())
          }))
        },
        interpretation: {
          market_condition: this.interpretMarketCondition(currentRate, avg24h, latest.is_extreme),
          risk_level: this.assessRiskLevel(currentRate, extremePercentage, reversalSignals.length),
          trading_suggestion: this.generateTradingSuggestion(currentRate, trend24h, latest.market_sentiment, latest.reversal_signal)
        }
      };
    } catch (error) {
      return { error: 'Error analyzing funding rate bias', details: error.message };
    }
  }

  // 🎯 Métodos auxiliares para análisis

  private interpretMarketCondition(current: number, avg24h: number, isExtreme: boolean): string {
    if (isExtreme) {
      return current > 0 ? 'Heavily Long Biased - Caution' : 'Heavily Short Biased - Caution';
    }
    
    if (current > avg24h * 1.5) {
      return 'Long Bias Increasing';
    } else if (current < avg24h * 1.5) {
      return 'Short Bias Increasing';
    }
    
    return 'Balanced Market';
  }

  private assessRiskLevel(current: number, extremePercentage: number, reversalCount: number): string {
    if (Math.abs(current) > 0.002 || extremePercentage > 50 || reversalCount > 3) {
      return 'HIGH';
    } else if (Math.abs(current) > 0.001 || extremePercentage > 25 || reversalCount > 1) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private generateTradingSuggestion(current: number, trend: number, sentiment: string, reversalSignal: string): string {
    if (reversalSignal && reversalSignal.includes('reversal')) {
      return reversalSignal.includes('bearish') 
        ? 'Consider SHORT positions - Long bias may be exhausted'
        : 'Consider LONG positions - Short bias may be exhausted';
    }
    
    if (Math.abs(current) > 0.0015) {
      return current > 0 
        ? 'HIGH FUNDING COST for longs - Consider shorts or wait'
        : 'HIGH FUNDING INCOME for longs - Long positions attractive';
    }
    
    return 'Moderate funding conditions - Normal trading';
  }

  // 🎯 LONG/SHORT RATIO ENDPOINTS
  
  @Get(':symbol/long-short-ratio/current')
  async getCurrentLongShortRatio(@Param('symbol') symbol: string) {
    try {
      const latest = await this.longShortRatioRepository
        .createQueryBuilder('lsr')
        .where('lsr.symbol = :symbol', { symbol: symbol.toUpperCase() })
        .orderBy('lsr.timestamp', 'DESC')
        .limit(1)
        .getOne();

      if (!latest) {
        return { error: 'No long/short ratio data found' };
      }

      return {
        symbol: latest.symbol,
        long_short_ratio: parseFloat(latest.long_short_ratio.toString()),
        long_account_ratio: parseFloat(latest.long_account_ratio.toString()),
        short_account_ratio: parseFloat(latest.short_account_ratio.toString()),
        long_account_percentage: (parseFloat(latest.long_account_ratio.toString()) * 100).toFixed(2),
        short_account_percentage: (parseFloat(latest.short_account_ratio.toString()) * 100).toFixed(2),
        top_trader_long_ratio: latest.top_trader_long_ratio ? parseFloat(latest.top_trader_long_ratio.toString()) : null,
        top_trader_short_ratio: latest.top_trader_short_ratio ? parseFloat(latest.top_trader_short_ratio.toString()) : null,
        market_sentiment: latest.market_sentiment,
        sentiment_score: parseFloat(latest.sentiment_score.toString()),
        is_extreme_long: latest.is_extreme_long,
        is_extreme_short: latest.is_extreme_short,
        contrarian_signal: latest.contrarian_signal,
        fomo_panic_level: parseFloat(latest.fomo_panic_level.toString()),
        crowd_behavior: latest.crowd_behavior,
        timestamp: latest.timestamp
      };
    } catch (error) {
      return { error: 'Error fetching current long/short ratio', details: error.message };
    }
  }

  @Get(':symbol/long-short-ratio/history')
  async getLongShortRatioHistory(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    try {
      const queryLimit = limit ? parseInt(limit) : 48; // Default 48 registros (4 horas * 12 = 48)
      let query = this.longShortRatioRepository
        .createQueryBuilder('lsr')
        .where('lsr.symbol = :symbol', { symbol: symbol.toUpperCase() });

      if (startDate) {
        query = query.andWhere('lsr.timestamp >= :startDate', { startDate: new Date(startDate) });
      }
      if (endDate) {
        query = query.andWhere('lsr.timestamp <= :endDate', { endDate: new Date(endDate) });
      }

      const longShortRatios = await query
        .orderBy('lsr.timestamp', 'DESC')
        .limit(queryLimit)
        .getMany();

      return {
        symbol: symbol.toUpperCase(),
        count: longShortRatios.length,
        data: longShortRatios.map(lsr => ({
          timestamp: lsr.timestamp,
          long_short_ratio: parseFloat(lsr.long_short_ratio.toString()),
          long_account_ratio: parseFloat(lsr.long_account_ratio.toString()),
          short_account_ratio: parseFloat(lsr.short_account_ratio.toString()),
          long_account_percentage: (parseFloat(lsr.long_account_ratio.toString()) * 100).toFixed(2),
          short_account_percentage: (parseFloat(lsr.short_account_ratio.toString()) * 100).toFixed(2),
          market_sentiment: lsr.market_sentiment,
          sentiment_score: parseFloat(lsr.sentiment_score.toString()),
          is_extreme_long: lsr.is_extreme_long,
          is_extreme_short: lsr.is_extreme_short,
          contrarian_signal: lsr.contrarian_signal,
          fomo_panic_level: parseFloat(lsr.fomo_panic_level.toString()),
          crowd_behavior: lsr.crowd_behavior
        }))
      };
    } catch (error) {
      return { error: 'Error fetching long/short ratio history', details: error.message };
    }
  }

  @Get(':symbol/long-short-ratio/sentiment-analysis')
  async getLongShortRatioSentimentAnalysis(@Param('symbol') symbol: string) {
    try {
      // Obtener datos de diferentes períodos
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [latest, recent24h, recent4h, recent1h] = await Promise.all([
        // Último registro
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .orderBy('lsr.timestamp', 'DESC')
          .limit(1)
          .getOne(),
        
        // Últimas 24 horas
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('lsr.timestamp >= :twentyFourHoursAgo', { twentyFourHoursAgo })
          .orderBy('lsr.timestamp', 'DESC')
          .getMany(),

        // Últimas 4 horas
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('lsr.timestamp >= :fourHoursAgo', { fourHoursAgo })
          .orderBy('lsr.timestamp', 'DESC')
          .getMany(),

        // Última hora
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('lsr.timestamp >= :oneHourAgo', { oneHourAgo })
          .orderBy('lsr.timestamp', 'DESC')
          .getMany()
      ]);

      if (!latest) {
        return { error: 'No long/short ratio data found' };
      }

      // Calcular estadísticas
      const avgLongRatio24h = recent24h.length > 0 
        ? recent24h.reduce((sum, lsr) => sum + parseFloat(lsr.long_account_ratio.toString()), 0) / recent24h.length
        : 0;
      
      const avgLongRatio4h = recent4h.length > 0 
        ? recent4h.reduce((sum, lsr) => sum + parseFloat(lsr.long_account_ratio.toString()), 0) / recent4h.length
        : 0;

      const avgLongRatio1h = recent1h.length > 0 
        ? recent1h.reduce((sum, lsr) => sum + parseFloat(lsr.long_account_ratio.toString()), 0) / recent1h.length
        : 0;

      // Detectar tendencias
      const currentLongRatio = parseFloat(latest.long_account_ratio.toString());
      const trend24h = currentLongRatio - avgLongRatio24h;
      const trend4h = currentLongRatio - avgLongRatio4h;

      // Contar extremos
      const extremeLongCount24h = recent24h.filter(lsr => lsr.is_extreme_long).length;
      const extremeShortCount24h = recent24h.filter(lsr => lsr.is_extreme_short).length;
      const extremePercentage = recent24h.length > 0 ? ((extremeLongCount24h + extremeShortCount24h) / recent24h.length) * 100 : 0;

      // Detectar señales contrarias
      const contrarianSignals = recent24h.filter(lsr => lsr.contrarian_signal && lsr.contrarian_signal.length > 0);

      // Análisis de FOMO/pánico
      const fomoPanicLevels = recent24h.map(lsr => parseFloat(lsr.fomo_panic_level.toString()));
      const avgFomoPanic = fomoPanicLevels.length > 0 ? fomoPanicLevels.reduce((sum, level) => sum + level, 0) / fomoPanicLevels.length : 0;

      return {
        symbol: symbol.toUpperCase(),
        current_analysis: {
          long_account_ratio: currentLongRatio,
          long_account_percentage: (currentLongRatio * 100).toFixed(2),
          short_account_percentage: ((1 - currentLongRatio) * 100).toFixed(2),
          market_sentiment: latest.market_sentiment,
          sentiment_score: parseFloat(latest.sentiment_score.toString()),
          is_extreme_long: latest.is_extreme_long,
          is_extreme_short: latest.is_extreme_short,
          contrarian_signal: latest.contrarian_signal,
          fomo_panic_level: parseFloat(latest.fomo_panic_level.toString()),
          crowd_behavior: latest.crowd_behavior
        },
        averages: {
          avg_long_ratio_1h: avgLongRatio1h,
          avg_long_ratio_4h: avgLongRatio4h,
          avg_long_ratio_24h: avgLongRatio24h,
          avg_long_percentage_1h: (avgLongRatio1h * 100).toFixed(2),
          avg_long_percentage_4h: (avgLongRatio4h * 100).toFixed(2),
          avg_long_percentage_24h: (avgLongRatio24h * 100).toFixed(2)
        },
        trends: {
          trend_24h: trend24h,
          trend_4h: trend4h,
          trend_24h_percentage: (trend24h * 100).toFixed(2),
          trend_4h_percentage: (trend4h * 100).toFixed(2),
          direction_24h: trend24h > 0 ? 'more_bullish' : trend24h < 0 ? 'more_bearish' : 'stable',
          direction_4h: trend4h > 0 ? 'more_bullish' : trend4h < 0 ? 'more_bearish' : 'stable'
        },
        extreme_analysis: {
          extreme_long_count_24h: extremeLongCount24h,
          extreme_short_count_24h: extremeShortCount24h,
          extreme_percentage_24h: extremePercentage.toFixed(2),
          total_samples_24h: recent24h.length,
          avg_fomo_panic_level: avgFomoPanic.toFixed(2)
        },
        contrarian_signals: {
          count_24h: contrarianSignals.length,
          latest_signals: contrarianSignals.slice(0, 5).map(lsr => ({
            signal: lsr.contrarian_signal,
            timestamp: lsr.timestamp,
            long_ratio: parseFloat(lsr.long_account_ratio.toString()),
            sentiment: lsr.market_sentiment
          }))
        },
        interpretation: {
          market_condition: this.interpretLongShortCondition(currentLongRatio, avgLongRatio24h, latest.is_extreme_long, latest.is_extreme_short),
          risk_level: this.assessLongShortRiskLevel(extremePercentage, contrarianSignals.length, Math.abs(avgFomoPanic)),
          trading_suggestion: this.generateLongShortTradingSuggestion(currentLongRatio, trend24h, latest.market_sentiment, latest.contrarian_signal)
        }
      };
    } catch (error) {
      return { error: 'Error analyzing long/short ratio sentiment', details: error.message };
    }
  }

  // 🎯 Métodos auxiliares para análisis de Long/Short Ratio

  private interpretLongShortCondition(current: number, avg24h: number, isExtremeLong: boolean, isExtremeShort: boolean): string {
    if (isExtremeLong) {
      return 'Extreme Long Bias - High Reversal Risk';
    } else if (isExtremeShort) {
      return 'Extreme Short Bias - Potential Bounce';
    }
    
    if (current > avg24h * 1.2) {
      return 'Increasing Long Bias';
    } else if (current < avg24h * 0.8) {
      return 'Increasing Short Bias';
    }
    
    return 'Balanced Sentiment';
  }

  private assessLongShortRiskLevel(extremePercentage: number, contrarianCount: number, avgFomoPanic: number): string {
    if (extremePercentage > 50 || contrarianCount > 3 || avgFomoPanic > 50) {
      return 'HIGH';
    } else if (extremePercentage > 25 || contrarianCount > 1 || avgFomoPanic > 25) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private generateLongShortTradingSuggestion(current: number, trend: number, sentiment: string, contrarianSignal: string | null): string {
    if (contrarianSignal) {
      if (contrarianSignal === 'bearish_contrarian') {
        return 'CONTRARIAN SHORT - Too many longs, consider selling';
      } else if (contrarianSignal === 'bullish_contrarian') {
        return 'CONTRARIAN LONG - Too many shorts, consider buying';
      }
    }
    
    if (current > 0.75) {
      return 'CAUTION - Extreme long bias, potential reversal zone';
    } else if (current < 0.25) {
      return 'OPPORTUNITY - Extreme short bias, potential bounce zone';
    }
    
    if (sentiment === 'extreme_greed') {
      return 'HIGH RISK - Market in extreme greed, consider taking profits';
    } else if (sentiment === 'extreme_fear') {
      return 'OPPORTUNITY - Market in extreme fear, consider accumulating';
    }
    
    return 'NORMAL - Balanced long/short sentiment, follow trend';
  }

  // 🎯 LIQUIDATION ENDPOINTS
  
  @Get(':symbol/liquidations/current')
  async getCurrentLiquidations(@Param('symbol') symbol: string) {
    try {
      const status = this.bybitService.getStatus();
      const liquidationData = status.liquidationData[symbol.toUpperCase()];
      const activeClusters = status.activeClusters;
      
      if (!liquidationData) {
        return {
          symbol: symbol.toUpperCase(),
          recentLiquidations: [],
          totalCount: 0,
          totalVolume: 0,
          activeClusters: 0,
          message: 'Sin datos de liquidaciones disponibles'
        };
      }

      return {
        symbol: symbol.toUpperCase(),
        recentLiquidations: liquidationData.recentLiquidations,
        totalCount: liquidationData.totalCount,
        totalVolume: liquidationData.totalVolume,
        lastLiquidation: liquidationData.lastLiquidation,
        activeClusters: Object.keys(activeClusters).length,
        clusterDetails: activeClusters,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { error: 'Error fetching current liquidations', details: error.message };
    }
  }

  @Get(':symbol/liquidations/history')
  async getLiquidationHistory(
    @Param('symbol') symbol: string,
    @Query('limit') limit?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('minValue') minValue?: string
  ) {
    try {
      const queryLimit = limit ? parseInt(limit) : 100; // Default 100 liquidaciones
      let query = this.liquidationRepository
        .createQueryBuilder('liq')
        .where('liq.symbol = :symbol', { symbol: symbol.toUpperCase() });

      if (startDate) {
        query = query.andWhere('liq.timestamp >= :startDate', { startDate: new Date(startDate) });
      }
      if (endDate) {
        query = query.andWhere('liq.timestamp <= :endDate', { endDate: new Date(endDate) });
      }
      if (minValue) {
        query = query.andWhere('liq.value_usd >= :minValue', { minValue: parseFloat(minValue) });
      }

      const liquidations = await query
        .orderBy('liq.timestamp', 'DESC')
        .limit(queryLimit)
        .getMany();

      return {
        symbol: symbol.toUpperCase(),
        count: liquidations.length,
        totalVolume: liquidations.reduce((sum, liq) => sum + parseFloat(liq.value_usd.toString()), 0),
        data: liquidations.map(liq => ({
          timestamp: liq.timestamp,
          price: parseFloat(liq.price.toString()),
          size: parseFloat(liq.size.toString()),
          side: liq.side,
          value_usd: parseFloat(liq.value_usd.toString()),
          is_large_liquidation: liq.is_large_liquidation,
          liquidation_intensity: liq.liquidation_intensity,
          market_event_type: liq.market_event_type,
          market_pressure: liq.market_pressure,
          is_cluster_member: liq.is_cluster_member,
          cluster_id: liq.cluster_id,
          is_reversal_zone: liq.is_reversal_zone
        }))
      };
    } catch (error) {
      return { error: 'Error fetching liquidation history', details: error.message };
    }
  }

  @Get(':symbol/liquidations/clusters')
  async getLiquidationClusters(
    @Param('symbol') symbol: string,
    @Query('hours') hours?: string
  ) {
    try {
      const hoursBack = hours ? parseInt(hours) : 24; // Default 24 horas
      const startTime = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const clusters = await this.liquidationRepository
        .createQueryBuilder('liq')
        .select([
          'liq.cluster_id as clusterId',
          'MIN(liq.timestamp) as startTime',
          'MAX(liq.timestamp) as endTime',
          'COUNT(*) as liquidationCount',
          'SUM(liq.value_usd) as totalVolume',
          'MIN(liq.price) as priceMin',
          'MAX(liq.price) as priceMax',
          'liq.market_event_type as eventType'
        ])
        .where('liq.symbol = :symbol', { symbol: symbol.toUpperCase() })
        .andWhere('liq.timestamp >= :startTime', { startTime })
        .andWhere('liq.cluster_id IS NOT NULL')
        .groupBy('liq.cluster_id, liq.market_event_type')
        .orderBy('MIN(liq.timestamp)', 'DESC')
        .getRawMany();

      return {
        symbol: symbol.toUpperCase(),
        periodHours: hoursBack,
        clusterCount: clusters.length,
        clusters: clusters.map(cluster => ({
          clusterId: cluster.clusterId,
          startTime: cluster.startTime,
          endTime: cluster.endTime,
          liquidationCount: parseInt(cluster.liquidationCount),
          totalVolume: parseFloat(cluster.totalVolume),
          priceRange: {
            min: parseFloat(cluster.priceMin),
            max: parseFloat(cluster.priceMax),
            spread: ((parseFloat(cluster.priceMax) - parseFloat(cluster.priceMin)) / parseFloat(cluster.priceMin) * 100).toFixed(4)
          },
          eventType: cluster.eventType,
          intensity: this.calculateClusterIntensity(parseInt(cluster.liquidationCount), parseFloat(cluster.totalVolume))
        }))
      };
    } catch (error) {
      return { error: 'Error analyzing liquidation clusters', details: error.message };
    }
  }

  @Get(':symbol/liquidations/analysis')
  async getLiquidationAnalysis(@Param('symbol') symbol: string) {
    try {
      // Obtener datos de diferentes períodos
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recent1h, recent6h, recent24h, largeLiquidations] = await Promise.all([
        // Última hora
        this.liquidationRepository
          .createQueryBuilder('liq')
          .where('liq.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('liq.timestamp >= :oneHourAgo', { oneHourAgo })
          .orderBy('liq.timestamp', 'DESC')
          .getMany(),

        // Últimas 6 horas
        this.liquidationRepository
          .createQueryBuilder('liq')
          .where('liq.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('liq.timestamp >= :sixHoursAgo', { sixHoursAgo })
          .orderBy('liq.timestamp', 'DESC')
          .getMany(),

        // Últimas 24 horas
        this.liquidationRepository
          .createQueryBuilder('liq')
          .where('liq.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('liq.timestamp >= :twentyFourHoursAgo', { twentyFourHoursAgo })
          .orderBy('liq.timestamp', 'DESC')
          .getMany(),

        // Liquidaciones grandes recientes
        this.liquidationRepository
          .createQueryBuilder('liq')
          .where('liq.symbol = :symbol', { symbol: symbol.toUpperCase() })
          .andWhere('liq.is_large_liquidation = :isLarge', { isLarge: true })
          .andWhere('liq.timestamp >= :twentyFourHoursAgo', { twentyFourHoursAgo })
          .orderBy('liq.value_usd', 'DESC')
          .limit(10)
          .getMany()
      ]);

      // Análisis por períodos
      const analysis1h = this.analyzeLiquidationPeriod(recent1h);
      const analysis6h = this.analyzeLiquidationPeriod(recent6h);
      const analysis24h = this.analyzeLiquidationPeriod(recent24h);

      // Análisis de zonas de reversión
      const reversalZones = recent24h.filter(liq => liq.is_reversal_zone);
      const cascadeEvents = recent24h.filter(liq => liq.market_event_type === 'cascade');

      return {
        symbol: symbol.toUpperCase(),
        summary: {
          total_liquidations_1h: recent1h.length,
          total_liquidations_6h: recent6h.length,
          total_liquidations_24h: recent24h.length,
          total_volume_1h: analysis1h.totalVolume,
          total_volume_6h: analysis6h.totalVolume,
          total_volume_24h: analysis24h.totalVolume,
          large_liquidations_24h: largeLiquidations.length
        },
        period_analysis: {
          last_1h: analysis1h,
          last_6h: analysis6h,
          last_24h: analysis24h
        },
        market_events: {
          reversal_zones_24h: reversalZones.length,
          cascade_events_24h: cascadeEvents.length,
          latest_reversal_zones: reversalZones.slice(0, 5).map(liq => ({
            timestamp: liq.timestamp,
            price: parseFloat(liq.price.toString()),
            intensity: liq.liquidation_intensity,
            volume: parseFloat(liq.value_usd.toString())
          }))
        },
        large_liquidations: largeLiquidations.map(liq => ({
          timestamp: liq.timestamp,
          side: liq.side,
          price: parseFloat(liq.price.toString()),
          size: parseFloat(liq.size.toString()),
          value_usd: parseFloat(liq.value_usd.toString()),
          event_type: liq.market_event_type,
          market_pressure: liq.market_pressure
        })),
        risk_assessment: {
          liquidation_pressure: this.assessLiquidationPressure(analysis1h, analysis24h),
          market_stress_level: this.assessMarketStress(recent1h, cascadeEvents.length),
          potential_reversal_zones: reversalZones.length > 0 ? 'DETECTED' : 'NONE'
        }
      };
    } catch (error) {
      return { error: 'Error analyzing liquidations', details: error.message };
    }
  }

  // 🎯 Métodos auxiliares para análisis de liquidaciones

  private analyzeLiquidationPeriod(liquidations: Liquidation[]) {
    if (liquidations.length === 0) {
      return {
        totalVolume: 0,
        longLiquidations: 0,
        shortLiquidations: 0,
        averageSize: 0,
        dominantSide: 'none',
        intensity: 'none'
      };
    }

    const totalVolume = liquidations.reduce((sum, liq) => sum + parseFloat(liq.value_usd.toString()), 0);
    const longLiqs = liquidations.filter(liq => liq.side === 'Buy');
    const shortLiqs = liquidations.filter(liq => liq.side === 'Sell');
    const averageSize = totalVolume / liquidations.length;

    let dominantSide = 'balanced';
    if (longLiqs.length > shortLiqs.length * 2) dominantSide = 'long_heavy';
    else if (shortLiqs.length > longLiqs.length * 2) dominantSide = 'short_heavy';

    let intensity = 'low';
    if (liquidations.length > 50) intensity = 'extreme';
    else if (liquidations.length > 20) intensity = 'high';
    else if (liquidations.length > 10) intensity = 'medium';

    return {
      totalVolume,
      longLiquidations: longLiqs.length,
      shortLiquidations: shortLiqs.length,
      averageSize,
      dominantSide,
      intensity
    };
  }

  private calculateClusterIntensity(count: number, volume: number): string {
    if (count > 20 && volume > 5000000) return 'extreme';
    if (count > 10 && volume > 1000000) return 'high';
    if (count > 5 && volume > 500000) return 'medium';
    return 'low';
  }

  private assessLiquidationPressure(recent: any, baseline: any): string {
    const volumeRatio = baseline.totalVolume > 0 ? recent.totalVolume / (baseline.totalVolume / 24) : 0;
    
    if (volumeRatio > 5) return 'EXTREME';
    if (volumeRatio > 3) return 'HIGH';
    if (volumeRatio > 1.5) return 'MEDIUM';
    return 'LOW';
  }

  private assessMarketStress(recentLiquidations: Liquidation[], cascadeCount: number): string {
    const extremeEvents = recentLiquidations.filter(liq => 
      liq.liquidation_intensity === 'extreme' || liq.market_event_type === 'cascade'
    ).length;
    
    if (extremeEvents > 5 || cascadeCount > 2) return 'CRITICAL';
    if (extremeEvents > 2 || cascadeCount > 1) return 'HIGH';
    if (extremeEvents > 0) return 'MEDIUM';
    return 'LOW';
  }
} 