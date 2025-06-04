import { query } from './database.js';
import {
  VolumeProfileLevel,
  VolumeProfileSummary,
  MarketSentiment,
  TradeAggregate,
  Liquidation,
  FundingRate,
  LongShortRatio,
  OpenInterest,
  OrderbookSnapshot,
  MarketSummary,
  TradingOpportunity
} from './types.js';

// 📊 VOLUME PROFILE FUNCTIONS
export async function getVolumeProfile(symbol: string, timeframe?: string, limit: number = 50): Promise<VolumeProfileSummary | null> {
  try {
    let queryText = `
      SELECT * FROM volume_profile 
      WHERE symbol = $1
    `;
    const params: any[] = [symbol.toUpperCase()];
    
    if (timeframe) {
      queryText += ` AND timeframe = $2`;
      params.push(timeframe);
    }
    
    queryText += ` ORDER BY timestamp DESC LIMIT 1`;
    
    const result = await query(queryText, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo Volume Profile:', error);
    throw error;
  }
}

export async function getVolumeProfileLevels(symbol: string, timeframe?: string): Promise<VolumeProfileLevel[]> {
  try {
    // Esta función consultaría una tabla de niveles detallados si existiera
    // Por ahora retornamos los datos del summary parseados
    const profile = await getVolumeProfile(symbol, timeframe);
    if (!profile) return [];
    
    // Convertir el summary en niveles (simulado)
    const levels: VolumeProfileLevel[] = [];
    
    // Agregar PoC
    levels.push({
      id: 1,
      symbol: profile.symbol,
      timestamp: profile.timestamp,
      price_level: profile.poc_price,
      volume: profile.poc_volume,
      volume_percentage: profile.poc_percentage,
      trade_count: Math.floor(profile.total_trades * 0.1), // Estimado
      level_type: 'poc',
      distance_from_current: 0 // Se calcularía con precio actual
    });
    
    return levels;
  } catch (error) {
    console.error('❌ Error obteniendo niveles VP:', error);
    throw error;
  }
}

export async function getVolumeProfileHistory(symbol: string, timeframe?: string, hours: number = 24): Promise<VolumeProfileSummary[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    let queryText = `
      SELECT * FROM volume_profile 
      WHERE symbol = $1 AND timestamp >= $2
    `;
    const params: any[] = [symbol.toUpperCase(), since];
    
    if (timeframe) {
      queryText += ` AND timeframe = $3`;
      params.push(timeframe);
    }
    
    queryText += ` ORDER BY timestamp DESC`;
    
    const result = await query(queryText, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo historial VP:', error);
    throw error;
  }
}

// 😰 MARKET SENTIMENT FUNCTIONS
export async function getMarketSentiment(symbol: string): Promise<MarketSentiment | null> {
  try {
    const result = await query(`
      SELECT * FROM market_sentiment 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol.toUpperCase()]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo Market Sentiment:', error);
    throw error;
  }
}

export async function getFearGreedIndex(symbol: string): Promise<number | null> {
  try {
    const sentiment = await getMarketSentiment(symbol);
    return sentiment ? sentiment.sentiment_score : null;
  } catch (error) {
    console.error('❌ Error obteniendo Fear & Greed Index:', error);
    throw error;
  }
}

export async function getMarketSentimentHistory(symbol: string, hours: number = 24): Promise<MarketSentiment[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const result = await query(`
      SELECT * FROM market_sentiment 
      WHERE symbol = $1 AND timestamp >= $2 
      ORDER BY timestamp DESC
    `, [symbol.toUpperCase(), since]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo historial de sentimiento:', error);
    throw error;
  }
}

// 💰 TRADE AGGREGATE FUNCTIONS
export async function getLatestPrice(symbol: string): Promise<TradeAggregate | null> {
  try {
    const result = await query(`
      SELECT * FROM trade_aggregates_1s 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol.toUpperCase()]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo precio actual:', error);
    throw error;
  }
}

export async function getPriceHistory(symbol: string, hours: number = 24, interval: string = '1m'): Promise<TradeAggregate[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const result = await query(`
      SELECT * FROM trade_aggregates_1s 
      WHERE symbol = $1 AND timestamp >= $2
      ORDER BY timestamp DESC
    `, [symbol.toUpperCase(), since]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo historial de precios:', error);
    throw error;
  }
}

// 💸 LIQUIDATION FUNCTIONS
export async function getRecentLiquidations(symbol: string, minutes: number = 60): Promise<Liquidation[]> {
  try {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    const result = await query(`
      SELECT * FROM liquidations 
      WHERE symbol = $1 AND timestamp >= $2 
      ORDER BY timestamp DESC
    `, [symbol.toUpperCase(), since]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo liquidaciones:', error);
    throw error;
  }
}

export async function getLiquidationClusters(symbol: string, hours: number = 1): Promise<any[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const result = await query(`
      SELECT 
        cluster_id,
        COUNT(*) as liquidation_count,
        SUM(value_usd) as total_value_usd,
        AVG(price) as avg_price,
        MAX(timestamp) as latest_timestamp,
        side
      FROM liquidations 
      WHERE symbol = $1 AND timestamp >= $2 AND cluster_id IS NOT NULL
      GROUP BY cluster_id, side
      ORDER BY total_value_usd DESC
    `, [symbol.toUpperCase(), since]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo clusters de liquidación:', error);
    throw error;
  }
}

export async function getLiquidationVolume24h(symbol: string): Promise<number> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await query(`
      SELECT COALESCE(SUM(value_usd), 0) as total_volume
      FROM liquidations 
      WHERE symbol = $1 AND timestamp >= $2
    `, [symbol.toUpperCase(), since]);
    
    return parseFloat(result.rows[0].total_volume) || 0;
  } catch (error) {
    console.error('❌ Error obteniendo volumen de liquidaciones:', error);
    return 0;
  }
}

// 📈 FUNDING RATE FUNCTIONS
export async function getCurrentFundingRate(symbol: string): Promise<FundingRate | null> {
  try {
    const result = await query(`
      SELECT * FROM funding_rates 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol.toUpperCase()]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo funding rate:', error);
    throw error;
  }
}

export async function getFundingRateHistory(symbol: string, hours: number = 24): Promise<FundingRate[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const result = await query(`
      SELECT * FROM funding_rates 
      WHERE symbol = $1 AND timestamp >= $2 
      ORDER BY timestamp DESC
    `, [symbol.toUpperCase(), since]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo historial de funding rate:', error);
    throw error;
  }
}

// ⚖️ LONG/SHORT RATIO FUNCTIONS
export async function getCurrentLongShortRatio(symbol: string): Promise<LongShortRatio | null> {
  try {
    const result = await query(`
      SELECT * FROM long_short_ratios 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol.toUpperCase()]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo Long/Short ratio:', error);
    throw error;
  }
}

export async function getLongShortRatioHistory(symbol: string, hours: number = 24): Promise<LongShortRatio[]> {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const result = await query(`
      SELECT * FROM long_short_ratios 
      WHERE symbol = $1 AND timestamp >= $2 
      ORDER BY timestamp DESC
    `, [symbol.toUpperCase(), since]);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo historial Long/Short:', error);
    throw error;
  }
}

// 📊 OPEN INTEREST FUNCTIONS
export async function getCurrentOpenInterest(symbol: string): Promise<OpenInterest | null> {
  try {
    const result = await query(`
      SELECT * FROM open_interest 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol.toUpperCase()]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo Open Interest:', error);
    throw error;
  }
}

// 📖 ORDERBOOK FUNCTIONS
export async function getCurrentOrderbook(symbol: string): Promise<OrderbookSnapshot | null> {
  try {
    const result = await query(`
      SELECT * FROM orderbook_snapshots 
      WHERE symbol = $1 
      ORDER BY timestamp DESC 
      LIMIT 1
    `, [symbol.toUpperCase()]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    console.error('❌ Error obteniendo Orderbook:', error);
    throw error;
  }
}

// 🎯 MARKET SUMMARY FUNCTIONS
export async function getMarketSummary(symbol: string): Promise<MarketSummary | null> {
  try {
    // Obtener todos los datos necesarios en paralelo
    const [
      priceData,
      volumeProfile,
      sentiment,
      fundingRate,
      longShortRatio,
      liquidationVolume,
      openInterest
    ] = await Promise.all([
      getLatestPrice(symbol),
      getVolumeProfile(symbol),
      getMarketSentiment(symbol),
      getCurrentFundingRate(symbol),
      getCurrentLongShortRatio(symbol),
      getLiquidationVolume24h(symbol),
      getCurrentOpenInterest(symbol)
    ]);

    if (!priceData) return null;

    // Construir el summary
    const summary: MarketSummary = {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      
      // Price data
      current_price: priceData.close_price,
      price_change_24h: priceData.price_change_1m * 24 * 60, // Aproximado
      price_change_percentage_24h: priceData.price_change_percentage_1m * 24 * 60, // Aproximado
      
      // Volume Profile insights
      volume_profile: {
        poc_price: volumeProfile?.poc_price || 0,
        poc_distance: volumeProfile ? Math.abs(priceData.close_price - volumeProfile.poc_price) : 0,
        value_area_high: volumeProfile?.value_area_high || 0,
        value_area_low: volumeProfile?.value_area_low || 0,
        in_value_area: volumeProfile ? 
          (priceData.close_price >= volumeProfile.value_area_low && 
           priceData.close_price <= volumeProfile.value_area_high) : false,
        volume_gaps: [] // Se calcularía con datos más detallados
      },
      
      // Market Sentiment
      fear_greed_index: sentiment?.sentiment_score || 50,
      sentiment_level: sentiment?.sentiment_level || 'neutral',
      market_bias: sentiment?.market_phase || 'neutral',
      
      // Key metrics
      funding_rate: fundingRate?.current_funding_rate || 0,
      long_short_ratio: longShortRatio?.long_short_ratio || 1,
      liquidations_24h: liquidationVolume,
      open_interest_change: openInterest?.oi_change_percentage_24h || 0,
      
      // Trading signals
      overall_signal: sentiment?.trading_signal as any || 'neutral',
      confidence: sentiment?.confidence_score || 0,
      risk_level: sentiment?.risk_level as any || 'medium'
    };

    return summary;
  } catch (error) {
    console.error('❌ Error generando resumen de mercado:', error);
    throw error;
  }
}

// 🚨 TRADING OPPORTUNITIES FUNCTIONS
export async function findTradingOpportunities(): Promise<TradingOpportunity[]> {
  try {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT'];
    const opportunities: TradingOpportunity[] = [];

    for (const symbol of symbols) {
      const summary = await getMarketSummary(symbol);
      if (!summary) continue;

      // Detectar oportunidades basadas en condiciones
      if (summary.fear_greed_index < 25 && summary.volume_profile.poc_distance < 100) {
        opportunities.push({
          id: `${symbol}_${Date.now()}`,
          symbol,
          timestamp: new Date(),
          type: 'reversal',
          direction: 'long',
          confidence: 0.8,
          risk_reward_ratio: 3,
          entry_price: summary.current_price,
          stop_loss: summary.current_price * 0.98,
          take_profit: summary.volume_profile.value_area_high,
          supporting_factors: ['extreme_fear', 'near_poc'],
          volume_profile_support: true,
          sentiment_support: true,
          liquidation_support: summary.liquidations_24h > 100000,
          max_position_size: 1000,
          expected_duration: '2-6 hours',
          historical_success_rate: 0.75
        });
      }
    }

    return opportunities;
  } catch (error) {
    console.error('❌ Error buscando oportunidades:', error);
    throw error;
  }
}

// 🔧 UTILITY FUNCTIONS
export async function getAvailableSymbols(): Promise<string[]> {
  try {
    const result = await query(`
      SELECT DISTINCT symbol 
      FROM trade_aggregates_1s 
      ORDER BY symbol
    `);
    
    return result.rows.map((row: any) => row.symbol);
  } catch (error) {
    console.error('❌ Error obteniendo símbolos:', error);
    throw error;
  }
}

export async function getDataStatus(): Promise<Record<string, any>> {
  try {
    const [tables, counts] = await Promise.all([
      query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `),
      Promise.all([
        query(`SELECT COUNT(*) as count FROM trade_aggregates_1s WHERE timestamp >= NOW() - INTERVAL '1 hour'`),
        query(`SELECT COUNT(*) as count FROM liquidations WHERE timestamp >= NOW() - INTERVAL '1 hour'`),
        query(`SELECT COUNT(*) as count FROM volume_profile WHERE timestamp >= NOW() - INTERVAL '1 hour'`),
        query(`SELECT COUNT(*) as count FROM market_sentiment WHERE timestamp >= NOW() - INTERVAL '1 hour'`)
      ])
    ]);

    return {
      available_tables: tables.rows.map((r: any) => r.table_name),
      recent_data_counts: {
        trade_aggregates: parseInt(counts[0].rows[0]?.count || '0'),
        liquidations: parseInt(counts[1].rows[0]?.count || '0'),
        volume_profile: parseInt(counts[2].rows[0]?.count || '0'),
        market_sentiment: parseInt(counts[3].rows[0]?.count || '0')
      },
      last_updated: new Date()
    };
  } catch (error) {
    console.error('❌ Error obteniendo estado de datos:', error);
    throw error;
  }
} 