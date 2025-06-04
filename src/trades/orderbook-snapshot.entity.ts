import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('orderbook_snapshots')
export class OrderbookSnapshot {
  @PrimaryColumn()
  symbol: string;

  @PrimaryColumn()
  timestamp: Date;

  // Mejor bid (precio más alto de compra)
  @Column('decimal', { precision: 10, scale: 2 })
  bid_price: number;

  // Mejor ask (precio más bajo de venta)
  @Column('decimal', { precision: 10, scale: 2 })
  ask_price: number;

  // Volumen en el mejor bid
  @Column('decimal', { precision: 15, scale: 4 })
  bid_size: number;

  // Volumen en el mejor ask
  @Column('decimal', { precision: 15, scale: 4 })
  ask_size: number;

  // Spread = ask_price - bid_price (calculado)
  @Column('decimal', { precision: 8, scale: 4 })
  spread: number;

  // Precio medio = (bid_price + ask_price) / 2 (calculado)
  @Column('decimal', { precision: 10, scale: 2 })
  mid_price: number;

  // Desequilibrio = bid_size / (bid_size + ask_size) (0.5 = equilibrado)
  @Column('decimal', { precision: 5, scale: 4 })
  imbalance: number;

  // Update ID de Bybit para tracking
  @Column('bigint')
  update_id: number;

  // Sequence number de Bybit
  @Column('bigint')
  seq: number;
} 