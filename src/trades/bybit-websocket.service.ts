import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as WebSocket from 'ws';
import { TradeAggregate } from './trade-aggregate.entity';

interface BybitTrade {
  T: number;        // timestamp
  s: string;        // symbol
  S: string;        // side: "Buy" | "Sell"
  v: string;        // volume
  p: string;        // price
  L: string;        // tick direction
  i: string;        // trade ID
  BT: boolean;      // is block trade
}

interface TradeAccumulator {
  buyVolume: number;
  sellVolume: number;
  buyCount: number;
  sellCount: number;
  trades: Array<{ price: number; volume: number }>;
  priceHigh: number;
  priceLow: number;
}

@Injectable()
export class BybitWebSocketService implements OnModuleInit {
  private readonly logger = new Logger(BybitWebSocketService.name);
  private ws: WebSocket;
  private accumulators = new Map<string, TradeAccumulator>();
  private symbols = ['BTCUSDT']; // Empezamos solo con Bitcoin
  private isPaused = false; // 🟢 Control de pausa
  private aggregationTimer: NodeJS.Timeout | null = null; // 🟢 Timer de agregación

  constructor(
    @InjectRepository(TradeAggregate)
    private tradeRepository: Repository<TradeAggregate>,
  ) {}

  onModuleInit() {
    this.connect();
    this.startAggregationTimer();
  }

  // 🟢 Métodos de control
  pause() {
    this.isPaused = true;
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close();
    }
    this.logger.warn('⏸️ Recolección de datos PAUSADA');
  }

  resume() {
    this.isPaused = false;
    this.connect();
    this.startAggregationTimer();
    this.logger.log('▶️ Recolección de datos REANUDADA');
  }

  getStatus() {
    return {
      isPaused: this.isPaused,
      isConnected: this.ws?.readyState === WebSocket.OPEN,
      symbols: this.symbols,
      accumulatorData: Object.fromEntries(
        Array.from(this.accumulators.entries()).map(([symbol, acc]) => [
          symbol,
          {
            buyVolume: acc.buyVolume,
            sellVolume: acc.sellVolume,
            totalTrades: acc.buyCount + acc.sellCount
          }
        ])
      )
    };
  }

  private connect() {
    if (this.isPaused) return; // 🟢 No conectar si está pausado
    
    try {
      this.ws = new WebSocket('wss://stream.bybit.com/v5/public/linear');
      
      this.ws.on('open', () => {
        this.logger.log('🔗 Conectado a Bybit WebSocket');
        this.subscribeToTrades();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        if (!this.isPaused) { // 🟢 Solo reconectar si no está pausado
          this.logger.warn('🔌 WebSocket desconectado. Reconectando en 5s...');
          setTimeout(() => this.connect(), 5000);
        }
      });

      this.ws.on('error', (error) => {
        this.logger.error('❌ Error WebSocket:', error);
      });

    } catch (error) {
      this.logger.error('❌ Error conectando WebSocket:', error);
      if (!this.isPaused) { // 🟢 Solo reconectar si no está pausado
        setTimeout(() => this.connect(), 5000);
      }
    }
  }

  private subscribeToTrades() {
    const subscriptions = this.symbols.map(symbol => `publicTrade.${symbol}`);
    
    const message = {
      op: 'subscribe',
      args: subscriptions
    };

    this.ws.send(JSON.stringify(message));
    this.logger.log(`📡 Suscrito a: ${subscriptions.join(', ')}`);
  }

  private handleMessage(data: WebSocket.Data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Ignorar confirmaciones
      if (message.success !== undefined) {
        this.logger.log('✅ Suscripción confirmada');
        return;
      }

      // Procesar trades
      if (message.topic && message.topic.startsWith('publicTrade.') && message.data) {
        this.processTrades(message);
      }
    } catch (error) {
      this.logger.error('❌ Error procesando mensaje:', error);
    }
  }

  private processTrades(message: any) {
    if (this.isPaused) return; // 🟢 No procesar si está pausado
    
    const trades: BybitTrade[] = message.data;
    
    trades.forEach(trade => {
      const symbol = trade.s;
      const price = parseFloat(trade.p);
      const volume = parseFloat(trade.v);
      const side = trade.S === 'Buy' ? 'buy' : 'sell';

      // Inicializar acumulador si no existe
      if (!this.accumulators.has(symbol)) {
        this.accumulators.set(symbol, {
          buyVolume: 0,
          sellVolume: 0,
          buyCount: 0,
          sellCount: 0,
          trades: [],
          priceHigh: price,
          priceLow: price
        });
      }

      const acc = this.accumulators.get(symbol)!; // Non-null assertion ya que acabamos de verificar/crear
      
      // Actualizar acumulador
      if (side === 'buy') {
        acc.buyVolume += volume;
        acc.buyCount++;
      } else {
        acc.sellVolume += volume;
        acc.sellCount++;
      }

      acc.trades.push({ price, volume });
      acc.priceHigh = Math.max(acc.priceHigh, price);
      acc.priceLow = Math.min(acc.priceLow, price);
    });
  }

  private startAggregationTimer() {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
    }
    
    // 🟢 Usar la variable del timer
    this.aggregationTimer = setInterval(() => {
      if (this.isPaused) return; // 🟢 No agregar si está pausado
      
      const now = new Date();
      now.setMilliseconds(0); // Normalizar al segundo exacto
      
      this.saveAggregatedData(now);
    }, 1000);
  }

  private async saveAggregatedData(timestamp: Date) {
    if (this.isPaused) return; // 🟢 No guardar si está pausado
    
    const promises: Promise<TradeAggregate>[] = [];

    for (const [symbol, acc] of this.accumulators.entries()) {
      if (acc.trades.length === 0) continue;

      // Calcular VWAP
      const totalValue = acc.trades.reduce((sum, t) => sum + (t.price * t.volume), 0);
      const totalVolume = acc.buyVolume + acc.sellVolume;
      const vwap = totalVolume > 0 ? totalValue / totalVolume : acc.trades[0].price;

      const aggregate = new TradeAggregate();
      aggregate.symbol = symbol;
      aggregate.timestamp = timestamp;
      aggregate.buy_volume = acc.buyVolume;
      aggregate.sell_volume = acc.sellVolume;
      aggregate.buy_count = acc.buyCount;
      aggregate.sell_count = acc.sellCount;
      aggregate.vwap = vwap;
      aggregate.price_high = acc.priceHigh;
      aggregate.price_low = acc.priceLow;

      promises.push(this.tradeRepository.save(aggregate));

      // Reset acumulador
      this.accumulators.set(symbol, {
        buyVolume: 0,
        sellVolume: 0,
        buyCount: 0,
        sellCount: 0,
        trades: [],
        priceHigh: 0,
        priceLow: 999999
      });
    }

    if (promises.length > 0) {
      try {
        await Promise.all(promises);
        this.logger.debug(`💾 Guardados ${promises.length} agregados para ${timestamp.toISOString()}`);
      } catch (error) {
        this.logger.error('❌ Error guardando agregados:', error);
      }
    }
  }

  // Método para obtener datos actuales (no guardados aún)
  getCurrentAccumulator(symbol: string): TradeAccumulator | null {
    return this.accumulators.get(symbol) || null;
  }
} 