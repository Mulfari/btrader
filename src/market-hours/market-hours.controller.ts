import { Controller, Get } from '@nestjs/common';
import { MarketHoursService } from './market-hours.service';
import { MarketTime } from './market-hours.interface';

@Controller('market-hours') // Esto resultará en /api/market-hours por el prefijo global
export class MarketHoursController {
  constructor(private readonly marketHoursService: MarketHoursService) {}

  @Get()
  findAll(): MarketTime[] {
    return this.marketHoursService.findAll();
  }
} 