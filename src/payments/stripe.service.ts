import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const PRICE_IDS = {
  premium_monthly: 'price_1RGo1qRuWbKDYbCwjbVIzhnV',  // ID del precio mensual
  premium_annual: 'price_1RGo28RuWbKDYbCwPoamchVZ'    // ID del precio anual
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
      apiVersion: '2025-03-31.basil' as Stripe.LatestApiVersion,
    });
  }

  async createSubscription(customerId: string, planId: string): Promise<Stripe.Subscription> {
    const priceId = PRICE_IDS[planId];
    if (!priceId) {
      throw new Error('Plan no válido');
    }

    return this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent']
    });
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