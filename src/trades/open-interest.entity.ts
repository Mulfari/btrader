import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('open_interest')
@Index(['symbol', 'timestamp'])
export class OpenInterest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // 🎯 Datos básicos de Open Interest
  @Column({ type: 'decimal', precision: 20, scale: 8 })
  open_interest: number; // Interés abierto total

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  delta_oi: number; // Cambio en OI desde la última actualización

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  delta_oi_percentage: number; // Cambio porcentual en OI

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  oi_change_percent: number; // Cambio porcentual en OI (alias)

  @Column({ type: 'decimal', precision: 15, scale: 8 })
  price: number; // Precio al momento del snapshot

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  price_change: number; // Cambio de precio

  @Column({ type: 'decimal', precision: 5, scale: 4 })
  price_change_percentage: number; // Cambio porcentual de precio

  // 🎯 Métricas derivadas
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  oi_value_usd: number; // Valor del OI en USD

  @Column({ type: 'decimal', precision: 15, scale: 8, nullable: true })
  oi_weighted_price: number; // Precio ponderado por OI

  @Column({ type: 'varchar', length: 20, nullable: true })
  oi_trend: string; // 'increasing', 'decreasing', 'stable'

  // 🎯 Análisis de correlación OI-Precio
  @Column({ type: 'varchar', length: 30, nullable: true })
  market_behavior: string; // 'accumulation', 'distribution', 'long_liquidation', 'short_squeeze'

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  oi_price_correlation: number; // Correlación entre cambios de OI y precio

  @Column({ type: 'boolean', nullable: true })
  is_bullish_signal: boolean; // OI+ con Precio+

  @Column({ type: 'boolean', nullable: true })
  is_bearish_signal: boolean; // OI+ con Precio-

  @Column({ type: 'boolean', nullable: true })
  is_squeeze_signal: boolean; // OI- con Precio+

  @Column({ type: 'boolean', nullable: true })
  is_liquidation_signal: boolean; // OI- con Precio-

  // 🎯 Niveles relativos
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  oi_24h_high: number; // OI máximo en 24h

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  oi_24h_low: number; // OI mínimo en 24h

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  oi_24h_avg: number; // OI promedio en 24h

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  oi_percentile_24h: number; // Percentil del OI actual vs 24h

  // 🎯 Volatilidad y riesgo
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  oi_volatility_1h: number; // Volatilidad del OI en 1h

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  oi_volatility_24h: number; // Volatilidad del OI en 24h

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  leverage_ratio: number; // Ratio de apalancamiento implícito

  @Column({ type: 'varchar', length: 20, nullable: true })
  risk_level: string; // 'low', 'medium', 'high', 'extreme'

  // 🎯 Contexto temporal
  @Column({ type: 'varchar', length: 20, nullable: true })
  timeframe: string; // '1m', '5m', '15m', '1h', '4h', '1d'

  @Column({ type: 'integer', nullable: true })
  data_quality_score: number; // Score de calidad de los datos (0-100)

  // 🎯 Campos adicionales requeridos por el código
  @Column({ type: 'bigint' })
  next_time: number; // Timestamp de la próxima actualización

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  volume_24h: number; // Volumen en 24 horas

  @CreateDateColumn()
  created_at: Date;
} 