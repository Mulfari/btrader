import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwoFAService } from './twofa.service';
import { TwoFAController } from './twofa.controller';
import { AuthGuard } from './auth.guard';
import { PaymentsModule } from './payments/payments.module';

@Module({
  imports: [PaymentsModule],
  controllers: [AppController, TwoFAController],
  providers: [AppService, TwoFAService, AuthGuard],
})
export class AppModule {}
