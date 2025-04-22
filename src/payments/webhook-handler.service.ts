import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { SupabaseService } from './supabase.service';

interface ExpandedSubscription extends Stripe.Subscription {
  current_period_end: number;
}

interface ExpandedInvoice extends Stripe.Invoice {
  subscription: Stripe.Subscription;
}

@Injectable()
export class WebhookHandlerService {
  private readonly logger = new Logger(WebhookHandlerService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Procesando evento: ${event.type}`);

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as ExpandedSubscription);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as ExpandedSubscription);
        break;
      case 'invoice.payment_succeeded':
        await this.handleInvoicePaid(event.data.object as ExpandedInvoice);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(event.data.object as ExpandedInvoice);
        break;
      default:
        this.logger.log(`Evento no manejado: ${event.type}`);
    }
  }

  private async handleSubscriptionUpdate(subscription: ExpandedSubscription): Promise<void> {
    const customerId = subscription.customer as string;
    const status = subscription.status;
    const currentPeriodEnd = new Date(subscription.current_period_end * 1000);

    // Obtener el customer para conseguir el email
    const { data: userData } = await this.supabaseService.supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (!userData) {
      this.logger.error(`No se encontró usuario para el customer_id: ${customerId}`);
      return;
    }

    // Actualizar la suscripción en la base de datos
    const { error } = await this.supabaseService.supabase
      .from('subscriptions')
      .upsert({
        user_id: userData.id,
        status: status,
        current_period_end: currentPeriodEnd.toISOString(),
        subscription_id: subscription.id,
        metadata: {
          planId: subscription.items.data[0].price.id
        }
      });

    if (error) {
      this.logger.error('Error actualizando suscripción en Supabase', error);
      throw error;
    }
  }

  private async handleSubscriptionCanceled(subscription: ExpandedSubscription): Promise<void> {
    await this.handleSubscriptionUpdate({
      ...subscription,
      status: 'canceled'
    });
  }

  private async handleInvoicePaid(invoice: ExpandedInvoice): Promise<void> {
    if (invoice.subscription) {
      await this.handleSubscriptionUpdate(invoice.subscription as ExpandedSubscription);
    }
  }

  private async handleInvoicePaymentFailed(invoice: ExpandedInvoice): Promise<void> {
    if (invoice.subscription) {
      await this.handleSubscriptionUpdate({
        ...invoice.subscription as ExpandedSubscription,
        status: 'past_due'
      });
    }
  }
} 