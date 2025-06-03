import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('volume_profile')
@Index(['symbol', 'timestamp'])
@Index(['symbol', 'price_level']) // Para búsquedas por niveles de precio
export class VolumeProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 20 })
  symbol: string;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  // 🎯 Configuración del análisis
  @Column({ type: 'varchar', length: 20 })
  timeframe: string; // '5m', '15m', '1h', '4h', '1d'

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price_range_start: number; // Precio inicial del rango

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price_range_end: number; // Precio final del rango

  @Column({ type: 'integer' })
  price_levels: number; // Número de niveles analizados

  // 🎯 Datos del nivel de precio específico
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  price_level: number; // Precio de este nivel

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  total_volume: number; // Volumen total en este nivel

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  buy_volume: number; // Volumen de compra

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  sell_volume: number; // Volumen de venta

  @Column({ type: 'integer' })
  trade_count: number; // Número de trades en este nivel

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  volume_percentage: number; // % del volumen total

  // 🎯 Métricas de Volume Profile
  @Column({ type: 'boolean' })
  is_poc: boolean; // Point of Control (nivel con más volumen)

  @Column({ type: 'boolean' })
  is_value_area_high: boolean; // Value Area High

  @Column({ type: 'boolean' })
  is_value_area_low: boolean; // Value Area Low

  @Column({ type: 'boolean' })
  is_value_area: boolean; // Dentro del Value Area (70% del volumen)

  @Column({ type: 'boolean' })
  is_high_volume_node: boolean; // Nodo de alto volumen

  @Column({ type: 'boolean' })
  is_low_volume_node: boolean; // Nodo de bajo volumen

  // 🎯 Análisis de soporte/resistencia
  @Column({ type: 'varchar', length: 20 })
  level_type: string; // 'support', 'resistance', 'neutral', 'magnet'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  strength_score: number; // Fuerza del nivel (0-100)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  buy_sell_ratio: number; // Ratio compra/venta

  // 🎯 Contexto del mercado
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  current_price: number; // Precio actual vs este nivel

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  distance_from_current: number; // Distancia % del precio actual

  @Column({ type: 'varchar', length: 30 })
  price_action: string; // 'accepting', 'rejecting', 'testing', 'breaking'

  // 🎯 Estadísticas temporales
  @Column({ type: 'integer' })
  time_spent_seconds: number; // Tiempo que el precio pasó en este nivel

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  time_percentage: number; // % del tiempo total

  @Column({ type: 'integer' })
  touches_count: number; // Veces que el precio tocó este nivel

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  rejection_percentage: number; // % de veces que fue rechazado

  @CreateDateColumn()
  created_at: Date;
} 