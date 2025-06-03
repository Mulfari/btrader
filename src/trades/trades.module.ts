import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';
import { LongShortRatio } from './long-short-ratio.entity';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { BybitWebSocketService } from './bybit-websocket.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TradeAggregate, 
      OrderbookSnapshot, 
      OpenInterest,
      FundingRate,
      LongShortRatio
    ])
  ],
  controllers: [TradesController],
  providers: [TradesService, BybitWebSocketService],
  exports: [TradesService, BybitWebSocketService],
})
export class TradesModule {} 