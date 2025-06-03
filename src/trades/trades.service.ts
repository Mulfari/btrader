import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { BybitWebSocketService } from './bybit-websocket.service';

@Injectable()
export class TradesService {
  constructor(
    @InjectRepository(TradeAggregate)
    private tradeRepository: Repository<TradeAggregate>,
    @InjectRepository(OrderbookSnapshot)
    private orderbookRepository: Repository<OrderbookSnapshot>,
    @InjectRepository(OpenInterest)
    private openInterestRepository: Repository<OpenInterest>,
    private bybitService: BybitWebSocketService,
  ) {}

  // Obtener datos actuales del acumulador en memoria
  async getCurrentData(symbol: string) {
    const current = this.bybitService.getCurrentAccumulator(symbol);
    
    if (!current) {
      return {
        symbol,
        buyVolume: 0,
        sellVolume: 0,
        buyCount: 0,
        sellCount: 0,
        totalVolume: 0,
        buyRatio: 0.5,
        sellRatio: 0.5,
        vwap: 0,
        priceHigh: 0,
        priceLow: 0,
        timestamp: new Date()
      };
    }

    const totalVolume = current.buyVolume + current.sellVolume;
    const buyRatio = totalVolume > 0 ? current.buyVolume / totalVolume : 0.5;
    const sellRatio = totalVolume > 0 ? current.sellVolume / totalVolume : 0.5;

    // Calcular VWAP actual
    const totalValue = current.trades.reduce((sum, t) => sum + (t.price * t.volume), 0);
    const vwap = totalVolume > 0 ? totalValue / totalVolume : (current.trades[0]?.price || 0);

    return {
      symbol,
      buyVolume: current.buyVolume,
      sellVolume: current.sellVolume,
      buyCount: current.buyCount,
      sellCount: current.sellCount,
      totalVolume,
      buyRatio,
      sellRatio,
      vwap,
      priceHigh: current.priceHigh,
      priceLow: current.priceLow,
      timestamp: new Date()
    };
  }

  // Obtener histórico por rango de fechas
  async getHistory(symbol: string, from: Date, to: Date, limit: number) {
    return this.tradeRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'DESC' },
      take: limit
    });
  }

  // Obtener datos de un día específico
  async getDayData(symbol: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const data = await this.tradeRepository.find({
      where: {
        symbol,
        timestamp: Between(startOfDay, endOfDay)
      },
      order: { timestamp: 'ASC' }
    });

    // Calcular resumen del día
    const summary = data.reduce((acc, curr) => ({
      totalBuyVolume: acc.totalBuyVolume + Number(curr.buy_volume),
      totalSellVolume: acc.totalSellVolume + Number(curr.sell_volume),
      totalBuyTrades: acc.totalBuyTrades + curr.buy_count,
      totalSellTrades: acc.totalSellTrades + curr.sell_count,
      highestPrice: Math.max(acc.highestPrice, Number(curr.price_high)),
      lowestPrice: Math.min(acc.lowestPrice, Number(curr.price_low)),
      avgVWAP: (acc.avgVWAP + Number(curr.vwap)) / 2
    }), {
      totalBuyVolume: 0,
      totalSellVolume: 0,
      totalBuyTrades: 0,
      totalSellTrades: 0,
      highestPrice: 0,
      lowestPrice: Infinity,
      avgVWAP: 0
    });

    const totalVolume = summary.totalBuyVolume + summary.totalSellVolume;
    
    return {
      date: date.toISOString().split('T')[0],
      symbol,
      summary: {
        ...summary,
        totalVolume,
        buyRatio: totalVolume > 0 ? summary.totalBuyVolume / totalVolume : 0.5,
        sellRatio: totalVolume > 0 ? summary.totalSellVolume / totalVolume : 0.5,
        totalTrades: summary.totalBuyTrades + summary.totalSellTrades
      },
      data
    };
  }

  // Obtener resumen agregado por minutos/horas
  async getSummary(symbol: string, interval: 'minute' | 'hour', durationHours: number) {
    const from = new Date(Date.now() - durationHours * 60 * 60 * 1000);
    const to = new Date();

    const data = await this.tradeRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'ASC' }
    });

    // Agrupar por intervalo
    const groupedData = new Map();
    
    data.forEach(record => {
      const timestamp = new Date(record.timestamp);
      let key: string;
      
      if (interval === 'minute') {
        timestamp.setSeconds(0, 0);
        key = timestamp.toISOString();
      } else {
        timestamp.setMinutes(0, 0, 0);
        key = timestamp.toISOString();
      }

      if (!groupedData.has(key)) {
        groupedData.set(key, {
          timestamp: key,
          buyVolume: 0,
          sellVolume: 0,
          buyCount: 0,
          sellCount: 0,
          records: []
        });
      }

      const group = groupedData.get(key);
      group.buyVolume += Number(record.buy_volume);
      group.sellVolume += Number(record.sell_volume);
      group.buyCount += record.buy_count;
      group.sellCount += record.sell_count;
      group.records.push(record);
    });

    // Convertir a array y calcular métricas
    const result = Array.from(groupedData.values()).map(group => {
      const totalVolume = group.buyVolume + group.sellVolume;
      return {
        ...group,
        totalVolume,
        buyRatio: totalVolume > 0 ? group.buyVolume / totalVolume : 0.5,
        sellRatio: totalVolume > 0 ? group.sellVolume / totalVolume : 0.5,
        totalTrades: group.buyCount + group.sellCount,
        recordCount: group.records.length
      };
    });

    return result;
  }

  // Obtener símbolos disponibles
  async getAvailableSymbols() {
    const symbols = await this.tradeRepository
      .createQueryBuilder('trade')
      .select('DISTINCT trade.symbol', 'symbol')
      .getRawMany();

    return symbols.map(s => s.symbol);
  }

  // 🟢 Métodos para Orderbook
  
  // Obtener histórico del orderbook
  async getOrderbookHistory(symbol: string, from: Date, to: Date, limit: number) {
    return this.orderbookRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'DESC' },
      take: limit
    });
  }

  // Análisis de spread y métricas del orderbook
  async getSpreadAnalysis(symbol: string, durationMinutes: number) {
    const from = new Date(Date.now() - durationMinutes * 60 * 1000);
    const to = new Date();

    const data = await this.orderbookRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'ASC' }
    });

    if (data.length === 0) {
      return {
        symbol,
        period: `${durationMinutes} minutos`,
        message: 'Sin datos de orderbook disponibles',
        analysis: null
      };
    }

    // Calcular métricas
    const spreads = data.map(d => Number(d.spread));
    const imbalances = data.map(d => Number(d.imbalance));
    const midPrices = data.map(d => Number(d.mid_price));

    const avgSpread = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    const minSpread = Math.min(...spreads);
    const maxSpread = Math.max(...spreads);
    
    const avgImbalance = imbalances.reduce((a, b) => a + b, 0) / imbalances.length;
    const minPrice = Math.min(...midPrices);
    const maxPrice = Math.max(...midPrices);
    
    // Volatilidad del spread
    const spreadVariance = spreads.reduce((acc, spread) => acc + Math.pow(spread - avgSpread, 2), 0) / spreads.length;
    const spreadStdDev = Math.sqrt(spreadVariance);

    // Detectar períodos de alta/baja liquidez
    const highLiquidityThreshold = avgSpread * 0.5; // Spread bajo = alta liquidez
    const lowLiquidityThreshold = avgSpread * 1.5;  // Spread alto = baja liquidez
    
    const highLiquidityPeriods = data.filter(d => Number(d.spread) <= highLiquidityThreshold).length;
    const lowLiquidityPeriods = data.filter(d => Number(d.spread) >= lowLiquidityThreshold).length;

    return {
      symbol,
      period: `${durationMinutes} minutos`,
      dataPoints: data.length,
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString()
      },
      spreadAnalysis: {
        average: avgSpread,
        min: minSpread,
        max: maxSpread,
        standardDeviation: spreadStdDev,
        volatility: spreadStdDev / avgSpread // Coeficiente de variación
      },
      liquidityAnalysis: {
        averageImbalance: avgImbalance,
        highLiquidityPeriods: {
          count: highLiquidityPeriods,
          percentage: (highLiquidityPeriods / data.length) * 100
        },
        lowLiquidityPeriods: {
          count: lowLiquidityPeriods,
          percentage: (lowLiquidityPeriods / data.length) * 100
        }
      },
      priceMovement: {
        minPrice,
        maxPrice,
        priceRange: maxPrice - minPrice,
        priceChangePercent: ((maxPrice - minPrice) / minPrice) * 100
      },
      lastSnapshot: data[data.length - 1]
    };
  }

  // 🟢 Métodos para Open Interest
  
  // Obtener histórico de Open Interest
  async getOpenInterestHistory(symbol: string, from: Date, to: Date, limit: number) {
    return this.openInterestRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'DESC' },
      take: limit
    });
  }

  // Análisis de Open Interest para detectar acumulación/distribución
  async getOpenInterestAnalysis(symbol: string, durationHours: number) {
    const from = new Date(Date.now() - durationHours * 60 * 60 * 1000);
    const to = new Date();

    const data = await this.openInterestRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'ASC' }
    });

    if (data.length === 0) {
      return {
        symbol,
        period: `${durationHours} horas`,
        message: 'Sin datos de Open Interest disponibles',
        analysis: null
      };
    }

    // Calcular métricas básicas
    const openInterests = data.map(d => Number(d.open_interest));
    const deltas = data.map(d => Number(d.delta_oi));
    const prices = data.map(d => Number(d.price));

    const startOI = openInterests[0];
    const endOI = openInterests[openInterests.length - 1];
    const totalDeltaOI = endOI - startOI;
    const avgOI = openInterests.reduce((a, b) => a + b, 0) / openInterests.length;

    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const priceChange = endPrice - startPrice;
    const priceChangePercent = (priceChange / startPrice) * 100;

    // Clasificar períodos según delta OI y precio
    const accumulation = data.filter(d => Number(d.delta_oi) > 0 && Math.abs(Number(d.price) - avgOI) < avgOI * 0.02); // OI+ con precio estable
    const distribution = data.filter(d => Number(d.delta_oi) < 0 && Math.abs(Number(d.price) - avgOI) < avgOI * 0.02); // OI- con precio estable
    const bullishAccumulation = data.filter(d => Number(d.delta_oi) > 0 && Number(d.price) > startPrice); // OI+ con precio+
    const bearishAccumulation = data.filter(d => Number(d.delta_oi) > 0 && Number(d.price) < startPrice); // OI+ con precio-
    const longLiquidation = data.filter(d => Number(d.delta_oi) < 0 && Number(d.price) < startPrice); // OI- con precio-
    const shortSqueeze = data.filter(d => Number(d.delta_oi) < 0 && Number(d.price) > startPrice); // OI- con precio+

    // Detectar tendencia principal
    let mainTrend = 'neutral';
    if (totalDeltaOI > 0 && priceChange > 0) mainTrend = 'bullish_accumulation';
    else if (totalDeltaOI > 0 && priceChange < 0) mainTrend = 'bearish_accumulation';
    else if (totalDeltaOI < 0 && priceChange > 0) mainTrend = 'short_squeeze';
    else if (totalDeltaOI < 0 && priceChange < 0) mainTrend = 'long_liquidation';
    else if (totalDeltaOI > 0 && Math.abs(priceChangePercent) < 1) mainTrend = 'accumulation';
    else if (totalDeltaOI < 0 && Math.abs(priceChangePercent) < 1) mainTrend = 'distribution';

    // Calcular volatilidad del OI
    const oiVariance = openInterests.reduce((acc, oi) => acc + Math.pow(oi - avgOI, 2), 0) / openInterests.length;
    const oiStdDev = Math.sqrt(oiVariance);

    return {
      symbol,
      period: `${durationHours} horas`,
      dataPoints: data.length,
      timeRange: {
        from: from.toISOString(),
        to: to.toISOString()
      },
      openInterestMetrics: {
        startOI,
        endOI,
        totalDeltaOI,
        deltaOIPercent: (totalDeltaOI / startOI) * 100,
        averageOI: avgOI,
        volatility: oiStdDev / avgOI, // Coeficiente de variación
        maxOI: Math.max(...openInterests),
        minOI: Math.min(...openInterests)
      },
      priceCorrelation: {
        startPrice,
        endPrice,
        priceChange,
        priceChangePercent,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length
      },
      marketBehavior: {
        mainTrend,
        accumulation: {
          periods: accumulation.length,
          percentage: (accumulation.length / data.length) * 100
        },
        distribution: {
          periods: distribution.length,
          percentage: (distribution.length / data.length) * 100
        },
        bullishAccumulation: {
          periods: bullishAccumulation.length,
          percentage: (bullishAccumulation.length / data.length) * 100
        },
        bearishAccumulation: {
          periods: bearishAccumulation.length,
          percentage: (bearishAccumulation.length / data.length) * 100
        },
        longLiquidation: {
          periods: longLiquidation.length,
          percentage: (longLiquidation.length / data.length) * 100
        },
        shortSqueeze: {
          periods: shortSqueeze.length,
          percentage: (shortSqueeze.length / data.length) * 100
        }
      },
      signals: {
        leverageWarning: oiStdDev / avgOI > 0.3, // Alta volatilidad en OI
        accumulationSignal: accumulation.length > data.length * 0.3, // >30% del tiempo acumulando
        distributionSignal: distribution.length > data.length * 0.3, // >30% del tiempo distribuyendo
        extremeLeverage: endOI > startOI * 2, // OI duplicado
        liquidationRisk: totalDeltaOI < 0 && Math.abs(totalDeltaOI) > startOI * 0.2 // Caída >20% en OI
      },
      lastSnapshot: data[data.length - 1]
    };
  }
} 