import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { OrderbookSnapshot } from './orderbook-snapshot.entity';
import { OpenInterest } from './open-interest.entity';
import { FundingRate } from './funding-rate.entity';
import { LongShortRatio } from './long-short-ratio.entity';
import { Liquidation } from './liquidation.entity';
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
      LongShortRatio,
      Liquidation
    ])
  ],
  controllers: [TradesController],
  providers: [TradesService, BybitWebSocketService],
  exports: [TradesService, BybitWebSocketService],
})
export class TradesModule {} 