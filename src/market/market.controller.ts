import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';
import { MarketService, SpotMarketTicker, PerpetualMarketTicker } from './market.service';

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

  @Get('health')
  getHealth() {
    return { 
      status: 'ok', 
      message: 'Market service is running',
      timestamp: new Date().toISOString()
    };
  }
} 