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
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
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

  @Post('create-subscription')
  async createSubscription(@Body() data: CreateSubscriptionDto) {
    this.logger.log('Recibiendo petición create-subscription:', JSON.stringify(data));
    
    if (!data.planId || !data.email) {
      this.logger.error('planId o email no proporcionados');
      throw new BadRequestException('planId y email son requeridos');
    }

    try {
      // Primero creamos el customer
      this.logger.log(`Creando customer para: ${data.email}`);
      const customer = await this.stripeService.createCustomer(data.email);
      
      // Luego creamos la suscripción
      this.logger.log(`Creando suscripción para plan: ${data.planId}`);
      const subscription = await this.stripeService.createSubscription(
        customer.id,
        data.planId
      );

      this.logger.log('Suscripción creada exitosamente:', JSON.stringify({
        id: subscription.id,
        status: subscription.status,
        customerId: customer.id
      }));

      // La suscripción incluirá el latest_invoice.payment_intent expandido
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

      return {
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      };
    } catch (error) {
      this.logger.error('Error creando suscripción', {
        error: error.message,
        stack: error.stack,
        data,
        type: error.constructor.name
      });
      if (error instanceof Stripe.errors.StripeError) {
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException('Error procesando la suscripción');
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

      await this.webhookHandler.handleEvent(event);

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