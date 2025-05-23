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
} 