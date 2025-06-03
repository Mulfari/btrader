import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('market_sentiment')
@Index(['symbol', 'timestamp'])
@Index(['sentiment_score']) // Para búsquedas por score
export class MarketSentiment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // 🎯 Score principal del Fear & Greed Index
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  sentiment_score: number; // 0-100 (0=Extreme Fear, 100=Extreme Greed)

  @Column({ type: 'varchar', length: 20 })
  sentiment_level: string; // 'extreme_fear', 'fear', 'neutral', 'greed', 'extreme_greed'

  @Column({ type: 'varchar', length: 50 })
  dominant_factor: string; // Qué métrica está dominando el sentimiento

  // 🎯 Componentes individuales del índice (0-100 cada uno)
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  funding_rate_score: number; // Score basado en funding rates

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  long_short_ratio_score: number; // Score basado en long/short ratio

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  liquidation_score: number; // Score basado en liquidaciones

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  open_interest_score: number; // Score basado en open interest

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  volume_score: number; // Score basado en volumen

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  volatility_score: number; // Score basado en volatilidad

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  orderbook_score: number; // Score basado en orderbook

  // 🎯 Datos de entrada para el cálculo
  @Column({ type: 'decimal', precision: 10, scale: 8 })
  current_funding_rate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  current_long_short_ratio: number;

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  liquidation_volume_1h: number; // Volumen liquidado última hora

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  oi_change_24h_percent: number; // Cambio OI en 24h

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  volume_24h: number; // Volumen 24h

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  price_volatility_24h: number; // Volatilidad precio 24h

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  orderbook_imbalance: number; // Imbalance actual del orderbook

  // 🎯 Análisis de tendencias
  @Column({ type: 'varchar', length: 20 })
  trend_direction: string; // 'bullish', 'bearish', 'sideways'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  trend_strength: number; // Fuerza de la tendencia (0-100)

  @Column({ type: 'boolean' })
  is_extreme_condition: boolean; // Si está en condiciones extremas

  @Column({ type: 'varchar', length: 50, nullable: true })
  warning_signal: string | null; // Señal de advertencia si aplica

  // 🎯 Comparación histórica
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score_1h_ago: number; // Score hace 1 hora

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score_24h_ago: number; // Score hace 24 horas

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score_change_1h: number; // Cambio en 1h

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score_change_24h: number; // Cambio en 24h

  @Column({ type: 'varchar', length: 20 })
  momentum: string; // 'increasing', 'decreasing', 'stable'

  // 🎯 Recomendaciones de trading
  @Column({ type: 'varchar', length: 30 })
  trading_signal: string; // 'strong_buy', 'buy', 'hold', 'sell', 'strong_sell'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  contrarian_signal_strength: number; // Fuerza de señal contrarian

  @Column({ type: 'boolean' })
  is_capitulation: boolean; // Si hay capitulación del mercado

  @Column({ type: 'boolean' })
  is_euphoria: boolean; // Si hay euforia en el mercado

  // 🎯 Contexto del mercado
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  btc_dominance: number; // Dominancia de BTC

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  current_price: number; // Precio actual

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  price_change_24h_percent: number; // Cambio precio 24h

  @Column({ type: 'varchar', length: 100, nullable: true })
  market_narrative: string | null; // Narrativa del mercado

  @CreateDateColumn()
  created_at: Date;
} 