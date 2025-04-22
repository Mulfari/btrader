import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwoFAService } from './twofa.service';
import { TwoFAController } from './twofa.controller';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [],
  controllers: [AppController, TwoFAController],
  providers: [AppService, TwoFAService, AuthGuard],
})
export class AppModule {}
