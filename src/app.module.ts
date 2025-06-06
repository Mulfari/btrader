import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwoFAService } from './twofa.service';
import { TwoFAController } from './twofa.controller';
import { AuthGuard } from './auth.guard';
import { PaymentsModule } from './payments/payments.module';
import { MarketHoursModule } from './market-hours/market-hours.module';
import { MarketModule } from './market/market.module';
import { SubaccountsModule } from './subaccounts/subaccounts.module';
import { TradesModule } from './trades/trades.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.PGHOST || process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.PGPORT || process.env.DATABASE_PORT || '5432'),
      username: process.env.PGUSER || process.env.DATABASE_USER || 'postgres',
      password: process.env.PGPASSWORD || process.env.DATABASE_PASSWORD || '',
      database: process.env.PGDATABASE || process.env.DATABASE_NAME || 'btrader',
      autoLoadEntities: true,
      synchronize: true, // Solo para desarrollo
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    }),
    PaymentsModule,
    MarketHoursModule,
    MarketModule,
    SubaccountsModule,
    TradesModule,
  ],
  controllers: [AppController, TwoFAController],
  providers: [AppService, TwoFAService, AuthGuard],
})
export class AppModule {}
