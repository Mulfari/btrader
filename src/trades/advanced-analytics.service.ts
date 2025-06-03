import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { VolumeProfile } from './volume-profile.entity';
import { MarketSentiment } from './market-sentiment.entity';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';
import { LongShortRatio } from './long-short-ratio.entity';
import { Liquidation } from './liquidation.entity';

@Injectable()
export class AdvancedAnalyticsService {
  constructor(
    @InjectRepository(VolumeProfile)
    private volumeProfileRepository: Repository<VolumeProfile>,
    @InjectRepository(MarketSentiment)
    private marketSentimentRepository: Repository<MarketSentiment>,
    @InjectRepository(TradeAggregate)
    private tradeRepository: Repository<TradeAggregate>,
    @InjectRepository(OrderbookSnapshot)
    private orderbookRepository: Repository<OrderbookSnapshot>,
    @InjectRepository(OpenInterest)
    private openInterestRepository: Repository<OpenInterest>,
    @InjectRepository(FundingRate)
    private fundingRateRepository: Repository<FundingRate>,
    @InjectRepository(LongShortRatio)
    private longShortRatioRepository: Repository<LongShortRatio>,
    @InjectRepository(Liquidation)
    private liquidationRepository: Repository<Liquidation>,
  ) {}

  // 🎯 ========== VOLUME PROFILE ANALYSIS ==========

  /**
   * Genera Volume Profile usando datos de trading históricos
   */
  async generateVolumeProfile(
    symbol: string, 
    timeframe: '5m' | '15m' | '1h' | '4h' | '1d',
    priceLevels: number = 50
  ) {
    const timeframeDuration = this.getTimeframeDuration(timeframe);
    const from = new Date(Date.now() - timeframeDuration);
    const to = new Date();

    // Obtener datos de trading
    const trades = await this.tradeRepository.find({
      where: {
        symbol,
        timestamp: Between(from, to)
      },
      order: { timestamp: 'ASC' }
    });

    if (trades.length === 0) {
      throw new Error(`No hay datos de trading para ${symbol} en el timeframe ${timeframe}`);
    }

    // Determinar rango de precios
    const prices = trades.map(t => Number(t.vwap));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    const levelSize = priceRange / priceLevels;

    // Crear niveles de precio
    const volumeByLevel = new Map<number, {
      totalVolume: number;
      buyVolume: number;
      sellVolume: number;
      tradeCount: number;
      timeSpent: number;
      touches: number;
      rejections: number;
    }>();

    // Inicializar niveles
    for (let i = 0; i < priceLevels; i++) {
      const priceLevel = minPrice + (i * levelSize);
      volumeByLevel.set(priceLevel, {
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        tradeCount: 0,
        timeSpent: 0,
        touches: 0,
        rejections: 0
      });
    }

    // Procesar cada trade
    for (const trade of trades) {
      const price = Number(trade.vwap);
      const nearestLevel = this.findNearestPriceLevel(price, minPrice, levelSize);
      
      const levelData = volumeByLevel.get(nearestLevel);
      if (levelData) {
        levelData.totalVolume += Number(trade.buy_volume) + Number(trade.sell_volume);
        levelData.buyVolume += Number(trade.buy_volume);
        levelData.sellVolume += Number(trade.sell_volume);
        levelData.tradeCount += trade.buy_count + trade.sell_count;
      }
    }

    // Calcular métricas del Volume Profile
    const totalVolume = Array.from(volumeByLevel.values()).reduce((sum, level) => sum + level.totalVolume, 0);
    
    // Encontrar Point of Control (nivel con más volumen)
    let pocLevel = minPrice;
    let maxVolumeInLevel = 0;
    
    for (const [level, data] of volumeByLevel) {
      if (data.totalVolume > maxVolumeInLevel) {
        maxVolumeInLevel = data.totalVolume;
        pocLevel = level;
      }
    }

    // Calcular Value Area (70% del volumen)
    const volumePercentages = new Map<number, number>();
    for (const [level, data] of volumeByLevel) {
      volumePercentages.set(level, (data.totalVolume / totalVolume) * 100);
    }

    const valueAreaLevels = this.calculateValueArea(volumePercentages, pocLevel);

    // Obtener precio actual
    const currentPrice = prices[prices.length - 1];

    // Guardar en base de datos
    const volumeProfiles: VolumeProfile[] = [];
    
    for (const [priceLevel, data] of volumeByLevel) {
      const volumePercentage = (data.totalVolume / totalVolume) * 100;
      
      const volumeProfile = new VolumeProfile();
      volumeProfile.symbol = symbol;
      volumeProfile.timestamp = new Date();
      volumeProfile.timeframe = timeframe;
      volumeProfile.price_range_start = minPrice;
      volumeProfile.price_range_end = maxPrice;
      volumeProfile.price_levels = priceLevels;
      volumeProfile.price_level = priceLevel;
      volumeProfile.total_volume = data.totalVolume;
      volumeProfile.buy_volume = data.buyVolume;
      volumeProfile.sell_volume = data.sellVolume;
      volumeProfile.trade_count = data.tradeCount;
      volumeProfile.volume_percentage = volumePercentage;
      volumeProfile.is_poc = priceLevel === pocLevel;
      volumeProfile.is_value_area_high = priceLevel === valueAreaLevels.high;
      volumeProfile.is_value_area_low = priceLevel === valueAreaLevels.low;
      volumeProfile.is_value_area = valueAreaLevels.levels.includes(priceLevel);
      volumeProfile.is_high_volume_node = volumePercentage > 5; // >5% del volumen total
      volumeProfile.is_low_volume_node = volumePercentage < 1; // <1% del volumen total
      volumeProfile.level_type = this.determineLevelType(priceLevel, currentPrice, data);
      volumeProfile.strength_score = this.calculateStrengthScore(volumePercentage, data);
      volumeProfile.buy_sell_ratio = data.sellVolume > 0 ? data.buyVolume / data.sellVolume : data.buyVolume;
      volumeProfile.current_price = currentPrice;
      volumeProfile.distance_from_current = ((priceLevel - currentPrice) / currentPrice) * 100;
      volumeProfile.price_action = this.determinePriceAction(priceLevel, currentPrice, data);
      volumeProfile.time_spent_seconds = data.timeSpent;
      volumeProfile.time_percentage = (data.timeSpent / timeframeDuration) * 100;
      volumeProfile.touches_count = data.touches;
      volumeProfile.rejection_percentage = data.touches > 0 ? (data.rejections / data.touches) * 100 : 0;

      volumeProfiles.push(volumeProfile);
    }

    // Guardar todos los niveles
    await this.volumeProfileRepository.save(volumeProfiles);

    return {
      symbol,
      timeframe,
      priceRange: { min: minPrice, max: maxPrice },
      totalVolume,
      pocLevel,
      valueArea: valueAreaLevels,
      currentPrice,
      levels: volumeProfiles.length,
      analysis: {
        dominantLevels: volumeProfiles.filter(vp => vp.is_high_volume_node).length,
        supportLevels: volumeProfiles.filter(vp => vp.level_type === 'support').length,
        resistanceLevels: volumeProfiles.filter(vp => vp.level_type === 'resistance').length,
        gapAreas: volumeProfiles.filter(vp => vp.is_low_volume_node).length
      }
    };
  }

  // 🎯 ========== FEAR & GREED INDEX ==========

  /**
   * Calcula el Fear & Greed Index compuesto
   */
  async calculateFearGreedIndex(symbol: string): Promise<MarketSentiment> {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 🎯 Obtener últimos datos de cada métrica
    const [
      latestFundingRate,
      latestLongShortRatio,
      recentLiquidations,
      latestOpenInterest,
      recentTrades,
      latestOrderbook
    ] = await Promise.all([
      this.fundingRateRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' }
      }),
      this.longShortRatioRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' }
      }),
      this.liquidationRepository.find({
        where: {
          symbol,
          timestamp: Between(oneHourAgo, now)
        }
      }),
      this.openInterestRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' }
      }),
      this.tradeRepository.find({
        where: {
          symbol,
          timestamp: Between(oneDayAgo, now)
        },
        order: { timestamp: 'DESC' },
        take: 100
      }),
      this.orderbookRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' }
      })
    ]);

    // 🎯 Calcular scores individuales (0-100)
    const fundingRateScore = this.calculateFundingRateScore(latestFundingRate);
    const longShortRatioScore = this.calculateLongShortRatioScore(latestLongShortRatio);
    const liquidationScore = this.calculateLiquidationScore(recentLiquidations);
    const openInterestScore = await this.calculateOpenInterestScore(symbol, latestOpenInterest);
    const volumeScore = this.calculateVolumeScore(recentTrades);
    const volatilityScore = this.calculateVolatilityScore(recentTrades);
    const orderbookScore = this.calculateOrderbookScore(latestOrderbook);

    // 🎯 Pesos para cada componente (deben sumar 100)
    const weights = {
      fundingRate: 20,
      longShortRatio: 15,
      liquidation: 20,
      openInterest: 15,
      volume: 10,
      volatility: 10,
      orderbook: 10
    };

    // 🎯 Calcular score compuesto
    const sentimentScore = (
      (fundingRateScore * weights.fundingRate) +
      (longShortRatioScore * weights.longShortRatio) +
      (liquidationScore * weights.liquidation) +
      (openInterestScore * weights.openInterest) +
      (volumeScore * weights.volume) +
      (volatilityScore * weights.volatility) +
      (orderbookScore * weights.orderbook)
    ) / 100;

    // 🎯 Determinar nivel de sentimiento
    const sentimentLevel = this.getSentimentLevel(sentimentScore);
    const dominantFactor = this.getDominantFactor({
      fundingRate: fundingRateScore,
      longShortRatio: longShortRatioScore,
      liquidation: liquidationScore,
      openInterest: openInterestScore,
      volume: volumeScore,
      volatility: volatilityScore,
      orderbook: orderbookScore
    });

    // 🎯 Obtener datos históricos para comparación
    const previousSentiment = await this.marketSentimentRepository.findOne({
      where: {
        symbol,
        timestamp: Between(new Date(now.getTime() - 2 * 60 * 60 * 1000), oneHourAgo)
      },
      order: { timestamp: 'DESC' }
    });

    const yesterdaySentiment = await this.marketSentimentRepository.findOne({
      where: {
        symbol,
        timestamp: Between(new Date(now.getTime() - 25 * 60 * 60 * 1000), oneDayAgo)
      },
      order: { timestamp: 'DESC' }
    });

    // 🎯 Calcular análisis de tendencias
    const trendAnalysis = this.analyzeTrend(recentTrades);
    const tradingSignal = this.generateTradingSignal(sentimentScore, sentimentLevel, trendAnalysis);

    // 🎯 Crear entidad MarketSentiment
    const marketSentiment = new MarketSentiment();
    marketSentiment.symbol = symbol;
    marketSentiment.timestamp = now;
    marketSentiment.sentiment_score = sentimentScore;
    marketSentiment.sentiment_level = sentimentLevel;
    marketSentiment.dominant_factor = dominantFactor;
    
    // Componentes individuales
    marketSentiment.funding_rate_score = fundingRateScore;
    marketSentiment.long_short_ratio_score = longShortRatioScore;
    marketSentiment.liquidation_score = liquidationScore;
    marketSentiment.open_interest_score = openInterestScore;
    marketSentiment.volume_score = volumeScore;
    marketSentiment.volatility_score = volatilityScore;
    marketSentiment.orderbook_score = orderbookScore;

    // Datos de entrada
    marketSentiment.current_funding_rate = latestFundingRate?.current_funding_rate || 0;
    marketSentiment.current_long_short_ratio = latestLongShortRatio?.long_short_ratio || 1;
    marketSentiment.liquidation_volume_1h = recentLiquidations.reduce((sum, liq) => sum + Number(liq.value_usd), 0);
    marketSentiment.oi_change_24h_percent = await this.calculateOIChange24h(symbol);
    marketSentiment.volume_24h = recentTrades.reduce((sum, trade) => sum + Number(trade.buy_volume) + Number(trade.sell_volume), 0);
    marketSentiment.price_volatility_24h = volatilityScore;
    marketSentiment.orderbook_imbalance = latestOrderbook?.imbalance || 0;

    // Análisis de tendencias
    marketSentiment.trend_direction = trendAnalysis.direction;
    marketSentiment.trend_strength = trendAnalysis.strength;
    marketSentiment.is_extreme_condition = sentimentScore <= 20 || sentimentScore >= 80;
    marketSentiment.warning_signal = this.generateWarningSignal(sentimentScore, sentimentLevel);

    // Comparación histórica
    marketSentiment.score_1h_ago = previousSentiment?.sentiment_score || sentimentScore;
    marketSentiment.score_24h_ago = yesterdaySentiment?.sentiment_score || sentimentScore;
    marketSentiment.score_change_1h = sentimentScore - (previousSentiment?.sentiment_score || sentimentScore);
    marketSentiment.score_change_24h = sentimentScore - (yesterdaySentiment?.sentiment_score || sentimentScore);
    marketSentiment.momentum = this.calculateMomentum(marketSentiment.score_change_1h, marketSentiment.score_change_24h);

    // Recomendaciones de trading
    marketSentiment.trading_signal = tradingSignal;
    marketSentiment.contrarian_signal_strength = this.calculateContrarianStrength(sentimentScore);
    marketSentiment.is_capitulation = sentimentScore <= 20 && liquidationScore >= 80;
    marketSentiment.is_euphoria = sentimentScore >= 80 && fundingRateScore >= 80;

    // Contexto del mercado
    marketSentiment.btc_dominance = 50; // Placeholder - se calcularía con datos reales
    marketSentiment.current_price = recentTrades[0]?.vwap || 0;
    marketSentiment.price_change_24h_percent = this.calculatePriceChange24h(recentTrades);
    marketSentiment.market_narrative = this.generateMarketNarrative(sentimentLevel, dominantFactor);

    // Guardar en base de datos
    await this.marketSentimentRepository.save(marketSentiment);

    return marketSentiment;
  }

  // 🎯 ========== MÉTODOS DE UTILIDAD ==========

  private getTimeframeDuration(timeframe: string): number {
    const durations = {
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return durations[timeframe] || durations['1h'];
  }

  private findNearestPriceLevel(price: number, minPrice: number, levelSize: number): number {
    const levelIndex = Math.floor((price - minPrice) / levelSize);
    return minPrice + (levelIndex * levelSize);
  }

  private calculateValueArea(volumePercentages: Map<number, number>, pocLevel: number) {
    // Ordenar niveles por volumen descendente
    const sortedLevels = Array.from(volumePercentages.entries())
      .sort((a, b) => b[1] - a[1]);

    const valueAreaLevels: number[] = [];
    let cumulativeVolume = 0;
    
    // Agregar niveles hasta llegar al 70% del volumen
    for (const [level, percentage] of sortedLevels) {
      valueAreaLevels.push(level);
      cumulativeVolume += percentage;
      if (cumulativeVolume >= 70) break;
    }

    return {
      levels: valueAreaLevels,
      high: Math.max(...valueAreaLevels),
      low: Math.min(...valueAreaLevels)
    };
  }

  private determineLevelType(priceLevel: number, currentPrice: number, data: any): string {
    const distance = Math.abs(priceLevel - currentPrice) / currentPrice;
    
    if (distance < 0.01) return 'magnet'; // Muy cerca del precio actual
    if (priceLevel > currentPrice && data.buyVolume > data.sellVolume) return 'resistance';
    if (priceLevel < currentPrice && data.sellVolume > data.buyVolume) return 'support';
    return 'neutral';
  }

  private calculateStrengthScore(volumePercentage: number, data: any): number {
    // Score basado en volumen + ratio compra/venta + número de trades
    const volumeScore = Math.min(volumePercentage * 10, 50); // Máximo 50 puntos
    const ratioScore = Math.min(Math.abs(data.buyVolume - data.sellVolume) / (data.buyVolume + data.sellVolume) * 25, 25); // Máximo 25 puntos
    const tradeScore = Math.min(data.tradeCount / 10, 25); // Máximo 25 puntos
    
    return volumeScore + ratioScore + tradeScore;
  }

  private determinePriceAction(priceLevel: number, currentPrice: number, data: any): string {
    const distance = Math.abs(priceLevel - currentPrice) / currentPrice;
    
    if (distance < 0.005) return 'testing'; // Muy cerca
    if (data.buyVolume > data.sellVolume * 1.5) return 'accepting';
    if (data.sellVolume > data.buyVolume * 1.5) return 'rejecting';
    return 'neutral';
  }

  // Continuaré implementando los métodos de cálculo para el Fear & Greed Index...
  // [Los métodos restantes se implementarían aquí]

  private calculateFundingRateScore(fundingRate: FundingRate | null): number {
    if (!fundingRate) return 50; // Neutral si no hay datos
    
    const rate = Number(fundingRate.current_funding_rate);
    
    // Funding rate extremadamente positivo (>0.1%) = Greed = 80-100
    // Funding rate positivo (0.01% - 0.1%) = Moderate Greed = 60-80
    // Funding rate neutral (-0.01% - 0.01%) = Neutral = 40-60
    // Funding rate negativo (-0.1% - -0.01%) = Moderate Fear = 20-40
    // Funding rate extremadamente negativo (<-0.1%) = Fear = 0-20
    
    if (rate > 0.001) return Math.min(80 + (rate * 20000), 100);
    if (rate > 0.0001) return 60 + (rate * 20000);
    if (rate > -0.0001) return 50;
    if (rate > -0.001) return 40 + (rate * 20000);
    return Math.max(0, 20 + (rate * 20000));
  }

  private calculateLongShortRatioScore(longShortRatio: LongShortRatio | null): number {
    if (!longShortRatio) return 50;
    
    const ratio = Number(longShortRatio.long_short_ratio);
    
    // Ratio > 2 = Extreme Greed = 90-100
    // Ratio 1.5-2 = Greed = 70-90
    // Ratio 0.8-1.5 = Neutral = 30-70
    // Ratio 0.5-0.8 = Fear = 10-30
    // Ratio < 0.5 = Extreme Fear = 0-10
    
    if (ratio > 2) return Math.min(90 + ((ratio - 2) * 10), 100);
    if (ratio > 1.5) return 70 + ((ratio - 1.5) * 40);
    if (ratio > 0.8) return 30 + ((ratio - 0.8) * 57.14);
    if (ratio > 0.5) return 10 + ((ratio - 0.5) * 66.67);
    return Math.max(0, ratio * 20);
  }

  private calculateLiquidationScore(liquidations: Liquidation[]): number {
    if (liquidations.length === 0) return 50;
    
    const totalLiquidationValue = liquidations.reduce((sum, liq) => sum + Number(liq.value_usd), 0);
    const averageLiquidation = totalLiquidationValue / liquidations.length;
    
    // Muchas liquidaciones grandes = Fear
    // Pocas liquidaciones = Neutral/Greed
    
    if (totalLiquidationValue > 10000000) return Math.max(0, 30 - (totalLiquidationValue / 1000000)); // > $10M = Fear
    if (totalLiquidationValue > 1000000) return 30 + ((10000000 - totalLiquidationValue) / 9000000 * 20);
    return 50 + Math.min((1000000 - totalLiquidationValue) / 20000, 30); // Pocas liquidaciones = Greed
  }

  private async calculateOpenInterestScore(symbol: string, latestOI: OpenInterest | null): Promise<number> {
    if (!latestOI) return 50;
    
    // Obtener OI de hace 24h para calcular cambio
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const previousOI = await this.openInterestRepository.findOne({
      where: {
        symbol,
        timestamp: Between(new Date(yesterday.getTime() - 60 * 60 * 1000), yesterday)
      },
      order: { timestamp: 'DESC' }
    });
    
    if (!previousOI) return 50;
    
    const currentOI = Number(latestOI.open_interest);
    const prevOI = Number(previousOI.open_interest);
    const changePercent = ((currentOI - prevOI) / prevOI) * 100;
    
    // OI creciendo mucho = Greed
    // OI cayendo mucho = Fear
    
    if (changePercent > 20) return Math.min(90 + (changePercent - 20), 100);
    if (changePercent > 5) return 70 + ((changePercent - 5) * 1.33);
    if (changePercent > -5) return 50 + (changePercent * 2);
    if (changePercent > -20) return 30 + ((changePercent + 20) * 1.33);
    return Math.max(0, 10 + (changePercent + 20));
  }

  private calculateVolumeScore(trades: TradeAggregate[]): number {
    if (trades.length === 0) return 50;
    
    const totalVolume = trades.reduce((sum, trade) => sum + Number(trade.buy_volume) + Number(trade.sell_volume), 0);
    const averageVolume = totalVolume / trades.length;
    
    // Volumen alto = Greed (interés)
    // Volumen bajo = Fear (apatía)
    
    // Esto se calibraría con datos históricos reales
    if (averageVolume > 100000) return Math.min(70 + (averageVolume / 10000), 100);
    if (averageVolume > 50000) return 50 + (averageVolume / 2500);
    return Math.max(20, 50 - ((50000 - averageVolume) / 1666.67));
  }

  private calculateVolatilityScore(trades: TradeAggregate[]): number {
    if (trades.length < 2) return 50;
    
    const prices = trades.map(t => Number(t.vwap));
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / avgPrice;
    
    // Alta volatilidad = podría ser Fear o Greed dependiendo del contexto
    // Para simplicidad, alta volatilidad = Greed (actividad)
    
    const volatilityPercent = volatility * 100;
    
    if (volatilityPercent > 5) return Math.min(80 + (volatilityPercent - 5) * 4, 100);
    if (volatilityPercent > 2) return 60 + ((volatilityPercent - 2) * 6.67);
    if (volatilityPercent > 0.5) return 40 + ((volatilityPercent - 0.5) * 13.33);
    return Math.max(20, 40 - ((0.5 - volatilityPercent) * 40));
  }

  private calculateOrderbookScore(orderbook: OrderbookSnapshot | null): number {
    if (!orderbook) return 50;
    
    const imbalance = Number(orderbook.imbalance);
    
    // Imbalance positivo fuerte = Greed (más bids)
    // Imbalance negativo fuerte = Fear (más asks)
    
    if (imbalance > 20) return Math.min(80 + (imbalance - 20), 100);
    if (imbalance > 5) return 60 + ((imbalance - 5) * 1.33);
    if (imbalance > -5) return 50 + (imbalance * 2);
    if (imbalance > -20) return 30 + ((imbalance + 20) * 1.33);
    return Math.max(0, 10 + (imbalance + 20));
  }

  private getSentimentLevel(score: number): string {
    if (score >= 80) return 'extreme_greed';
    if (score >= 60) return 'greed';
    if (score >= 40) return 'neutral';
    if (score >= 20) return 'fear';
    return 'extreme_fear';
  }

  private getDominantFactor(scores: { [key: string]: number }): string {
    const maxScore = Math.max(...Object.values(scores));
    const dominantFactors = Object.entries(scores).filter(([_, score]) => score === maxScore);
    return dominantFactors[0][0];
  }

  private analyzeTrend(trades: TradeAggregate[]): { direction: string; strength: number } {
    if (trades.length < 5) return { direction: 'sideways', strength: 0 };
    
    const recentPrices = trades.slice(-10).map(t => Number(t.vwap));
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const priceChange = (lastPrice - firstPrice) / firstPrice;
    
    let direction = 'sideways';
    if (priceChange > 0.02) direction = 'bullish';
    else if (priceChange < -0.02) direction = 'bearish';
    
    const strength = Math.min(Math.abs(priceChange) * 1000, 100);
    
    return { direction, strength };
  }

  private generateTradingSignal(score: number, level: string, trend: { direction: string; strength: number }): string {
    if (level === 'extreme_fear' && trend.direction !== 'bearish') return 'strong_buy';
    if (level === 'fear') return 'buy';
    if (level === 'extreme_greed' && trend.direction !== 'bullish') return 'strong_sell';
    if (level === 'greed') return 'sell';
    return 'hold';
  }

  private async calculateOIChange24h(symbol: string): Promise<number> {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const [current, previous] = await Promise.all([
      this.openInterestRepository.findOne({
        where: { symbol },
        order: { timestamp: 'DESC' }
      }),
      this.openInterestRepository.findOne({
        where: {
          symbol,
          timestamp: Between(new Date(yesterday.getTime() - 60 * 60 * 1000), yesterday)
        },
        order: { timestamp: 'DESC' }
      })
    ]);
    
    if (!current || !previous) return 0;
    
    const currentOI = Number(current.open_interest);
    const prevOI = Number(previous.open_interest);
    
    return ((currentOI - prevOI) / prevOI) * 100;
  }

  private calculateMomentum(change1h: number, change24h: number): string {
    if (Math.abs(change1h) < 2 && Math.abs(change24h) < 5) return 'stable';
    if (change1h > 0 && change24h > 0) return 'increasing';
    if (change1h < 0 && change24h < 0) return 'decreasing';
    return 'volatile';
  }

  private calculateContrarianStrength(score: number): number {
    // Contrarian signal más fuerte en extremos
    if (score <= 20 || score >= 80) return 80 + Math.abs(50 - score) * 0.4;
    if (score <= 30 || score >= 70) return 60 + Math.abs(50 - score) * 0.5;
    return Math.abs(50 - score);
  }

  private generateWarningSignal(score: number, level: string): string | null {
    if (level === 'extreme_fear') return 'market_capitulation_possible';
    if (level === 'extreme_greed') return 'market_euphoria_warning';
    if (score <= 10) return 'extreme_oversold_condition';
    if (score >= 90) return 'extreme_overbought_condition';
    return null;
  }

  private calculatePriceChange24h(trades: TradeAggregate[]): number {
    if (trades.length < 2) return 0;
    
    const sortedTrades = trades.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const firstPrice = Number(sortedTrades[0].vwap);
    const lastPrice = Number(sortedTrades[sortedTrades.length - 1].vwap);
    
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }

  private generateMarketNarrative(level: string, dominantFactor: string): string | null {
    const narratives = {
      extreme_fear: `Pánico extremo dominado por ${dominantFactor}`,
      fear: `Miedo en el mercado, impulsado por ${dominantFactor}`,
      neutral: `Mercado neutral con ${dominantFactor} como factor principal`,
      greed: `Codicia en el mercado, liderada por ${dominantFactor}`,
      extreme_greed: `Euforia extrema dominada por ${dominantFactor}`
    };
    
    return narratives[level] || null;
  }

  // 🎯 ========== ENDPOINTS PÚBLICOS ==========

  /**
   * Obtener Volume Profile actual
   */
  async getVolumeProfile(symbol: string, timeframe: string = '1h') {
    const latest = await this.volumeProfileRepository.find({
      where: { symbol, timeframe },
      order: { timestamp: 'DESC' },
      take: 100 // Últimos 100 niveles
    });

    if (latest.length === 0) {
      // Generar si no existe
      return await this.generateVolumeProfile(symbol, timeframe as any);
    }

    return this.formatVolumeProfileResponse(latest);
  }

  /**
   * Obtener Fear & Greed Index actual
   */
  async getFearGreedIndex(symbol: string) {
    let latest = await this.marketSentimentRepository.findOne({
      where: { symbol },
      order: { timestamp: 'DESC' }
    });

    if (!latest || this.isStale(latest.timestamp)) {
      // Calcular nuevo si no existe o está desactualizado
      latest = await this.calculateFearGreedIndex(symbol);
    }

    return latest;
  }

  /**
   * Obtener histórico del Fear & Greed Index
   */
  async getFearGreedHistory(symbol: string, days: number = 30) {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return await this.marketSentimentRepository.find({
      where: {
        symbol,
        timestamp: Between(from, new Date())
      },
      order: { timestamp: 'ASC' }
    });
  }

  private formatVolumeProfileResponse(volumeProfile: VolumeProfile[]) {
    const poc = volumeProfile.find(vp => vp.is_poc);
    const valueAreaHigh = volumeProfile.find(vp => vp.is_value_area_high);
    const valueAreaLow = volumeProfile.find(vp => vp.is_value_area_low);
    const valueAreaLevels = volumeProfile.filter(vp => vp.is_value_area);
    
    return {
      symbol: volumeProfile[0]?.symbol,
      timeframe: volumeProfile[0]?.timeframe,
      timestamp: volumeProfile[0]?.timestamp,
      summary: {
        poc: poc ? {
          price: poc.price_level,
          volume: poc.total_volume,
          percentage: poc.volume_percentage
        } : null,
        valueArea: {
          high: valueAreaHigh?.price_level,
          low: valueAreaLow?.price_level,
          levels: valueAreaLevels.length
        },
        totalLevels: volumeProfile.length,
        priceRange: {
          min: volumeProfile[0]?.price_range_start,
          max: volumeProfile[0]?.price_range_end
        }
      },
      levels: volumeProfile.map(vp => ({
        price: vp.price_level,
        volume: vp.total_volume,
        buyVolume: vp.buy_volume,
        sellVolume: vp.sell_volume,
        percentage: vp.volume_percentage,
        isPOC: vp.is_poc,
        isValueArea: vp.is_value_area,
        isHighVolume: vp.is_high_volume_node,
        isLowVolume: vp.is_low_volume_node,
        levelType: vp.level_type,
        strength: vp.strength_score,
        distanceFromCurrent: vp.distance_from_current
      }))
    };
  }

  private isStale(timestamp: Date): boolean {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return timestamp < fiveMinutesAgo;
  }
} 