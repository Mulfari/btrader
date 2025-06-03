import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as WebSocket from 'ws';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';
import { LongShortRatio } from './long-short-ratio.entity';

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

interface FundingRateData {
  symbol: string;
  currentFundingRate: number;
  nextFundingTime: number;
  markPrice: number;
  indexPrice: number;
  timestamp: Date;
  predictedFundingRate: number;
}

interface LongShortRatioData {
  symbol: string;
  longShortRatio: number;
  longAccountRatio: number;
  shortAccountRatio: number;
  timestamp: Date;
}

@Injectable()
export class BybitWebSocketService implements OnModuleInit {
  private readonly logger = new Logger(BybitWebSocketService.name);
  private ws: WebSocket;
  private accumulators = new Map<string, TradeAccumulator>();
  private orderbookData = new Map<string, OrderbookData>();
  private openInterestData = new Map<string, OpenInterestData>();
  private fundingRateData = new Map<string, FundingRateData>();
  private longShortRatioData = new Map<string, LongShortRatioData>();
  private symbols = ['BTCUSDT']; // Empezamos solo con Bitcoin
  private isPaused = false; // 🟢 Control de pausa
  private aggregationTimer: NodeJS.Timeout | null = null; // 🟢 Timer de agregación
  private orderbookTimer: NodeJS.Timeout | null = null; // 🟢 Timer para snapshots del orderbook
  private openInterestTimer: NodeJS.Timeout | null = null; // 🟢 Timer para OI
  private fundingRateTimer: NodeJS.Timeout | null = null; // 🟢 Timer para Funding Rate
  private longShortRatioTimer: NodeJS.Timeout | null = null; // 🟢 Timer para Long/Short Ratio

  constructor(
    @InjectRepository(TradeAggregate)
    private tradeRepository: Repository<TradeAggregate>,
    @InjectRepository(OrderbookSnapshot)
    private orderbookRepository: Repository<OrderbookSnapshot>,
    @InjectRepository(OpenInterest)
    private openInterestRepository: Repository<OpenInterest>,
    @InjectRepository(FundingRate)
    private fundingRateRepository: Repository<FundingRate>,
    @InjectRepository(LongShortRatio)
    private longShortRatioRepository: Repository<LongShortRatio>,
  ) {}

  onModuleInit() {
    this.connect();
    this.startAggregationTimer();
    this.startOrderbookTimer(); // 🟢 Iniciar timer del orderbook
    this.startOpenInterestTimer(); // 🟢 Iniciar timer de Open Interest
    this.startFundingRateTimer(); // 🟢 Iniciar timer de Funding Rate
    this.startLongShortRatioTimer(); // 🟢 Iniciar timer de Long/Short Ratio
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
    if (this.fundingRateTimer) { // 🟢 Parar timer de Funding Rate
      clearInterval(this.fundingRateTimer);
      this.fundingRateTimer = null;
    }
    if (this.longShortRatioTimer) { // 🟢 Parar timer de Long/Short Ratio
      clearInterval(this.longShortRatioTimer);
      this.longShortRatioTimer = null;
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
    this.startFundingRateTimer(); // 🟢 Reiniciar timer de Funding Rate
    this.startLongShortRatioTimer(); // 🟢 Reiniciar timer de Long/Short Ratio
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
      ),
      // 🟢 Agregar datos de Funding Rate al status
      fundingRateData: Object.fromEntries(
        Array.from(this.fundingRateData.entries()).map(([symbol, data]) => [
          symbol,
          {
            currentFundingRate: data.currentFundingRate,
            predictedFundingRate: data.predictedFundingRate,
            nextFundingTime: new Date(data.nextFundingTime).toISOString(),
            markPrice: data.markPrice,
            indexPrice: data.indexPrice,
            timestamp: data.timestamp
          }
        ])
      ),
      // 🟢 Agregar datos de Long/Short Ratio al status
      longShortRatioData: Object.fromEntries(
        Array.from(this.longShortRatioData.entries()).map(([symbol, data]) => [
          symbol,
          {
            longShortRatio: data.longShortRatio,
            longAccountRatio: data.longAccountRatio,
            shortAccountRatio: data.shortAccountRatio,
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

  private startFundingRateTimer() {
    if (this.fundingRateTimer) {
      clearInterval(this.fundingRateTimer);
    }
    
    // 🟢 Consultar Funding Rate vía REST API cada 1 hora (3600000 ms)
    this.fundingRateTimer = setInterval(() => {
      if (this.isPaused) return;
      
      this.fetchFundingRateData();
    }, 3600000); // 1 hora
    
    // Ejecutar inmediatamente al iniciar
    if (!this.isPaused) {
      this.fetchFundingRateData();
    }
  }

  // 🟢 Método para consultar Funding Rate vía REST API tickers
  private async fetchFundingRateData() {
    if (this.isPaused) return;

    for (const symbol of this.symbols) {
      try {
        // ✅ Usar endpoint de tickers que incluye funding rate
        const url = `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
          const tickerData = data.result.list[0];
          await this.processFundingRateData(symbol, tickerData);
        } else {
          this.logger.warn(`⚠️ No se encontraron datos de Funding Rate para ${symbol}: ${data.retMsg || 'Unknown error'}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo Funding Rate para ${symbol}:`, error);
      }
    }
  }

  // 🟢 Procesar datos de Funding Rate obtenidos de REST API
  private async processFundingRateData(symbol: string, tickerData: any) {
    const currentFundingRate = parseFloat(tickerData.fundingRate);
    const nextFundingTime = parseInt(tickerData.nextFundingTime);
    const markPrice = parseFloat(tickerData.markPrice);
    const indexPrice = parseFloat(tickerData.indexPrice);

    // Calcular predicted funding rate (estimado basado en tendencia actual)
    const previousData = this.fundingRateData.get(symbol);
    let predictedFundingRate = currentFundingRate; // Default: same as current
    
    if (previousData) {
      // Calcular tendencia simple
      const trend = currentFundingRate - previousData.currentFundingRate;
      predictedFundingRate = currentFundingRate + (trend * 0.5); // 50% de la tendencia
    }

    // Actualizar datos de Funding Rate
    this.fundingRateData.set(symbol, {
      symbol,
      currentFundingRate,
      nextFundingTime,
      markPrice,
      indexPrice,
      timestamp: new Date(),
      predictedFundingRate
    });

    this.logger.log(`💰 Funding Rate ${symbol}: Current=${(currentFundingRate * 100).toFixed(4)}%, Predicted=${(predictedFundingRate * 100).toFixed(4)}%, Next=${new Date(nextFundingTime).toISOString()}`);

    // Guardar en base de datos inmediatamente
    await this.saveFundingRateSnapshot(symbol, currentFundingRate, predictedFundingRate, nextFundingTime, markPrice, indexPrice);
  }

  // 🟢 Guardar snapshot de Funding Rate con análisis
  private async saveFundingRateSnapshot(
    symbol: string, 
    currentFundingRate: number, 
    predictedFundingRate: number, 
    nextFundingTime: number, 
    markPrice: number, 
    indexPrice: number
  ) {
    try {
      // 🎯 Calcular análisis de sesgo direccional
      const analysis = await this.analyzeFundingRateBias(symbol, currentFundingRate);

      const fundingRateEntity = new FundingRate();
      fundingRateEntity.symbol = symbol;
      fundingRateEntity.timestamp = new Date();
      fundingRateEntity.current_funding_rate = currentFundingRate;
      fundingRateEntity.predicted_funding_rate = predictedFundingRate;
      fundingRateEntity.next_funding_time = nextFundingTime;
      fundingRateEntity.mark_price = markPrice;
      fundingRateEntity.index_price = indexPrice;
      
      // Análisis de sesgo
      fundingRateEntity.funding_rate_8h_avg = analysis.avg8h;
      fundingRateEntity.funding_rate_24h_avg = analysis.avg24h;
      fundingRateEntity.market_sentiment = analysis.sentiment;
      fundingRateEntity.long_short_bias = analysis.bias;
      fundingRateEntity.is_extreme = analysis.isExtreme;
      fundingRateEntity.reversal_signal = analysis.reversalSignal || '';

      await this.fundingRateRepository.save(fundingRateEntity);
      this.logger.debug(`💾 Funding Rate guardado: ${symbol} - Rate=${(currentFundingRate * 100).toFixed(4)}%, Sentiment=${analysis.sentiment}`);
    } catch (error) {
      this.logger.error('❌ Error guardando Funding Rate:', error);
    }
  }

  // 🎯 Análisis avanzado de sesgo direccional
  private async analyzeFundingRateBias(symbol: string, currentRate: number) {
    try {
      // Obtener datos históricos para cálculos
      const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const recent8h = await this.fundingRateRepository
        .createQueryBuilder('fr')
        .where('fr.symbol = :symbol', { symbol })
        .andWhere('fr.timestamp >= :eightHoursAgo', { eightHoursAgo })
        .getMany();

      const recent24h = await this.fundingRateRepository
        .createQueryBuilder('fr')
        .where('fr.symbol = :symbol', { symbol })
        .andWhere('fr.timestamp >= :twentyFourHoursAgo', { twentyFourHoursAgo })
        .getMany();

      // Calcular promedios
      const avg8h = recent8h.length > 0 
        ? recent8h.reduce((sum, r) => sum + parseFloat(r.current_funding_rate.toString()), 0) / recent8h.length
        : currentRate;

      const avg24h = recent24h.length > 0 
        ? recent24h.reduce((sum, r) => sum + parseFloat(r.current_funding_rate.toString()), 0) / recent24h.length
        : currentRate;

      // 🎯 Determinar sentimiento del mercado
      let sentiment = 'neutral';
      if (currentRate > 0.001) sentiment = 'bullish_heavy';        // >0.1% = longs muy apalancados
      else if (currentRate > 0.0005) sentiment = 'bullish_moderate'; // >0.05% = longs moderados
      else if (currentRate < -0.001) sentiment = 'bearish_heavy';   // <-0.1% = shorts muy apalancados  
      else if (currentRate < -0.0005) sentiment = 'bearish_moderate'; // <-0.05% = shorts moderados

      // 🎯 Calcular sesgo long/short
      const bias = currentRate * 10000; // Convertir a basis points para mejor lectura

      // 🎯 Detectar niveles extremos
      const isExtreme = Math.abs(currentRate) > 0.002; // >0.2% es extremo

      // 🎯 Señales de reversal
      let reversalSignal: string | null = null;
      if (currentRate > 0.0015 && avg8h > 0.001) {
        reversalSignal = 'bearish_reversal_possible'; // Longs muy cargados
      } else if (currentRate < -0.0015 && avg8h < -0.001) {
        reversalSignal = 'bullish_reversal_possible'; // Shorts muy cargados
      } else if (Math.abs(currentRate - avg24h) > 0.001) {
        reversalSignal = 'funding_divergence'; // Divergencia significativa
      }

      return {
        avg8h,
        avg24h,
        sentiment,
        bias,
        isExtreme,
        reversalSignal
      };
    } catch (error) {
      this.logger.error('❌ Error en análisis de Funding Rate:', error);
      return {
        avg8h: currentRate,
        avg24h: currentRate,
        sentiment: 'neutral',
        bias: 0,
        isExtreme: false,
        reversalSignal: ''
      };
    }
  }

  private startLongShortRatioTimer() {
    if (this.longShortRatioTimer) {
      clearInterval(this.longShortRatioTimer);
    }
    
    // 🟢 Consultar Long/Short Ratio vía REST API cada 5 minutos (300000 ms)
    this.longShortRatioTimer = setInterval(() => {
      if (this.isPaused) return;
      
      this.fetchLongShortRatioData();
    }, 300000); // 5 minutos
    
    // Ejecutar inmediatamente al iniciar
    if (!this.isPaused) {
      this.fetchLongShortRatioData();
    }
  }

  // 🟢 Método para consultar Long/Short Ratio vía REST API
  private async fetchLongShortRatioData() {
    if (this.isPaused) return;

    for (const symbol of this.symbols) {
      try {
        // ✅ URL corregida según documentación oficial de Bybit
        const url = `https://api.bybit.com/v5/market/account-ratio?category=linear&symbol=${symbol}&period=5min&limit=1`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.retCode === 0 && data.result && data.result.list && data.result.list.length > 0) {
          const lsrData = data.result.list[0];
          await this.processLongShortRatioData(symbol, lsrData);
        } else {
          this.logger.warn(`⚠️ No se encontraron datos de Long/Short Ratio para ${symbol}: ${data.retMsg || 'Unknown error'}`);
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo Long/Short Ratio para ${symbol}:`, error);
      }
    }
  }

  // 🟢 Procesar datos de Long/Short Ratio obtenidos de REST API
  private async processLongShortRatioData(symbol: string, lsrData: any) {
    const buyRatio = parseFloat(lsrData.buyRatio);
    const sellRatio = parseFloat(lsrData.sellRatio);
    const timestamp = parseInt(lsrData.timestamp);
    
    // Calcular Long/Short ratio = buyRatio / sellRatio
    const longShortRatio = sellRatio > 0 ? buyRatio / sellRatio : 0;

    // Actualizar datos de Long/Short Ratio
    this.longShortRatioData.set(symbol, {
      symbol,
      longShortRatio,
      longAccountRatio: buyRatio,
      shortAccountRatio: sellRatio,
      timestamp: new Date(timestamp)
    });

    this.logger.log(`📊 Long/Short Ratio ${symbol}: L/S=${longShortRatio.toFixed(4)}, Buy=${(buyRatio * 100).toFixed(2)}%, Sell=${(sellRatio * 100).toFixed(2)}%, Timestamp=${new Date(timestamp).toISOString()}`);

    // Guardar en base de datos inmediatamente con análisis
    await this.saveLongShortRatioSnapshot(symbol, longShortRatio, buyRatio, sellRatio, new Date(timestamp));
  }

  // 🟢 Guardar snapshot de Long/Short Ratio con análisis de FOMO/pánico
  private async saveLongShortRatioSnapshot(
    symbol: string, 
    longShortRatio: number, 
    buyRatio: number, 
    sellRatio: number, 
    timestamp: Date
  ) {
    try {
      // 🎯 Calcular análisis de sentimiento y contrarian signals
      const analysis = await this.analyzeLongShortSentiment(symbol, longShortRatio, buyRatio, sellRatio);

      const longShortRatioEntity = new LongShortRatio();
      longShortRatioEntity.symbol = symbol;
      longShortRatioEntity.timestamp = timestamp;
      longShortRatioEntity.long_short_ratio = longShortRatio;
      longShortRatioEntity.long_account_ratio = buyRatio;
      longShortRatioEntity.short_account_ratio = sellRatio;
      
      // Sin datos de top traders de Bybit, establecemos como null
      longShortRatioEntity.top_trader_long_ratio = null;
      longShortRatioEntity.top_trader_short_ratio = null;
      
      // Análisis de sentimiento y FOMO/pánico
      longShortRatioEntity.market_sentiment = analysis.sentiment;
      longShortRatioEntity.sentiment_score = analysis.sentimentScore;
      longShortRatioEntity.is_extreme_long = analysis.isExtremeLong;
      longShortRatioEntity.is_extreme_short = analysis.isExtremeShort;
      longShortRatioEntity.contrarian_signal = analysis.contrarianSignal || null;
      longShortRatioEntity.fomo_panic_level = analysis.fomoPanicLevel;
      longShortRatioEntity.crowd_behavior = analysis.crowdBehavior;
      
      // Promedios
      longShortRatioEntity.ratio_1h_avg = analysis.avg1h;
      longShortRatioEntity.ratio_4h_avg = analysis.avg4h;
      longShortRatioEntity.ratio_24h_avg = analysis.avg24h;

      await this.longShortRatioRepository.save(longShortRatioEntity);
      this.logger.debug(`💾 Long/Short Ratio guardado: ${symbol} - Sentiment=${analysis.sentiment}, FOMO/Panic=${analysis.fomoPanicLevel.toFixed(2)}`);
    } catch (error) {
      this.logger.error('❌ Error guardando Long/Short Ratio:', error);
    }
  }

  // 🎯 Análisis avanzado de sentimiento y señales contrarias
  private async analyzeLongShortSentiment(symbol: string, currentLSRatio: number, buyRatio: number, sellRatio: number) {
    try {
      // Obtener datos históricos para cálculos
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [recent1h, recent4h, recent24h] = await Promise.all([
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol })
          .andWhere('lsr.timestamp >= :oneHourAgo', { oneHourAgo })
          .getMany(),
        
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol })
          .andWhere('lsr.timestamp >= :fourHoursAgo', { fourHoursAgo })
          .getMany(),
          
        this.longShortRatioRepository
          .createQueryBuilder('lsr')
          .where('lsr.symbol = :symbol', { symbol })
          .andWhere('lsr.timestamp >= :twentyFourHoursAgo', { twentyFourHoursAgo })
          .getMany()
      ]);

      // Calcular promedios
      const avg1h = recent1h.length > 0 
        ? recent1h.reduce((sum, r) => sum + parseFloat(r.long_short_ratio.toString()), 0) / recent1h.length
        : currentLSRatio;

      const avg4h = recent4h.length > 0 
        ? recent4h.reduce((sum, r) => sum + parseFloat(r.long_short_ratio.toString()), 0) / recent4h.length
        : currentLSRatio;

      const avg24h = recent24h.length > 0 
        ? recent24h.reduce((sum, r) => sum + parseFloat(r.long_short_ratio.toString()), 0) / recent24h.length
        : currentLSRatio;

      // 🎯 Determinar sentimiento del mercado
      let sentiment = 'neutral';
      let sentimentScore = 0;
      
      if (buyRatio > 0.70) sentiment = 'extreme_greed';      // >70% longs = codicia extrema
      else if (buyRatio > 0.60) sentiment = 'greed';        // >60% longs = codicia
      else if (buyRatio < 0.30) sentiment = 'extreme_fear'; // <30% longs = miedo extremo
      else if (buyRatio < 0.40) sentiment = 'fear';         // <40% longs = miedo

      // Score de sentimiento (-100 a 100)
      sentimentScore = (buyRatio - 0.5) * 200; // 0.5 = neutral, 0.7 = +40, 0.3 = -40

      // 🎯 Detectar niveles extremos
      const isExtremeLong = buyRatio > 0.75;   // >75% longs
      const isExtremeShort = buyRatio < 0.25;  // <25% longs

      // 🎯 Señales contrarias (when the crowd is wrong)
      let contrarianSignal: string | null = null;
      if (buyRatio > 0.80 && currentLSRatio > avg24h * 1.2) {
        contrarianSignal = 'bearish_contrarian'; // Demasiados longs = señal bajista
      } else if (buyRatio < 0.20 && currentLSRatio < avg24h * 0.8) {
        contrarianSignal = 'bullish_contrarian'; // Demasiados shorts = señal alcista
      } else if (Math.abs(currentLSRatio - avg24h) > avg24h * 0.3) {
        contrarianSignal = 'divergence'; // Divergencia significativa
      }

      // 🎯 Nivel de FOMO/Pánico
      let fomoPanicLevel = 0;
      if (buyRatio > 0.60) {
        fomoPanicLevel = (buyRatio - 0.60) * 250; // FOMO: 0 a 100
      } else if (buyRatio < 0.40) {
        fomoPanicLevel = (buyRatio - 0.40) * 250; // Pánico: 0 a -100
      }

      // 🎯 Comportamiento de la multitud
      let crowdBehavior = 'balanced';
      if (buyRatio > 0.65 && currentLSRatio > avg1h) crowdBehavior = 'fomo_buying';
      else if (buyRatio < 0.35 && currentLSRatio < avg1h) crowdBehavior = 'panic_selling';
      else if (Math.abs(currentLSRatio - avg1h) > avg1h * 0.2) crowdBehavior = 'uncertainty';

      return {
        avg1h,
        avg4h,
        avg24h,
        sentiment,
        sentimentScore,
        isExtremeLong,
        isExtremeShort,
        contrarianSignal,
        fomoPanicLevel,
        crowdBehavior
      };
    } catch (error) {
      this.logger.error('❌ Error en análisis de Long/Short Ratio:', error);
      return {
        avg1h: currentLSRatio,
        avg4h: currentLSRatio,
        avg24h: currentLSRatio,
        sentiment: 'neutral',
        sentimentScore: 0,
        isExtremeLong: false,
        isExtremeShort: false,
        contrarianSignal: null,
        fomoPanicLevel: 0,
        crowdBehavior: 'balanced'
      };
    }
  }
} 