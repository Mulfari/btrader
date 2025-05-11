import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwoFAService } from './twofa.service';
import { TwoFAController } from './twofa.controller';
import { AuthGuard } from './auth.guard';
import { PaymentsModule } from './payments/payments.module';
import { MarketHoursModule } from './market-hours/market-hours.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PaymentsModule,
    MarketHoursModule,
  ],
  controllers: [AppController, TwoFAController],
  providers: [AppService, TwoFAService, AuthGuard],
})
export class AppModule {}
