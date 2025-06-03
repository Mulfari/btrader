import { Controller, Get, Param, Query, Post } from '@nestjs/common';
import { TradesService } from './trades.service';
import { BybitWebSocketService } from './bybit-websocket.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';

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
} 