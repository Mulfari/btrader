import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { MarketService, SpotMarketTicker, PerpetualMarketTicker, OrderBookLevel3, LongShortRatioData, OpenInterestData, VolumeData } from './market.service';

@Controller('market')
export class MarketController {
  private readonly logger = new Logger(MarketController.name);

  constructor(private readonly marketService: MarketService) {}

  @Get('spot/tickers')
  async getSpotTickers(): Promise<SpotMarketTicker[]> {
    this.logger.log('GET /api/market/spot/tickers');
    return this.marketService.getSpotTickers();
  }

  @Get('perpetual/tickers')
  async getPerpetualTickers(): Promise<PerpetualMarketTicker[]> {
    this.logger.log('GET /api/market/perpetual/tickers');
    return this.marketService.getPerpetualTickers();
  }

  @Get('ticker/:symbol')
  async getTickerBySymbol(
    @Param('symbol') symbol: string,
    @Query('category') category: 'spot' | 'linear' = 'spot'
  ) {
    this.logger.log(`GET /api/market/ticker/${symbol}?category=${category}`);
    return this.marketService.getTickerBySymbol(symbol, category);
  }

  @Get('orderbook/:symbol')
  async getOrderbook(
    @Param('symbol') symbol: string,
    @Query('category') category: 'spot' | 'linear' = 'spot',
    @Query('limit') limit: number = 25
  ) {
    this.logger.log(`GET /api/market/orderbook/${symbol}?category=${category}&limit=${limit}`);
    return this.marketService.getOrderbook(symbol, category, limit);
  }

  @Get('orderbook-l3/:symbol')
  async getOrderBookLevel3(
    @Param('symbol') symbol: string,
    @Query('category') category: 'spot' | 'linear' = 'spot',
    @Query('limit') limit: number = 50
  ): Promise<OrderBookLevel3 | null> {
    this.logger.log(`GET /api/market/orderbook-l3/${symbol}?category=${category}&limit=${limit}`);
    return this.marketService.getOrderBookLevel3(symbol, category, limit);
  }

  @Get('orderbook-l3-multiple')
  async getMultipleOrderBooks(
    @Query('symbols') symbols: string,
    @Query('category') category: 'spot' | 'linear' = 'spot',
    @Query('limit') limit: number = 25
  ): Promise<OrderBookLevel3[]> {
    const symbolsArray = symbols.split(',').map(s => s.trim());
    this.logger.log(`GET /api/market/orderbook-l3-multiple?symbols=${symbols}&category=${category}&limit=${limit}`);
    return this.marketService.getMultipleOrderBooks(symbolsArray, category, limit);
  }

  @Get('orderbook-spread/:symbol')
  async getOrderBookSpread(
    @Param('symbol') symbol: string,
    @Query('category') category: 'spot' | 'linear' = 'spot'
  ) {
    this.logger.log(`GET /api/market/orderbook-spread/${symbol}?category=${category}`);
    const orderBook = await this.marketService.getOrderBookLevel3(symbol, category, 10);
    if (!orderBook) {
      return null;
    }
    return this.marketService.getOrderBookSpread(orderBook);
  }

  // Nuevos endpoints para los widgets

  @Get('long-short-ratio/:symbol')
  async getLongShortRatio(
    @Param('symbol') symbol: string,
    @Query('period') period: '5min' | '15min' | '30min' | '1h' | '4h' | '1d' = '1h',
    @Query('limit') limit: number = 50,
    @Query('startTime') startTime?: number,
    @Query('endTime') endTime?: number
  ): Promise<LongShortRatioData[]> {
    this.logger.log(`GET /api/market/long-short-ratio/${symbol}?period=${period}&limit=${limit}`);
    return this.marketService.getLongShortRatio(symbol, period, limit, startTime, endTime);
  }

  @Get('open-interest/:symbol')
  async getOpenInterest(
    @Param('symbol') symbol: string,
    @Query('intervalTime') intervalTime: '5min' | '15min' | '30min' | '1h' | '4h' | '1d' = '1h',
    @Query('limit') limit: number = 50,
    @Query('startTime') startTime?: number,
    @Query('endTime') endTime?: number
  ): Promise<OpenInterestData[]> {
    this.logger.log(`GET /api/market/open-interest/${symbol}?intervalTime=${intervalTime}&limit=${limit}`);
    return this.marketService.getOpenInterest(symbol, intervalTime, limit, startTime, endTime);
  }

  @Get('volume/:symbol')
  async getVolumeData(
    @Param('symbol') symbol: string,
    @Query('interval') interval: '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | '360' | '720' | 'D' | 'W' | 'M' = '60',
    @Query('limit') limit: number = 50,
    @Query('start') start?: number,
    @Query('end') end?: number
  ): Promise<VolumeData[]> {
    this.logger.log(`GET /api/market/volume/${symbol}?interval=${interval}&limit=${limit}`);
    return this.marketService.getVolumeData(symbol, interval, limit, start, end);
  }

  @Get('liquidations/:symbol')
  async getLiquidationSummary(@Param('symbol') symbol: string) {
    this.logger.log(`GET /api/market/liquidations/${symbol}`);
    return this.marketService.getLiquidationSummary(symbol);
  }

  @Get('multi-symbol-data')
  async getMultiSymbolData(
    @Query('symbols') symbols: string,
    @Query('dataType') dataType: 'longShort' | 'openInterest' | 'volume'
  ) {
    const symbolsArray = symbols.split(',').map(s => s.trim());
    this.logger.log(`GET /api/market/multi-symbol-data?symbols=${symbols}&dataType=${dataType}`);
    return this.marketService.getMultiSymbolData(symbolsArray, dataType);
  }

  @Get('health')
  getHealth() {
    return { 
      status: 'ok', 
      message: 'Market service is running',
      timestamp: new Date().toISOString()
    };
  }
} 