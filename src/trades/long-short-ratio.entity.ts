import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('long_short_ratios')
@Index(['symbol', 'timestamp'])
export class LongShortRatio {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // 🎯 Ratios principales
  @Column({ type: 'decimal', precision: 10, scale: 6 })
  long_short_ratio: number; // Ratio total de posiciones long/short

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  long_account_ratio: number; // % de cuentas en long

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  short_account_ratio: number; // % de cuentas en short

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  top_trader_long_ratio: number | null; // Ratio de top traders en long (si disponible)

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  top_trader_short_ratio: number | null; // Ratio de top traders en short (si disponible)

  // 🎯 Análisis de sentimiento
  @Column({ type: 'varchar', length: 20 })
  market_sentiment: string; // 'extreme_greed', 'greed', 'neutral', 'fear', 'extreme_fear'

  @Column({ type: 'decimal', precision: 8, scale: 4 })
  sentiment_score: number; // Score de sentimiento (-100 a 100)

  @Column({ type: 'boolean' })
  is_extreme_long: boolean; // Si hay exceso extremo de longs

  @Column({ type: 'boolean' })
  is_extreme_short: boolean; // Si hay exceso extremo de shorts

  // 🎯 Señales contrarias
  @Column({ type: 'varchar', length: 30, nullable: true })
  contrarian_signal: string | null; // 'bearish_contrarian', 'bullish_contrarian', 'divergence'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  fomo_panic_level: number; // Nivel de FOMO (>0) o Pánico (<0)

  @Column({ type: 'varchar', length: 20 })
  crowd_behavior: string; // 'fomo_buying', 'panic_selling', 'balanced', 'uncertainty'

  // 🎯 Promedios para comparación
  @Column({ type: 'decimal', precision: 10, scale: 6 })
  ratio_1h_avg: number; // Promedio 1h

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  ratio_4h_avg: number; // Promedio 4h

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  ratio_24h_avg: number; // Promedio 24h

  @CreateDateColumn()
  created_at: Date;
} 