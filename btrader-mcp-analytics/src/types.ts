// 📊 Volume Profile Types
export interface VolumeProfileLevel {
  id: number;
  symbol: string;
  timestamp: Date;
  price_level: number;
  volume: number;
  volume_percentage: number;
  trade_count: number;
  level_type: 'poc' | 'value_area' | 'low_volume' | 'high_volume' | 'support' | 'resistance';
  distance_from_current: number;
}

export interface VolumeProfileSummary {
  id: number;
  symbol: string;
  timestamp: Date;
  timeframe: string;
  price_range_start: number;
  price_range_end: number;
  total_volume: number;
  total_trades: number;
  levels_count: number;
  poc_price: number;
  poc_volume: number;
  poc_percentage: number;
  value_area_high: number;
  value_area_low: number;
  value_area_volume_percentage: number;
  volume_distribution: string;
  market_structure: string;
}

// 😰 Market Sentiment Types  
export interface MarketSentiment {
  id: number;
  symbol: string;
  timestamp: Date;
  sentiment_score: number;
  sentiment_level: string;
  dominant_factor: string;
  market_phase: string;
  trading_signal: string;
  confidence_score: number;
  risk_level: string;
  
  // Datos de entrada
  current_funding_rate: number;
  current_long_short_ratio: number;
  liquidation_volume_1h: number;
  price_volatility_24h: number;
  volume_trend: string;
  
  // Análisis de componentes
  funding_score: number;
  long_short_score: number;
  liquidation_score: number;
  volatility_score: number;
  trend_score: number;
  
  // Interpretación
  market_interpretation: string;
  key_levels: string;
  risk_assessment: string;
  recommended_action: string;
}

// 💰 Trade Aggregate Types
export interface TradeAggregate {
  id: number;
  symbol: string;
  timestamp: Date;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  turnover: number;
  trade_count: number;
  interval: string;
  price_change_1m: number;
  price_change_percentage_1m: number;
  volume_weighted_avg_price: number;
  volatility: number;
  momentum: number;
  trend_direction: string;
}

// 💸 Liquidation Types
export interface Liquidation {
  id: number;
  symbol: string;
  timestamp: Date;
  side: string;
  size: number;
  price: number;
  value_usd: number;
  
  // Análisis de clustering
  cluster_id: string;
  cluster_size: number;
  cluster_value_usd: number;
  cluster_timespan_seconds: number;
  
  // Análisis de mercado
  market_impact_score: number;
  liquidation_cascade_risk: number;
  market_event_type: string;
  price_impact_percentage: number;
  volume_shock_indicator: number;
  market_pressure_type: string;
  reversal_zone_indicator: boolean;
  institutional_activity_score: number;
}

// 📈 Funding Rate Types
export interface FundingRate {
  id: number;
  symbol: string;
  timestamp: Date;
  current_funding_rate: number;
  predicted_funding_rate: number;
  funding_rate_8h_avg: number;
  funding_rate_24h_avg: number;
  
  // Análisis de bias
  market_bias: string;
  bias_strength: number;
  bias_duration_hours: number;
  bias_change_probability: number;
  
  // Señales de reversión
  extreme_funding_alert: boolean;
  funding_divergence_signal: boolean;
  reversal_probability: number;
  reversal_target_price: number;
  
  // Análisis de sentimiento
  long_sentiment_score: number;
  short_sentiment_score: number;
  funding_sentiment_interpretation: string;
  
  // Métricas adicionales
  funding_rate_volatility: number;
  funding_trend_direction: string;
  institutional_positioning: string;
}

// ⚖️ Long/Short Ratio Types
export interface LongShortRatio {
  id: number;
  symbol: string;
  timestamp: Date;
  long_short_ratio: number;
  long_percentage: number;
  short_percentage: number;
  
  // Análisis de sentimiento
  sentiment_level: string;
  sentiment_score: number;
  sentiment_change_24h: number;
  
  // Detectores de extremos
  extreme_greed_indicator: boolean;
  extreme_fear_indicator: boolean;
  fomo_level: number;
  panic_level: number;
  
  // Señales contrarian
  contrarian_signal: string;
  contrarian_strength: number;
  reversal_probability: number;
  
  // Top traders (nota: Bybit no provee estos datos, serán null)
  top_trader_long_short_ratio: number | null;
  top_trader_long_percentage: number | null;
  top_trader_short_percentage: number | null;
}

// 📊 Open Interest Types
export interface OpenInterest {
  id: number;
  symbol: string;
  timestamp: Date;
  open_interest: number;
  oi_change_24h: number;
  oi_change_percentage_24h: number;
  volume_24h: number;
  oi_volume_ratio: number;
  
  // Análisis de tendencia
  trend_signal: string;
  trend_strength: number;
  trend_confirmation: boolean;
  
  // Detección de manipulación
  unusual_oi_activity: boolean;
  manipulation_risk_score: number;
  
  // Niveles clave
  oi_support_level: number;
  oi_resistance_level: number;
  
  // Análisis de momentum
  oi_momentum: number;
  oi_acceleration: number;
  institutional_interest_score: number;
}

// 📖 Orderbook Types
export interface OrderbookSnapshot {
  id: number;
  symbol: string;
  timestamp: Date;
  best_bid: number;
  best_ask: number;
  bid_size: number;
  ask_size: number;
  spread: number;
  spread_percentage: number;
  mid_price: number;
  
  // Análisis de liquidez
  liquidity_score: number;
  liquidity_imbalance: number;
  depth_analysis: string;
  
  // Señales de trading
  orderbook_signal: string;
  pressure_direction: string;
  breakout_probability: number;
}

// 🎯 Market Summary Types
export interface MarketSummary {
  symbol: string;
  timestamp: Date;
  
  // Price data
  current_price: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  
  // Volume Profile insights
  volume_profile: {
    poc_price: number;
    poc_distance: number;
    value_area_high: number;
    value_area_low: number;
    in_value_area: boolean;
    volume_gaps: Array<{start: number, end: number, size: number}>;
  };
  
  // Market Sentiment
  fear_greed_index: number;
  sentiment_level: string;
  market_bias: string;
  
  // Key metrics
  funding_rate: number;
  long_short_ratio: number;
  liquidations_24h: number;
  open_interest_change: number;
  
  // Trading signals
  overall_signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number;
  risk_level: 'low' | 'medium' | 'high';
}

// 🚨 Trading Opportunity Types
export interface TradingOpportunity {
  id: string;
  symbol: string;
  timestamp: Date;
  
  // Opportunity details
  type: 'reversal' | 'breakout' | 'continuation' | 'arbitrage';
  direction: 'long' | 'short';
  confidence: number;
  risk_reward_ratio: number;
  
  // Entry/Exit levels
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  
  // Supporting data
  supporting_factors: string[];
  volume_profile_support: boolean;
  sentiment_support: boolean;
  liquidation_support: boolean;
  
  // Risk metrics
  max_position_size: number;
  expected_duration: string;
  historical_success_rate: number;
} 