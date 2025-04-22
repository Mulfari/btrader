import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly stripe: Stripe;
  private readonly supabase;

  constructor(private configService: ConfigService) {
    const stripeKey = this.configService.getOrThrow<string>('STRIPE_SECRET_KEY');
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const supabaseKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.stripe = new Stripe(stripeKey, {
      apiVersion: '2025-03-31.basil',
    });

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  onModuleInit() {
    // Validar que todas las variables de entorno necesarias estén presentes
    const requiredEnvVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'FRONTEND_URL'
    ];

    for (const envVar of requiredEnvVars) {
      const value = this.configService.get<string>(envVar);
      if (!value) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }
  }

  async createCheckoutSession(userId: string, amount: number) {
    try {
      const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'Trading Credits',
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/payment/cancel`,
      });

      // Crear registro en la tabla orders
      const { error } = await this.supabase
        .from('orders')
        .insert({
          user_id: userId,
          stripe_id: session.id,
          amount: amount,
          status: 'pending',
        });

      if (error) {
        throw new Error(`Error creating order: ${error.message}`);
      }

      return { sessionId: session.id };
    } catch (error) {
      throw new Error(`Error creating checkout session: ${error.message}`);
    }
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    try {
      const webhookSecret = this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );

      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object as Stripe.Checkout.Session;
          await this.updateOrderStatus(session.id, 'succeeded');
          break;

        case 'payment_intent.payment_failed':
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          await this.updateOrderStatus(paymentIntent.id, 'failed');
          break;
      }

      return { received: true };
    } catch (error) {
      throw new Error(`Webhook error: ${error.message}`);
    }
  }

  private async updateOrderStatus(stripeId: string, status: 'succeeded' | 'failed') {
    const { error } = await this.supabase
      .from('orders')
      .update({ status })
      .eq('stripe_id', stripeId);

    if (error) {
      throw new Error(`Error updating order status: ${error.message}`);
    }
  }
} 