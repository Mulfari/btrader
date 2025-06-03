import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('liquidations')
@Index(['symbol', 'timestamp'])
@Index(['symbol', 'price']) // Para búsquedas por zonas de precio
export class Liquidation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // 🎯 Datos básicos de liquidación
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price: number; // Precio de liquidación

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  size: number; // Tamaño liquidado

  @Column({ type: 'varchar', length: 10 })
  side: string; // 'Buy' o 'Sell' (que lado fue liquidado)

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  value_usd: number; // Valor en USD de la liquidación

  // 🎯 Análisis de clustering y zonas
  @Column({ type: 'boolean' })
  is_large_liquidation: boolean; // Si es una liquidación grande

  @Column({ type: 'varchar', length: 20 })
  liquidation_intensity: string; // 'low', 'medium', 'high', 'extreme'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  price_impact_percent: number; // Impacto en el precio (%)

  // 🎯 Clustering de liquidaciones (detección de zonas)
  @Column({ type: 'boolean' })
  is_cluster_start: boolean; // Si inicia un cluster de liquidaciones

  @Column({ type: 'boolean' })
  is_cluster_member: boolean; // Si pertenece a un cluster

  @Column({ type: 'varchar', length: 50, nullable: true })
  cluster_id: string | null; // ID del cluster al que pertenece

  @Column({ type: 'integer' })
  liquidations_in_5min: number; // Liquidaciones en los últimos 5 min

  @Column({ type: 'decimal', precision: 20, scale: 2 })
  volume_in_5min: number; // Volumen liquidado en 5 min

  // 🎯 Análisis de fuerza del mercado
  @Column({ type: 'varchar', length: 30 })
  market_event_type: string; // 'cascade', 'single', 'cluster', 'flash_crash'

  @Column({ type: 'decimal', precision: 10, scale: 6 })
  liquidation_ratio: number; // Ratio long/short liquidations

  @Column({ type: 'boolean' })
  is_reversal_zone: boolean; // Si está en una zona de posible reversión

  @Column({ type: 'varchar', length: 20 })
  market_pressure: string; // 'buying', 'selling', 'neutral', 'extreme_selling', 'extreme_buying'

  // 🎯 Contexto del mercado
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price_before_1min: number; // Precio 1 minuto antes

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price_after_1min: number; // Precio 1 minuto después (se actualiza)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  recovery_percent: number; // % de recuperación después de la liquidación

  @CreateDateColumn()
  created_at: Date;
} 