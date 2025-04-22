import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { SupabaseService } from './supabase.service';

interface StripeSubscriptionWithDates extends Stripe.Subscription {
  current_period_end: number;
  current_period_start: number;
}

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    // Procesar el evento de forma asíncrona
    setImmediate(async () => {
      try {
        // Verificar idempotencia
        const isProcessed = await this.supabaseService.checkEventProcessed(event.id);
        if (isProcessed) {
          this.logger.log(`Evento ${event.id} ya fue procesado anteriormente`);
          return;
        }

        // Procesar el evento
        await this.processEvent(event);

        // Registrar el evento como procesado
        await this.supabaseService.recordEvent(event.id, event.type, event.data);
      } catch (error) {
        this.logger.error('Error procesando evento de Stripe', {
          error,
          eventType: event.type,
          eventId: event.id,
        });
      }
    });
  }

  private async processEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Procesando evento ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(event.data.object as StripeSubscriptionWithDates);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as StripeSubscriptionWithDates);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as StripeSubscriptionWithDates);
        break;
      default:
        this.logger.log(`Evento no manejado: ${event.type}`);
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log('Procesando pago exitoso', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });

    await this.supabaseService.createPayment({
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'succeeded',
      customer_email: paymentIntent.receipt_email || undefined,
      metadata: paymentIntent.metadata,
    });
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.warn('Procesando pago fallido', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      error: paymentIntent.last_payment_error,
    });

    await this.supabaseService.createPayment({
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      status: 'failed',
      customer_email: paymentIntent.receipt_email || undefined,
      metadata: {
        ...paymentIntent.metadata,
        error: paymentIntent.last_payment_error,
      },
    });
  }

  private async handleSubscriptionCreated(subscription: StripeSubscriptionWithDates): Promise<void> {
    this.logger.log('Procesando suscripción creada', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });

    await this.supabaseService.createSubscription({
      stripe_subscription_id: subscription.id,
      customer_id: typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer.id,
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      metadata: subscription.metadata,
    });
  }

  private async handleSubscriptionUpdated(subscription: StripeSubscriptionWithDates): Promise<void> {
    this.logger.log('Procesando actualización de suscripción', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });

    await this.supabaseService.updateSubscription(subscription.id, {
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      metadata: subscription.metadata,
    });
  }

  private async handleSubscriptionDeleted(subscription: StripeSubscriptionWithDates): Promise<void> {
    this.logger.log('Procesando cancelación de suscripción', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
    });

    await this.supabaseService.updateSubscription(subscription.id, {
      status: 'canceled',
      metadata: {
        ...subscription.metadata,
        canceled_at: new Date().toISOString(),
      },
    });
  }
} 