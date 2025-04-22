import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const PRICE_IDS = {
  'price_test_monthly': 'price_test_monthly',  // ID del precio mensual en modo prueba
  'price_test_annual': 'price_test_annual'     // ID del precio anual en modo prueba
};

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY must be defined');
    }
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
    });
    this.logger.log('Stripe inicializado con la clave:', stripeKey.substring(0, 8) + '...');
  }

  async listCustomers(email: string): Promise<Stripe.ApiListPromise<Stripe.Customer>> {
    this.logger.log('Buscando clientes por email:', email);
    try {
      const result = await this.stripe.customers.list({
        email,
        limit: 1,
      });
      this.logger.log('Clientes encontrados:', result.data.length);
      return result;
    } catch (error) {
      this.logger.error('Error listando clientes:', {
        error: error.message,
        email
      });
      throw error;
    }
  }

  async createSubscription(customerId: string, planId: string): Promise<Stripe.Subscription> {
    this.logger.log('Validando plan:', planId);
    
    // Temporalmente deshabilitamos la validación de IDs de precios
    // hasta que tengamos los IDs correctos de prueba
    /*if (!PRICE_IDS[planId]) {
      this.logger.error('Plan no válido:', {
        planId,
        availablePlans: Object.keys(PRICE_IDS)
      });
      throw new Error(`Plan no válido: ${planId}`);
    }*/

    try {
      this.logger.log('Creando suscripción:', {
        customerId,
        planId
      });

      const subscription = await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: planId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });

      this.logger.log('Suscripción creada:', {
        subscriptionId: subscription.id,
        status: subscription.status,
        hasInvoice: !!subscription.latest_invoice,
        hasPaymentIntent: !!(subscription.latest_invoice as any)?.payment_intent
      });

      return subscription;
    } catch (error) {
      this.logger.error('Error creando suscripción:', {
        error: {
          message: error.message,
          type: error.type,
          code: error.code
        },
        customerId,
        planId
      });
      throw error;
    }
  }

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
    });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice.payment_intent']
    });
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.cancel(subscriptionId);
  }

  async constructEventFromPayload(payload: string, signature: string): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET must be defined');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
} 