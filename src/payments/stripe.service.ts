import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const PRICE_IDS = {
  'price_1RGoGnRuWbKDYbCwIEZiCDvu': 'price_1RGoGnRuWbKDYbCwIEZiCDvu',  // ID del precio mensual
  'price_1RGoGwRuWbKDYbCwfBEGRjlr': 'price_1RGoGwRuWbKDYbCwfBEGRjlr'   // ID del precio anual
};

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY must be defined');
    }
    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16' as Stripe.LatestApiVersion,
    });
  }

  async listCustomers(email: string): Promise<Stripe.ApiListPromise<Stripe.Customer>> {
    return this.stripe.customers.list({
      email,
      limit: 1,
    });
  }

  async createSubscription(customerId: string, planId: string): Promise<Stripe.Subscription> {
    if (!PRICE_IDS[planId]) {
      throw new Error(`Plan no válido: ${planId}`);
    }

    try {
      return await this.stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: planId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent']
      });
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw new Error(`Error al crear la suscripción: ${error.message}`);
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