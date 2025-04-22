import { 
  Body, 
  Controller, 
  Post, 
  Headers, 
  RawBodyRequest, 
  Req,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  Get,
  UseGuards
} from '@nestjs/common';
import { Request } from 'express';
import { StripeService } from './stripe.service';
import { WebhookHandlerService } from './webhook-handler.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import Stripe from 'stripe';
import { SupabaseService } from './supabase.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly webhookHandler: WebhookHandlerService,
    private readonly supabaseService: SupabaseService
  ) {}

  @Post('create-intent')
  async createPaymentIntent(@Body() data: CreatePaymentIntentDto) {
    try {
      const paymentIntent = await this.stripeService.createPaymentIntent(data.planId);
      return {
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      this.logger.error('Error creando PaymentIntent', {
        error,
        data,
      });
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Error procesando el pago');
    }
  }

  @Get('subscription-status')
  @UseGuards(AuthGuard)
  async getSubscriptionStatus(@Req() request: Request) {
    try {
      const userId = request['user'].id;
      const { data: subscription } = await this.supabaseService.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      return {
        status: subscription?.status || 'none',
        currentPeriodEnd: subscription?.current_period_end || null,
        plan: subscription?.metadata?.planId || null
      };
    } catch (error) {
      this.logger.error('Error obteniendo estado de suscripción', {
        error,
      });
      throw new InternalServerErrorException('Error obteniendo estado de suscripción');
    }
  }

  @Post('create-customer')
  async createCustomer(@Body() data: CreateCustomerDto) {
    try {
      const customer = await this.stripeService.createCustomer(
        data.email,
        data.name,
      );
      return customer;
    } catch (error) {
      this.logger.error('Error creando Customer', {
        error,
        data,
      });
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Error creando el cliente');
    }
  }

  @Post('webhook')
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    try {
      if (!signature) {
        throw new BadRequestException('No se encontró la firma de Stripe');
      }

      const payload = request.rawBody?.toString() || '';
      const event = await this.stripeService.constructEventFromPayload(
        payload,
        signature,
      );

      // Procesar el evento de forma asíncrona
      await this.webhookHandler.handleEvent(event);

      // Responder inmediatamente
      return { received: true };
    } catch (error) {
      this.logger.error('Error procesando webhook', {
        error,
        signature,
      });
      if (error instanceof Stripe.errors.StripeSignatureVerificationError) {
        throw new BadRequestException('Firma inválida');
      }
      throw new InternalServerErrorException('Error procesando webhook');
    }
  }
} 