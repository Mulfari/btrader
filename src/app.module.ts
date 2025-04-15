import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TwoFAController } from './twofa.controller';
import { TwoFAService } from './twofa.service';

@Module({
  imports: [],
  controllers: [AppController, TwoFAController],
  providers: [AppService, TwoFAService],
})
export class AppModule {}
