import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('funding_rates')
@Index(['symbol', 'timestamp'])
export class FundingRate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  current_funding_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 8 })
  predicted_funding_rate: number;

  @Column({ type: 'bigint' })
  next_funding_time: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  mark_price: number;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  index_price: number;

  // 🎯 Campos para análisis de sesgo direccional
  @Column({ type: 'decimal', precision: 8, scale: 6 })
  funding_rate_8h_avg: number; // Promedio 8h

  @Column({ type: 'decimal', precision: 8, scale: 6 })
  funding_rate_24h_avg: number; // Promedio 24h

  @Column({ type: 'varchar', length: 20 })
  market_sentiment: string; // 'bullish_heavy', 'bullish_moderate', 'neutral', 'bearish_moderate', 'bearish_heavy'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  long_short_bias: number; // Sesgo long/short en %

  @Column({ type: 'boolean' })
  is_extreme: boolean; // Si está en niveles extremos

  @Column({ type: 'varchar', length: 50, nullable: true })
  reversal_signal: string; // Señal de posible reversal

  @CreateDateColumn()
  created_at: Date;
} 