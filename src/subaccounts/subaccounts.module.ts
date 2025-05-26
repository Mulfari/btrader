import { Module } from '@nestjs/common';
import { SubaccountsController } from './subaccounts.controller';
import { SubaccountsService } from './subaccounts.service';

@Module({
  controllers: [SubaccountsController],
  providers: [SubaccountsService],
  exports: [SubaccountsService], // Exportamos el servicio por si otros módulos lo necesitan
})
export class SubaccountsModule {} 