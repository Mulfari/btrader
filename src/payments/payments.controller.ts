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
  @UseGuards(AuthGuard)
  async createSubscription(@Body() data: CreateSubscriptionDto, @Req() request: Request) {
    this.logger.log('Iniciando creación de suscripción:', {
      data,
      userId: request['user']?.id,
      headers: request.headers
    });
    
    if (!data.planId || !data.email) {
      this.logger.error('planId o email no proporcionados', { data });
      throw new BadRequestException('planId y email son requeridos');
    }

    try {
      // Verificar si el usuario ya tiene una suscripción activa
      const userId = request['user'].id;
      this.logger.log('Verificando suscripción existente para usuario:', userId);
      
      const { data: existingSubscription, error: supabaseError } = await this.supabaseService.supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'SUBSCRIBED')
        .single();

      if (supabaseError) {
        this.logger.error('Error consultando suscripción en Supabase:', supabaseError);
      }

      if (existingSubscription) {
        this.logger.warn('Usuario ya tiene suscripción activa:', {
          userId,
          subscription: existingSubscription
        });
        throw new BadRequestException('Ya tienes una suscripción activa');
      }

      // Buscar o crear el customer
      this.logger.log('Buscando cliente existente en Stripe:', data.email);
      let customer: Stripe.Customer;
      const existingCustomers = await this.stripeService.listCustomers(data.email);
      
      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
        this.logger.log('Cliente existente encontrado:', {
          customerId: customer.id,
          email: customer.email
        });
      } else {
        this.logger.log('Creando nuevo cliente en Stripe:', data.email);
        customer = await this.stripeService.createCustomer(data.email);
        this.logger.log('Nuevo cliente creado:', {
          customerId: customer.id,
          email: customer.email
        });
      }
      
      // Crear la suscripción
      this.logger.log('Iniciando creación de suscripción en Stripe:', {
        customerId: customer.id,
        planId: data.planId
      });

      const subscription = await this.stripeService.createSubscription(
        customer.id,
        data.planId
      );

      this.logger.log('Suscripción creada exitosamente:', {
        subscriptionId: subscription.id,
        status: subscription.status,
        customerId: customer.id,
        planId: data.planId
      });

      // La suscripción incluirá el latest_invoice.payment_intent expandido
      const invoice = subscription.latest_invoice as Stripe.Invoice;
      if (!invoice) {
        throw new Error('No se generó la factura para la suscripción');
      }

      const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;
      if (!paymentIntent?.client_secret) {
        throw new Error('No se generó el payment intent para la suscripción');
      }

      const response = {
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      };

      this.logger.log('Retornando respuesta:', response);
      return response;

    } catch (error) {
      this.logger.error('Error detallado creando suscripción:', {
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
          code: error.code
        },
        requestData: data,
        userId: request['user']?.id
      });

      if (error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Stripe.errors.StripeError) {
        this.logger.error('Error de Stripe:', {
          type: error.type,
          code: error.code,
          message: error.message
        });
        throw new BadRequestException(error.message);
      }
      throw new InternalServerErrorException(`Error procesando la suscripción: ${error.message}`);
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