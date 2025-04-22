import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentsController } from './payments.controller';
import { StripeService } from './stripe.service';
import { WebhookHandlerService } from './webhook-handler.service';
import { SupabaseService } from './supabase.service';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentsController],
  providers: [StripeService, WebhookHandlerService, SupabaseService],
  exports: [StripeService],
})
export class PaymentsModule {} 