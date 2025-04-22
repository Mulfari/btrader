import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly supabase;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async createCheckoutSession(userId: string, amount: number) {
    try {
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
        success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
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
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
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