import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

export interface SpotMarketTicker {
  symbol: string;
  price: string;
  indexPrice: string;
  change: string;
  volume: string;
  high24h: string;
  low24h: string;
  volumeUSDT: string;
  marketType: 'spot';
  bidPrice: string;
  askPrice: string;
  favorite: boolean;
}

export interface PerpetualMarketTicker {
  symbol: string;
  price: string;
  indexPrice: string;
  change: string;
  volume: string;
  high24h: string;
  low24h: string;
  volumeUSDT: string;
  marketType: 'perpetual';
  openInterest: string;
  fundingRate: string;
  nextFundingTime: number;
  leverage: string;
  markPrice: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  favorite: boolean;
}

export interface OrderBookLevel3Entry {
  price: string;
  size: string;
  side: 'buy' | 'sell';
  id?: string;
}

export interface OrderBookLevel3 {
  symbol: string;
  bids: OrderBookLevel3Entry[];
  asks: OrderBookLevel3Entry[];
  timestamp: number;
  updateId?: number;
}

export interface OrderBookSnapshot {
  symbol: string;
  bids: [string, string][];  // [price, size]
  asks: [string, string][];  // [price, size]
  timestamp: number;
  updateId: number;
}

// Nuevas interfaces para los widgets
export interface LongShortRatioData {
  symbol: string;
  buyRatio: string;
  sellRatio: string;
  timestamp: string;
}

export interface OpenInterestData {
  symbol: string;
  openInterest: string;
  timestamp: string;
}

export interface VolumeData {
  symbol: string;
  timestamp: string;
  volume: string;
  turnover: string;
  openPrice: string;
  closePrice: string;
  highPrice: string;
  lowPrice: string;
}

export interface LiquidationData {
  symbol: string;
  side: 'Buy' | 'Sell';
  size: string;
  price: string;
  time: number;
}

@Injectable()
export class MarketService {
  private readonly logger = new Logger(MarketService.name);
  private readonly bybitBaseUrl = 'https://api.bybit.com/v5';
  
  // Símbolos principales que queremos mostrar
  private readonly mainSymbols = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 
    'DOGEUSDT', 'LINKUSDT', 'UNIUSDT', 'SHIBUSDT', 'LTCUSDT', 
    'BCHUSDT', 'ATOMUSDT', 'NEARUSDT', 'AVAXUSDT', 'MATICUSDT', 'DOTUSDT'
  ];

  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    try {
      this.logger.log('Obteniendo datos de mercado spot desde Bybit...');
      
      // Obtener todos los tickers spot de Bybit
      const response = await axios.get(`${this.bybitBaseUrl}/market/tickers`, {
        params: {
          category: 'spot'
        },
        timeout: 10000
      });

      if (!response.data || !response.data.result || !response.data.result.list) {
        throw new Error('Formato de respuesta inválido de Bybit');
      }

      const bybitTickers = response.data.result.list;
      
      // Filtrar solo los símbolos principales y transformar los datos
      const tickers: SpotMarketTicker[] = [];
      
      for (const symbol of this.mainSymbols) {
        const bybitTicker = bybitTickers.find((ticker: any) => ticker.symbol === symbol);
        
        if (bybitTicker) {
          const price = parseFloat(bybitTicker.lastPrice || '0');
          const prevPrice = parseFloat(bybitTicker.prevPrice24h || '0');
          const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice * 100).toFixed(2) : '0.00';
          
          tickers.push({
            symbol: symbol.replace('USDT', ''), // Quitar USDT del símbolo para mostrar solo BTC, ETH, etc.
            price: price.toFixed(2),
            indexPrice: price.toFixed(2), // Para spot, usar el mismo precio
            change: `${changePercent}%`,
            volume: parseFloat(bybitTicker.volume24h || '0').toFixed(0),
            high24h: parseFloat(bybitTicker.highPrice24h || '0').toFixed(2),
            low24h: parseFloat(bybitTicker.lowPrice24h || '0').toFixed(2),
            volumeUSDT: parseFloat(bybitTicker.turnover24h || '0').toFixed(0),
            marketType: 'spot',
            bidPrice: parseFloat(bybitTicker.bid1Price || '0').toFixed(2),
            askPrice: parseFloat(bybitTicker.ask1Price || '0').toFixed(2),
            favorite: false
          });
        } else {
          // Si no se encuentra el ticker, agregar datos por defecto
          tickers.push({
            symbol: symbol.replace('USDT', ''),
            price: '0.00',
            indexPrice: '0.00',
            change: '0.00%',
            volume: '0',
            high24h: '0.00',
            low24h: '0.00',
            volumeUSDT: '0',
            marketType: 'spot',
            bidPrice: '0.00',
            askPrice: '0.00',
            favorite: false
          });
        }
      }

      this.logger.log(`Obtenidos ${tickers.length} tickers spot exitosamente`);
      return tickers;

    } catch (error) {
      this.logger.error('Error al obtener datos de mercado spot:', error);
      
      // Retornar datos por defecto en caso de error
      return this.mainSymbols.map(symbol => ({
        symbol: symbol.replace('USDT', ''),
        price: '0.00',
        indexPrice: '0.00',
        change: '0.00%',
        volume: '0',
        high24h: '0.00',
        low24h: '0.00',
        volumeUSDT: '0',
        marketType: 'spot' as const,
        bidPrice: '0.00',
        askPrice: '0.00',
        favorite: false
      }));
    }
  }

  async getPerpetualTickers(): Promise<PerpetualMarketTicker[]> {
    try {
      this.logger.log('Obteniendo datos de mercado perpetual desde Bybit...');
      
      // Obtener tickers de contratos lineales (perpetuos)
      const tickersResponse = await axios.get(`${this.bybitBaseUrl}/market/tickers`, {
        params: {
          category: 'linear'
        },
        timeout: 10000
      });

      if (!tickersResponse.data || !tickersResponse.data.result || !tickersResponse.data.result.list) {
        throw new Error('Formato de respuesta inválido de Bybit para tickers');
      }

      const bybitTickers = tickersResponse.data.result.list;
      
      // Transformar los datos
      const tickers: PerpetualMarketTicker[] = [];
      
      for (const symbol of this.mainSymbols) {
        const bybitTicker = bybitTickers.find((ticker: any) => ticker.symbol === symbol);
        
        if (bybitTicker) {
          const price = parseFloat(bybitTicker.lastPrice || '0');
          const prevPrice = parseFloat(bybitTicker.prevPrice24h || '0');
          const changePercent = prevPrice > 0 ? ((price - prevPrice) / prevPrice * 100).toFixed(2) : '0.00';
          const fundingRate = parseFloat(bybitTicker.fundingRate || '0') * 100;
          const openInterest = parseFloat(bybitTicker.openInterest || '0');
          const openInterestValue = parseFloat(bybitTicker.openInterestValue || '0');
          
          tickers.push({
            symbol: symbol.replace('USDT', ''),
            price: price.toFixed(2),
            indexPrice: parseFloat(bybitTicker.indexPrice || price.toString()).toFixed(2),
            change: `${changePercent}%`,
            volume: parseFloat(bybitTicker.volume24h || '0').toFixed(0),
            high24h: parseFloat(bybitTicker.highPrice24h || '0').toFixed(2),
            low24h: parseFloat(bybitTicker.lowPrice24h || '0').toFixed(2),
            volumeUSDT: parseFloat(bybitTicker.turnover24h || '0').toFixed(0),
            marketType: 'perpetual',
            openInterest: `${openInterest.toFixed(2)} ${symbol.replace('USDT', '')}`,
            fundingRate: `${fundingRate.toFixed(4)}%`,
            nextFundingTime: parseInt(bybitTicker.nextFundingTime || (Date.now() + 8 * 60 * 60 * 1000).toString()),
            leverage: '50x', // Bybit permite hasta 50x en muchos perpetuos
            markPrice: parseFloat(bybitTicker.markPrice || price.toString()).toFixed(2),
            lastPrice: price.toFixed(2),
            bidPrice: parseFloat(bybitTicker.bid1Price || '0').toFixed(2),
            askPrice: parseFloat(bybitTicker.ask1Price || '0').toFixed(2),
            favorite: false
          });
        } else {
          // Si no se encuentra el ticker, agregar datos por defecto
          const baseSymbol = symbol.replace('USDT', '');
          tickers.push({
            symbol: baseSymbol,
            price: '0.00',
            indexPrice: '0.00',
            change: '0.00%',
            volume: '0',
            high24h: '0.00',
            low24h: '0.00',
            volumeUSDT: '0',
            marketType: 'perpetual',
            openInterest: `0 ${baseSymbol}`,
            fundingRate: '0.0000%',
            nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
            leverage: '50x',
            markPrice: '0.00',
            lastPrice: '0.00',
            bidPrice: '0.00',
            askPrice: '0.00',
            favorite: false
          });
        }
      }

      this.logger.log(`Obtenidos ${tickers.length} tickers perpetual exitosamente`);
      return tickers;

    } catch (error) {
      this.logger.error('Error al obtener datos de mercado perpetual:', error);
      
      // Retornar datos por defecto en caso de error
      return this.mainSymbols.map(symbol => {
        const baseSymbol = symbol.replace('USDT', '');
        return {
          symbol: baseSymbol,
          price: '0.00',
          indexPrice: '0.00',
          change: '0.00%',
          volume: '0',
          high24h: '0.00',
          low24h: '0.00',
          volumeUSDT: '0',
          marketType: 'perpetual' as const,
          openInterest: `0 ${baseSymbol}`,
          fundingRate: '0.0000%',
          nextFundingTime: Date.now() + 8 * 60 * 60 * 1000,
          leverage: '50x',
          markPrice: '0.00',
          lastPrice: '0.00',
          bidPrice: '0.00',
          askPrice: '0.00',
          favorite: false
        };
      });
    }
  }

  // Método para obtener datos específicos de un ticker
  async getTickerBySymbol(symbol: string, category: 'spot' | 'linear' = 'spot'): Promise<any> {
    try {
      const response = await axios.get(`${this.bybitBaseUrl}/market/tickers`, {
        params: {
          category,
          symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`
        },
        timeout: 5000
      });

      if (response.data?.result?.list?.[0]) {
        return response.data.result.list[0];
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error al obtener ticker para ${symbol}:`, error);
      return null;
    }
  }

  // Método para obtener datos del orderbook
  async getOrderbook(symbol: string, category: 'spot' | 'linear' = 'spot', limit: number = 25): Promise<any> {
    try {
      const response = await axios.get(`${this.bybitBaseUrl}/market/orderbook`, {
        params: {
          category,
          symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
          limit
        },
        timeout: 5000
      });

      return response.data?.result || null;
    } catch (error) {
      this.logger.error(`Error al obtener orderbook para ${symbol}:`, error);
      return null;
    }
  }

  // Método para obtener order book nivel 3 (snapshot completo)
  async getOrderBookLevel3(symbol: string, category: 'spot' | 'linear' = 'spot', limit: number = 50): Promise<OrderBookLevel3 | null> {
    try {
      this.logger.log(`Obteniendo order book nivel 3 para ${symbol}`);
      
      const response = await axios.get(`${this.bybitBaseUrl}/market/orderbook`, {
        params: {
          category,
          symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
          limit: Math.min(limit, 200) // Bybit permite máximo 200
        },
        timeout: 5000
      });

      if (!response.data?.result) {
        return null;
      }

      const result = response.data.result;
      
      // Transformar los datos al formato de nivel 3
      const orderBook: OrderBookLevel3 = {
        symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
        bids: result.b?.map((bid: [string, string], index: number) => ({
          price: bid[0],
          size: bid[1],
          side: 'buy' as const,
          id: `bid_${index}_${bid[0]}`
        })) || [],
        asks: result.a?.map((ask: [string, string], index: number) => ({
          price: ask[0],
          size: ask[1],
          side: 'sell' as const,
          id: `ask_${index}_${ask[0]}`
        })) || [],
        timestamp: parseInt(result.ts) || Date.now(),
        updateId: parseInt(result.u) || 0
      };

      // Ordenar bids de mayor a menor precio y asks de menor a mayor precio
      orderBook.bids.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
      orderBook.asks.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

      this.logger.log(`Order book nivel 3 obtenido: ${orderBook.bids.length} bids, ${orderBook.asks.length} asks`);
      return orderBook;

    } catch (error) {
      this.logger.error(`Error al obtener order book nivel 3 para ${symbol}:`, error);
      return null;
    }
  }

  // Método para obtener múltiples order books
  async getMultipleOrderBooks(symbols: string[], category: 'spot' | 'linear' = 'spot', limit: number = 25): Promise<OrderBookLevel3[]> {
    try {
      const promises = symbols.map(symbol => this.getOrderBookLevel3(symbol, category, limit));
      const results = await Promise.allSettled(promises);
      
      return results
        .filter((result): result is PromiseFulfilledResult<OrderBookLevel3> => 
          result.status === 'fulfilled' && result.value !== null
        )
        .map(result => result.value);
    } catch (error) {
      this.logger.error('Error al obtener múltiples order books:', error);
      return [];
    }
  }

  // Método para obtener el spread del order book
  getOrderBookSpread(orderBook: OrderBookLevel3): { spread: number; spreadPercent: number; midPrice: number } | null {
    if (orderBook.bids.length === 0 || orderBook.asks.length === 0) {
      return null;
    }

    const bestBid = parseFloat(orderBook.bids[0].price);
    const bestAsk = parseFloat(orderBook.asks[0].price);
    const spread = bestAsk - bestBid;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadPercent = (spread / midPrice) * 100;

    return {
      spread,
      spreadPercent,
      midPrice
    };
  }

  // Método para obtener Long/Short Ratio
  async getLongShortRatio(
    symbol: string, 
    period: '5min' | '15min' | '30min' | '1h' | '4h' | '1d' = '1h',
    limit: number = 50,
    startTime?: number,
    endTime?: number
  ): Promise<LongShortRatioData[]> {
    try {
      this.logger.log(`Obteniendo Long/Short Ratio para ${symbol}`);
      
      const params: any = {
        category: 'linear',
        symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
        period,
        limit: Math.min(limit, 500)
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.bybitBaseUrl}/market/account-ratio`, {
        params,
        timeout: 10000
      });

      if (!response.data?.result?.list) {
        return [];
      }

      return response.data.result.list.map((item: any) => ({
        symbol: item.symbol,
        buyRatio: item.buyRatio,
        sellRatio: item.sellRatio,
        timestamp: item.timestamp
      }));

    } catch (error) {
      this.logger.error(`Error al obtener Long/Short Ratio para ${symbol}:`, error);
      return [];
    }
  }

  // Método para obtener Open Interest histórico
  async getOpenInterest(
    symbol: string,
    intervalTime: '5min' | '15min' | '30min' | '1h' | '4h' | '1d' = '1h',
    limit: number = 50,
    startTime?: number,
    endTime?: number
  ): Promise<OpenInterestData[]> {
    try {
      this.logger.log(`Obteniendo Open Interest para ${symbol}`);
      
      const params: any = {
        category: 'linear',
        symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
        intervalTime,
        limit: Math.min(limit, 200)
      };

      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await axios.get(`${this.bybitBaseUrl}/market/open-interest`, {
        params,
        timeout: 10000
      });

      if (!response.data?.result?.list) {
        return [];
      }

      return response.data.result.list.map((item: any) => ({
        symbol: response.data.result.symbol,
        openInterest: item.openInterest,
        timestamp: item.timestamp
      }));

    } catch (error) {
      this.logger.error(`Error al obtener Open Interest para ${symbol}:`, error);
      return [];
    }
  }

  // Método para obtener datos de volumen histórico
  async getVolumeData(
    symbol: string,
    interval: '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M' = '60',
    limit: number = 50,
    start?: number,
    end?: number
  ): Promise<VolumeData[]> {
    try {
      this.logger.log(`Obteniendo datos de volumen para ${symbol}`);
      
      const params: any = {
        category: 'linear',
        symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
        interval,
        limit: Math.min(limit, 1000)
      };

      if (start) params.start = start;
      if (end) params.end = end;

      const response = await axios.get(`${this.bybitBaseUrl}/market/kline`, {
        params,
        timeout: 10000
      });

      if (!response.data?.result?.list) {
        return [];
      }

      return response.data.result.list.map((item: any) => ({
        symbol: response.data.result.symbol,
        timestamp: item[0], // startTime
        openPrice: item[1],
        highPrice: item[2],
        lowPrice: item[3],
        closePrice: item[4],
        volume: item[5],
        turnover: item[6]
      }));

    } catch (error) {
      this.logger.error(`Error al obtener datos de volumen para ${symbol}:`, error);
      return [];
    }
  }

  // Método para obtener datos de múltiples símbolos para widgets
  async getMultiSymbolData(symbols: string[], dataType: 'longShort' | 'openInterest' | 'volume'): Promise<any[]> {
    try {
      const promises = symbols.map(symbol => {
        switch (dataType) {
          case 'longShort':
            return this.getLongShortRatio(symbol, '1h', 24);
          case 'openInterest':
            return this.getOpenInterest(symbol, '1h', 24);
          case 'volume':
            return this.getVolumeData(symbol, '60', 24);
          default:
            return Promise.resolve([]);
        }
      });

      const results = await Promise.allSettled(promises);
      
      return results
        .filter((result): result is PromiseFulfilledResult<any[]> => 
          result.status === 'fulfilled'
        )
        .map(result => result.value)
        .flat();
    } catch (error) {
      this.logger.error(`Error al obtener datos múltiples para ${dataType}:`, error);
      return [];
    }
  }

  // Método para obtener resumen de liquidaciones (simulado ya que necesita WebSocket)
  async getLiquidationSummary(symbol: string): Promise<{
    symbol: string;
    longLiquidations24h: string;
    shortLiquidations24h: string;
    totalLiquidations24h: string;
    lastUpdate: number;
  }> {
    try {
      // Nota: Las liquidaciones en tiempo real requieren WebSocket
      // Por ahora retornamos datos simulados basados en volatilidad del mercado
      const ticker = await this.getTickerBySymbol(symbol, 'linear');
      
      if (!ticker) {
        return {
          symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
          longLiquidations24h: '0',
          shortLiquidations24h: '0',
          totalLiquidations24h: '0',
          lastUpdate: Date.now()
        };
      }

      // Estimar liquidaciones basado en el cambio de precio y volumen
      const priceChange = Math.abs(parseFloat(ticker.price24hPcnt || '0'));
      const volume24h = parseFloat(ticker.turnover24h || '0');
      
      // Estimación simple: mayor volatilidad = más liquidaciones
      const estimatedLiquidations = Math.floor(volume24h * priceChange * 0.001);
      const longLiq = Math.floor(estimatedLiquidations * 0.6); // Asumimos más longs liquidados en caídas
      const shortLiq = estimatedLiquidations - longLiq;

      return {
        symbol: ticker.symbol,
        longLiquidations24h: longLiq.toString(),
        shortLiquidations24h: shortLiq.toString(),
        totalLiquidations24h: estimatedLiquidations.toString(),
        lastUpdate: Date.now()
      };

    } catch (error) {
      this.logger.error(`Error al obtener resumen de liquidaciones para ${symbol}:`, error);
      return {
        symbol: symbol.includes('USDT') ? symbol : `${symbol}USDT`,
        longLiquidations24h: '0',
        shortLiquidations24h: '0',
        totalLiquidations24h: '0',
        lastUpdate: Date.now()
      };
    }
  }
} 