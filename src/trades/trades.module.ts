import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeAggregate } from './trade-aggregate.entity';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { BybitWebSocketService } from './bybit-websocket.service';

@Module({
  imports: [TypeOrmModule.forFeature([TradeAggregate])],
  controllers: [TradesController],
  providers: [TradesService, BybitWebSocketService],
  exports: [TradesService, BybitWebSocketService],
})
export class TradesModule {} 