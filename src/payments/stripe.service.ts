import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

const PLAN_PRICES = {
  plan_basic: {
    amount: 999, // $9.99
    currency: 'usd'
  },
  plan_pro: {
    amount: 1999, // $19.99
    currency: 'usd'
  },
  plan_enterprise: {
    amount: 4999, // $49.99
    currency: 'usd'
  }
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
      apiVersion: '2025-03-31.basil',
    });
  }

  async createPaymentIntent(planId: string): Promise<Stripe.PaymentIntent> {
    const plan = PLAN_PRICES[planId];
    if (!plan) {
      throw new Error('Plan no válido');
    }

    return this.stripe.paymentIntents.create({
      amount: plan.amount,
      currency: plan.currency,
      metadata: {
        planId
      }
    });
  }

  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    return this.stripe.customers.create({
      email,
      name,
    });
  }

  async attachPaymentMethod(customerId: string, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return this.stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
  }

  async constructEventFromPayload(payload: string, signature: string): Promise<Stripe.Event> {
    const webhookSecret = this.configService.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET must be defined');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
} 