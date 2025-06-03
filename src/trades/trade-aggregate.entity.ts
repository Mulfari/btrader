import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('trade_aggregates_1s')
export class TradeAggregate {
  @PrimaryColumn()
  symbol: string;

  @PrimaryColumn()
  timestamp: Date;

  @Column('decimal', { precision: 15, scale: 4 })
  buy_volume: number;

  @Column('decimal', { precision: 15, scale: 4 })
  sell_volume: number;

  @Column('int')
  buy_count: number;

  @Column('int')
  sell_count: number;

  @Column('decimal', { precision: 10, scale: 2 })
  vwap: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price_high: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price_low: number;
} 