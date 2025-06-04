import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('orderbook_snapshots')
@Index(['symbol', 'timestamp'])
export class OrderbookSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // 🎯 Datos del spread
  @Column({ type: 'decimal', precision: 15, scale: 8 })
  bid_price: number; // Mejor precio de compra

  @Column({ type: 'decimal', precision: 15, scale: 8 })
  ask_price: number; // Mejor precio de venta

  @Column({ type: 'decimal', precision: 15, scale: 8 })
  spread: number; // Diferencia ask - bid

  @Column({ type: 'decimal', precision: 15, scale: 8 })
  mid_price: number; // Precio medio (bid + ask) / 2

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  spread_percentage: number; // Spread como % del mid price

  // 🎯 Volúmenes en el spread
  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  bid_size: number; // Volumen en el mejor bid

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  ask_size: number; // Volumen en el mejor ask

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  total_bid_volume_5: number; // Volumen total en los 5 mejores bids

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  total_ask_volume_5: number; // Volumen total en los 5 mejores asks

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  total_bid_volume_10: number; // Volumen total en los 10 mejores bids

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  total_ask_volume_10: number; // Volumen total en los 10 mejores asks

  // 🎯 Métricas de liquidez
  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  imbalance: number; // (bid_volume - ask_volume) / (bid_volume + ask_volume)

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  liquidity_score: number; // Métrica de liquidez general

  @Column({ type: 'decimal', precision: 5, scale: 4, nullable: true })
  bid_ask_ratio: number; // bid_volume / ask_volume

  // 🎯 Niveles de profundidad
  @Column({ type: 'integer', nullable: true })
  bid_levels_count: number; // Número de niveles en el lado bid

  @Column({ type: 'integer', nullable: true })
  ask_levels_count: number; // Número de niveles en el lado ask

  @Column({ type: 'decimal', precision: 15, scale: 8, nullable: true })
  weighted_bid_price: number; // Precio bid ponderado por volumen

  @Column({ type: 'decimal', precision: 15, scale: 8, nullable: true })
  weighted_ask_price: number; // Precio bid ponderado por volumen

  // 🎯 Análisis de calidad del mercado
  @Column({ type: 'varchar', length: 20, nullable: true })
  market_state: string; // 'liquid', 'illiquid', 'volatile', 'stable'

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  quality_score: number; // Score de 0-100 sobre la calidad del orderbook

  // 🎯 Campos adicionales requeridos por el código
  @Column({ type: 'bigint' })
  update_id: number; // ID de actualización del orderbook

  @Column({ type: 'bigint' })
  seq: number; // Número de secuencia

  @CreateDateColumn()
  created_at: Date;
} 