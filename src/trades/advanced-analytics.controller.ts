import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { AdvancedAnalyticsService } from './advanced-analytics.service';

@Controller('analytics')
export class AdvancedAnalyticsController {
  constructor(
    private readonly advancedAnalyticsService: AdvancedAnalyticsService
  ) {}

  // 🎯 ========== VOLUME PROFILE ENDPOINTS ==========

  /**
   * Obtener Volume Profile actual
   * GET /analytics/volume-profile?symbol=BTCUSDT&timeframe=1h&levels=50
   */
  @Get('volume-profile')
  async getVolumeProfile(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: string = '1h',
    @Query('levels') levels: string = '50'
  ) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }

    const validTimeframes = ['5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      throw new BadRequestException(`Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`);
    }

    const numLevels = parseInt(levels);
    if (isNaN(numLevels) || numLevels < 10 || numLevels > 200) {
      throw new BadRequestException('Levels must be a number between 10 and 200');
    }

    try {
      return await this.advancedAnalyticsService.getVolumeProfile(symbol.toUpperCase(), timeframe);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Generar nuevo Volume Profile
   * GET /analytics/volume-profile/generate?symbol=BTCUSDT&timeframe=1h&levels=50
   */
  @Get('volume-profile/generate')
  async generateVolumeProfile(
    @Query('symbol') symbol: string,
    @Query('timeframe') timeframe: string = '1h',
    @Query('levels') levels: string = '50'
  ) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }

    const validTimeframes = ['5m', '15m', '1h', '4h', '1d'];
    if (!validTimeframes.includes(timeframe)) {
      throw new BadRequestException(`Invalid timeframe. Valid options: ${validTimeframes.join(', ')}`);
    }

    const numLevels = parseInt(levels);
    if (isNaN(numLevels) || numLevels < 10 || numLevels > 200) {
      throw new BadRequestException('Levels must be a number between 10 and 200');
    }

    try {
      return await this.advancedAnalyticsService.generateVolumeProfile(
        symbol.toUpperCase(), 
        timeframe as any, 
        numLevels
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // 🎯 ========== FEAR & GREED INDEX ENDPOINTS ==========

  /**
   * Obtener Fear & Greed Index actual
   * GET /analytics/fear-greed?symbol=BTCUSDT
   */
  @Get('fear-greed')
  async getFearGreedIndex(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }

    try {
      const sentiment = await this.advancedAnalyticsService.getFearGreedIndex(symbol.toUpperCase());
      
      return {
        symbol: sentiment.symbol,
        timestamp: sentiment.timestamp,
        
        // 🎯 Score principal
        sentimentScore: sentiment.sentiment_score,
        sentimentLevel: sentiment.sentiment_level,
        dominantFactor: sentiment.dominant_factor,
        
        // 🎯 Componentes individuales
        components: {
          fundingRate: {
            score: sentiment.funding_rate_score,
            value: sentiment.current_funding_rate,
            weight: 20
          },
          longShortRatio: {
            score: sentiment.long_short_ratio_score,
            value: sentiment.current_long_short_ratio,
            weight: 15
          },
          liquidations: {
            score: sentiment.liquidation_score,
            volumeLastHour: sentiment.liquidation_volume_1h,
            weight: 20
          },
          openInterest: {
            score: sentiment.open_interest_score,
            change24h: sentiment.oi_change_24h_percent,
            weight: 15
          },
          volume: {
            score: sentiment.volume_score,
            volume24h: sentiment.volume_24h,
            weight: 10
          },
          volatility: {
            score: sentiment.volatility_score,
            volatility24h: sentiment.price_volatility_24h,
            weight: 10
          },
          orderbook: {
            score: sentiment.orderbook_score,
            imbalance: sentiment.orderbook_imbalance,
            weight: 10
          }
        },

        // 🎯 Análisis de tendencias
        trend: {
          direction: sentiment.trend_direction,
          strength: sentiment.trend_strength,
          momentum: sentiment.momentum
        },

        // 🎯 Señales de trading
        signals: {
          tradingSignal: sentiment.trading_signal,
          contrarianStrength: sentiment.contrarian_signal_strength,
          isExtreme: sentiment.is_extreme_condition,
          isCapitulation: sentiment.is_capitulation,
          isEuphoria: sentiment.is_euphoria,
          warning: sentiment.warning_signal
        },

        // 🎯 Comparación histórica
        historical: {
          score1hAgo: sentiment.score_1h_ago,
          score24hAgo: sentiment.score_24h_ago,
          change1h: sentiment.score_change_1h,
          change24h: sentiment.score_change_24h
        },

        // 🎯 Contexto del mercado
        market: {
          currentPrice: sentiment.current_price,
          priceChange24h: sentiment.price_change_24h_percent,
          btcDominance: sentiment.btc_dominance,
          narrative: sentiment.market_narrative
        }
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Calcular nuevo Fear & Greed Index
   * GET /analytics/fear-greed/calculate?symbol=BTCUSDT
   */
  @Get('fear-greed/calculate')
  async calculateFearGreedIndex(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }

    try {
      return await this.advancedAnalyticsService.calculateFearGreedIndex(symbol.toUpperCase());
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Obtener histórico del Fear & Greed Index
   * GET /analytics/fear-greed/history?symbol=BTCUSDT&days=30
   */
  @Get('fear-greed/history')
  async getFearGreedHistory(
    @Query('symbol') symbol: string,
    @Query('days') days: string = '30'
  ) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }

    const numDays = parseInt(days);
    if (isNaN(numDays) || numDays < 1 || numDays > 365) {
      throw new BadRequestException('Days must be a number between 1 and 365');
    }

    try {
      const history = await this.advancedAnalyticsService.getFearGreedHistory(symbol.toUpperCase(), numDays);
      
      return {
        symbol: symbol.toUpperCase(),
        period: `${numDays} days`,
        dataPoints: history.length,
        
        // 🎯 Resumen estadístico
        summary: {
          averageScore: history.reduce((sum, h) => sum + Number(h.sentiment_score), 0) / history.length,
          maxScore: Math.max(...history.map(h => Number(h.sentiment_score))),
          minScore: Math.min(...history.map(h => Number(h.sentiment_score))),
          extremeFearDays: history.filter(h => h.sentiment_level === 'extreme_fear').length,
          fearDays: history.filter(h => h.sentiment_level === 'fear').length,
          neutralDays: history.filter(h => h.sentiment_level === 'neutral').length,
          greedDays: history.filter(h => h.sentiment_level === 'greed').length,
          extremeGreedDays: history.filter(h => h.sentiment_level === 'extreme_greed').length
        },

        // 🎯 Datos históricos
        data: history.map(h => ({
          timestamp: h.timestamp,
          score: h.sentiment_score,
          level: h.sentiment_level,
          dominantFactor: h.dominant_factor,
          tradingSignal: h.trading_signal,
          isExtreme: h.is_extreme_condition,
          price: h.current_price,
          priceChange24h: h.price_change_24h_percent
        }))
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // 🎯 ========== ENDPOINTS COMBINADOS ==========

  /**
   * Dashboard completo con todas las métricas
   * GET /analytics/dashboard?symbol=BTCUSDT
   */
  @Get('dashboard')
  async getAnalyticsDashboard(@Query('symbol') symbol: string) {
    if (!symbol) {
      throw new BadRequestException('Symbol is required');
    }

    try {
      const [volumeProfile, fearGreed] = await Promise.all([
        this.advancedAnalyticsService.getVolumeProfile(symbol.toUpperCase(), '1h'),
        this.advancedAnalyticsService.getFearGreedIndex(symbol.toUpperCase())
      ]);

      return {
        symbol: symbol.toUpperCase(),
        timestamp: new Date(),
        
        // 🎯 Resumen ejecutivo
        summary: {
          marketSentiment: fearGreed.sentiment_level,
          sentimentScore: fearGreed.sentiment_score,
          tradingSignal: fearGreed.trading_signal,
          dominantFactor: fearGreed.dominant_factor,
          isExtremeCondition: fearGreed.is_extreme_condition,
          marketNarrative: fearGreed.market_narrative
        },

        // 🎯 Volume Profile insights
        volumeProfile: {
          poc: (volumeProfile as any).summary?.poc || null,
          valueArea: (volumeProfile as any).summary?.valueArea || null,
          totalLevels: (volumeProfile as any).summary?.totalLevels || 0,
          
          // Niveles clave cerca del precio actual
          keyLevels: Array.isArray((volumeProfile as any).levels) 
            ? (volumeProfile as any).levels
                .filter((level: any) => Math.abs(level.distanceFromCurrent) <= 5) // ±5% del precio actual
                .sort((a: any, b: any) => Math.abs(a.distanceFromCurrent) - Math.abs(b.distanceFromCurrent))
                .slice(0, 10) // Top 10 niveles más cercanos
            : []
        },

        // 🎯 Fear & Greed breakdown
        fearGreed: {
          score: fearGreed.sentiment_score,
          level: fearGreed.sentiment_level,
          components: {
            fundingRate: fearGreed.funding_rate_score,
            longShortRatio: fearGreed.long_short_ratio_score,
            liquidations: fearGreed.liquidation_score,
            openInterest: fearGreed.open_interest_score,
            volume: fearGreed.volume_score,
            volatility: fearGreed.volatility_score,
            orderbook: fearGreed.orderbook_score
          },
          signals: {
            trading: fearGreed.trading_signal,
            contrarian: fearGreed.contrarian_signal_strength,
            capitulation: fearGreed.is_capitulation,
            euphoria: fearGreed.is_euphoria
          }
        },

        // 🎯 Recomendaciones algorítmicas
        recommendations: this.generateRecommendations(fearGreed, volumeProfile)
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  private generateRecommendations(fearGreed: any, volumeProfile: any): any[] {
    const recommendations: any[] = [];

    // Recomendaciones basadas en Fear & Greed
    if (fearGreed.sentiment_level === 'extreme_fear') {
      recommendations.push({
        type: 'opportunity',
        priority: 'high',
        message: 'Extreme Fear detectado - Oportunidad contrarian de compra',
        reasoning: 'Mercado en pánico extremo, históricamente buenos puntos de entrada'
      });
    }

    if (fearGreed.sentiment_level === 'extreme_greed') {
      recommendations.push({
        type: 'warning',
        priority: 'high',
        message: 'Extreme Greed detectado - Considerar toma de ganancias',
        reasoning: 'Mercado en euforia, históricamente buenos puntos de salida'
      });
    }

    if (fearGreed.is_capitulation) {
      recommendations.push({
        type: 'opportunity',
        priority: 'critical',
        message: 'Capitulación del mercado detectada',
        reasoning: 'Liquidaciones masivas + miedo extremo = posible fondo'
      });
    }

    // Recomendaciones basadas en Volume Profile
    const poc = (volumeProfile as any).summary?.poc;
    if (poc) {
      recommendations.push({
        type: 'technical',
        priority: 'medium',
        message: `Point of Control en $${poc.price?.toFixed(2) || 'N/A'}`,
        reasoning: `${poc.percentage?.toFixed(1) || 'N/A'}% del volumen concentrado en este nivel`
      });
    }

    // Combinar señales
    const levels = Array.isArray((volumeProfile as any).levels) ? (volumeProfile as any).levels : [];
    if (fearGreed.trading_signal === 'strong_buy' && levels.some((l: any) => l.levelType === 'support' && Math.abs(l.distanceFromCurrent) < 2)) {
      recommendations.push({
        type: 'signal',
        priority: 'high',
        message: 'Confluencia alcista: Fear extremo + soporte técnico',
        reasoning: 'Múltiples factores sugieren oportunidad de compra'
      });
    }

    return recommendations;
  }
} 