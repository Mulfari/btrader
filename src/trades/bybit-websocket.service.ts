import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as WebSocket from 'ws';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';

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

interface BybitOrderbook {
  s: string;        // symbol
  b: string[][];    // bids [price, size]
  a: string[][];    // asks [price, size]
  u: number;        // update id
  seq: number;      // sequence number
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

interface OrderbookData {
  symbol: string;
  bidPrice: number;
  askPrice: number;
  bidSize: number;
  askSize: number;
  updateId: number;
  seq: number;
  timestamp: Date;
}

interface OpenInterestData {
  symbol: string;
  openInterest: number;
  previousOI: number;
  deltaOI: number;
  price: number;
  timestamp: Date;
  nextTime: number;
}

@Injectable()
export class BybitWebSocketService implements OnModuleInit {
  private readonly logger = new Logger(BybitWebSocketService.name);
  private ws: WebSocket;
  private accumulators = new Map<string, TradeAccumulator>();
  private orderbookData = new Map<string, OrderbookData>();
  private openInterestData = new Map<string, OpenInterestData>();
  private symbols = ['BTCUSDT']; // Empezamos solo con Bitcoin
  private isPaused = false; // 🟢 Control de pausa
  private aggregationTimer: NodeJS.Timeout | null = null; // 🟢 Timer de agregación
  private orderbookTimer: NodeJS.Timeout | null = null; // 🟢 Timer para snapshots del orderbook
  private openInterestTimer: NodeJS.Timeout | null = null; // 🟢 Timer para OI

  constructor(
    @InjectRepository(TradeAggregate)
    private tradeRepository: Repository<TradeAggregate>,
    @InjectRepository(OrderbookSnapshot)
    private orderbookRepository: Repository<OrderbookSnapshot>,
    @InjectRepository(OpenInterest)
    private openInterestRepository: Repository<OpenInterest>,
  ) {}

  onModuleInit() {
    this.connect();
    this.startAggregationTimer();
    this.startOrderbookTimer(); // 🟢 Iniciar timer del orderbook
    this.startOpenInterestTimer(); // 🟢 Iniciar timer de Open Interest
  }

  // 🟢 Métodos de control
  pause() {
    this.isPaused = true;
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }
    if (this.orderbookTimer) { // 🟢 Parar timer del orderbook
      clearInterval(this.orderbookTimer);
      this.orderbookTimer = null;
    }
    if (this.openInterestTimer) { // 🟢 Parar timer de Open Interest
      clearInterval(this.openInterestTimer);
      this.openInterestTimer = null;
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
    this.startOrderbookTimer(); // 🟢 Reiniciar timer del orderbook
    this.startOpenInterestTimer(); // 🟢 Reiniciar timer de Open Interest
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
      ),
      // 🟢 Agregar datos del orderbook al status
      orderbookData: Object.fromEntries(
        Array.from(this.orderbookData.entries()).map(([symbol, data]) => [
          symbol,
          {
            bidPrice: data.bidPrice,
            askPrice: data.askPrice,
            spread: data.askPrice - data.bidPrice,
            midPrice: (data.bidPrice + data.askPrice) / 2,
            imbalance: data.bidSize / (data.bidSize + data.askSize),
            lastUpdate: data.timestamp
          }
        ])
      ),
      // 🟢 Agregar datos de Open Interest al status
      openInterestData: Object.fromEntries(
        Array.from(this.openInterestData.entries()).map(([symbol, data]) => [
          symbol,
          {
            openInterest: data.openInterest,
            previousOI: data.previousOI,
            deltaOI: data.deltaOI,
            price: data.price,
            timestamp: data.timestamp
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
    // 🟢 Suscripciones solo a trades y orderbook (Open Interest va por REST API)
    const tradeSubscriptions = this.symbols.map(symbol => `publicTrade.${symbol}`);
    const orderbookSubscriptions = this.symbols.map(symbol => `orderbook.1.${symbol}`);
    
    const allSubscriptions = [...tradeSubscriptions, ...orderbookSubscriptions];
    
    const message = {
      op: 'subscribe',
      args: allSubscriptions
    };

    this.ws.send(JSON.stringify(message));
    this.logger.log(`📡 Suscrito a: ${allSubscriptions.join(', ')}`);
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

      // Procesar orderbook
      if (message.topic && message.topic.startsWith('orderbook.1.') && message.data) {
        this.processOrderbook(message);
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

  private startOrderbookTimer() {
    if (this.orderbookTimer) {
      clearInterval(this.orderbookTimer);
    }
    
    // 🟢 Usar la variable del timer
    this.orderbookTimer = setInterval(() => {
      if (this.isPaused) return; // 🟢 No agregar si está pausado
      
      const now = new Date();
      now.setMilliseconds(0); // Normalizar al segundo exacto
      
      this.saveOrderbookData(now);
    }, 1000);
  }

  private async saveOrderbookData(timestamp: Date) {
    if (this.isPaused) return; // 🟢 No guardar si está pausado
    
    const promises: Promise<OrderbookSnapshot>[] = [];

    for (const [symbol, data] of this.orderbookData.entries()) {
      // Calcular métricas
      const spread = data.askPrice - data.bidPrice;
      const midPrice = (data.bidPrice + data.askPrice) / 2;
      const totalSize = data.bidSize + data.askSize;
      const imbalance = totalSize > 0 ? data.bidSize / totalSize : 0.5;

      const snapshot = new OrderbookSnapshot();
      snapshot.symbol = symbol;
      snapshot.timestamp = timestamp;
      snapshot.bid_price = data.bidPrice;
      snapshot.ask_price = data.askPrice;
      snapshot.bid_size = data.bidSize;
      snapshot.ask_size = data.askSize;
      snapshot.spread = spread;
      snapshot.mid_price = midPrice;
      snapshot.imbalance = imbalance;
      snapshot.update_id = data.updateId;
      snapshot.seq = data.seq;

      promises.push(this.orderbookRepository.save(snapshot));
    }

    if (promises.length > 0) {
      try {
        await Promise.all(promises);
        this.logger.debug(`📊 Guardados ${promises.length} snapshots del orderbook para ${timestamp.toISOString()}`);
      } catch (error) {
        this.logger.error('❌ Error guardando snapshots del orderbook:', error);
      }
    }
  }

  // 🟢 Nuevo método para procesar orderbook
  private processOrderbook(message: any) {
    if (this.isPaused) return; // 🟢 No procesar si está pausado
    
    const orderbookData: BybitOrderbook = message.data;
    const symbol = orderbookData.s;

    // Verificar que hay bids y asks
    if (!orderbookData.b.length || !orderbookData.a.length) {
      return;
    }

    // Extraer mejor bid y ask
    const bestBid = orderbookData.b[0]; // [price, size]
    const bestAsk = orderbookData.a[0]; // [price, size]

    const bidPrice = parseFloat(bestBid[0]);
    const bidSize = parseFloat(bestBid[1]);
    const askPrice = parseFloat(bestAsk[0]);
    const askSize = parseFloat(bestAsk[1]);

    // Actualizar datos del orderbook
    this.orderbookData.set(symbol, {
      symbol,
      bidPrice,
      askPrice,
      bidSize,
      askSize,
      updateId: orderbookData.u,
      seq: orderbookData.seq,
      timestamp: new Date()
    });

    this.logger.debug(`📊 Orderbook ${symbol}: Bid=${bidPrice}@${bidSize}, Ask=${askPrice}@${askSize}, Spread=${(askPrice-bidPrice).toFixed(4)}`);
  }

  private startOpenInterestTimer() {
    if (this.openInterestTimer) {
      clearInterval(this.openInterestTimer);
    }
    
    // 🟢 Consultar Open Interest vía REST API cada 30 segundos
    this.openInterestTimer = setInterval(() => {
      if (this.isPaused) return;
      
      this.fetchOpenInterestData();
    }, 30000); // 30 segundos
    
    // Ejecutar inmediatamente al iniciar
    if (!this.isPaused) {
      this.fetchOpenInterestData();
    }
  }

  // 🟢 Método para consultar Open Interest vía REST API
  private async fetchOpenInterestData() {
    if (this.isPaused) return;

    for (const symbol of this.symbols) {
      try {
        // ✅ URL corregida con parámetros obligatorios
        const url = `https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min&limit=1`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
          const oiData = data.result.list[0]; // Tomar el dato más reciente
          await this.processOpenInterestData(symbol, oiData);
        } else {
          this.logger.warn(`⚠️ No se encontraron datos de Open Interest para ${symbol}: ${data.retMsg || 'Unknown error'}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo Open Interest para ${symbol}:`, error);
      }
    }
  }

  // 🟢 Procesar datos de Open Interest obtenidos de REST API
  private async processOpenInterestData(symbol: string, oiData: any) {
    const currentOI = parseFloat(oiData.openInterest);
    const timestamp = parseInt(oiData.timestamp);
    
    // Obtener precio actual del orderbook
    const orderbookPrice = this.orderbookData.get(symbol);
    const currentPrice = orderbookPrice ? (orderbookPrice.bidPrice + orderbookPrice.askPrice) / 2 : 0;

    // Obtener OI anterior si existe
    const previousData = this.openInterestData.get(symbol);
    const previousOI = previousData ? previousData.openInterest : currentOI;
    const deltaOI = currentOI - previousOI;

    // Actualizar datos de Open Interest
    this.openInterestData.set(symbol, {
      symbol,
      openInterest: currentOI,
      previousOI: previousOI,
      deltaOI: deltaOI,
      price: currentPrice,
      timestamp: new Date(timestamp),
      nextTime: Date.now() + 30000 // Próxima actualización en 30s
    });

    this.logger.log(`💰 Open Interest ${symbol}: OI=${currentOI.toLocaleString()}, ΔOI=${deltaOI > 0 ? '+' : ''}${deltaOI.toFixed(2)}, Price=$${currentPrice.toFixed(2)}, Timestamp=${new Date(timestamp).toISOString()}`);

    // Guardar en base de datos inmediatamente
    await this.saveOpenInterestSnapshot(symbol, currentOI, deltaOI, currentPrice);
  }

  // 🟢 Guardar snapshot individual de Open Interest
  private async saveOpenInterestSnapshot(symbol: string, openInterest: number, deltaOI: number, price: number) {
    try {
      const changePercent = deltaOI !== 0 && openInterest !== deltaOI ? (deltaOI / (openInterest - deltaOI)) * 100 : 0;

      const openInterestEntity = new OpenInterest();
      openInterestEntity.symbol = symbol;
      openInterestEntity.timestamp = new Date();
      openInterestEntity.open_interest = openInterest;
      openInterestEntity.delta_oi = deltaOI;
      openInterestEntity.price = price;
      openInterestEntity.oi_change_percent = changePercent;
      openInterestEntity.next_time = Date.now() + 30000;
      openInterestEntity.volume_24h = 0;

      await this.openInterestRepository.save(openInterestEntity);
      this.logger.debug(`💾 Open Interest guardado: ${symbol} - OI=${openInterest.toLocaleString()}`);
    } catch (error) {
      this.logger.error('❌ Error guardando Open Interest:', error);
    }
  }
} 