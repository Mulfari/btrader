import { Module } from '@nestjs/common';
import { MarketHoursController } from './market-hours.controller';
import { MarketHoursService } from './market-hours.service';

@Module({
  controllers: [MarketHoursController],
  providers: [MarketHoursService],
})
export class MarketHoursModule {} 