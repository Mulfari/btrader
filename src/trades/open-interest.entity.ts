import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('open_interest')
export class OpenInterest {
  @PrimaryColumn()
  symbol: string;

  @PrimaryColumn()
  timestamp: Date;

  // Open Interest absoluto (número de contratos abiertos)
  @Column('decimal', { precision: 20, scale: 8 })
  open_interest: number;

  // Delta OI = diferencia respecto al valor anterior
  @Column('decimal', { precision: 20, scale: 8 })
  delta_oi: number;

  // Precio actual del activo cuando se tomó el OI
  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  // Porcentaje de cambio del OI
  @Column('decimal', { precision: 8, scale: 4 })
  oi_change_percent: number;

  // Timestamp de Bybit para tracking
  @Column('bigint')
  next_time: number;

  // Volumen de 24h para contexto
  @Column('decimal', { precision: 20, scale: 8, nullable: true })
  volume_24h: number;
} 