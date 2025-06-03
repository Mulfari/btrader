import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';
import { LongShortRatio } from './long-short-ratio.entity';
import { Liquidation } from './liquidation.entity';
import { VolumeProfile } from './volume-profile.entity';
import { MarketSentiment } from './market-sentiment.entity';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { BybitWebSocketService } from './bybit-websocket.service';
import { AdvancedAnalyticsService } from './advanced-analytics.service';
import { AdvancedAnalyticsController } from './advanced-analytics.controller';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';
import { AnalyticsSchedulerController } from './analytics-scheduler.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TradeAggregate, 
      OrderbookSnapshot, 
      OpenInterest,
      FundingRate,
      LongShortRatio,
      Liquidation,
      VolumeProfile,
      MarketSentiment
    ])
  ],
  controllers: [
    TradesController, 
    AdvancedAnalyticsController,
    AnalyticsSchedulerController,
  ],
  providers: [
    TradesService, 
    BybitWebSocketService,
    AdvancedAnalyticsService,
    AnalyticsSchedulerService,
  ],
  exports: [
    TradesService, 
    BybitWebSocketService,
    AdvancedAnalyticsService,
    AnalyticsSchedulerService,
  ],
})
export class TradesModule {} 