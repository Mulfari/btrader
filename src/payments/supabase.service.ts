import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Las variables de entorno de Supabase no están configuradas');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async checkEventProcessed(eventId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('stripe_events')
      .select('id')
      .eq('id', eventId)
      .single();
    
    return !!data;
  }

  async recordEvent(eventId: string, eventType: string, eventData: any): Promise<void> {
    await this.supabase
      .from('stripe_events')
      .insert({
        id: eventId,
        type: eventType,
        data: eventData,
      });
  }

  async createPayment(data: {
    payment_intent_id: string;
    amount: number;
    currency: string;
    status: string;
    customer_email?: string;
    metadata?: any;
  }): Promise<void> {
    await this.supabase
      .from('payments')
      .insert(data);
  }

  async updatePaymentStatus(paymentIntentId: string, status: string): Promise<void> {
    await this.supabase
      .from('payments')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('payment_intent_id', paymentIntentId);
  }

  async createSubscription(data: {
    stripe_subscription_id: string;
    customer_id: string;
    status: string;
    current_period_start: Date;
    current_period_end: Date;
    metadata?: any;
  }): Promise<void> {
    await this.supabase
      .from('subscriptions')
      .insert(data);
  }

  async updateSubscription(subscriptionId: string, data: {
    status?: string;
    current_period_start?: Date;
    current_period_end?: Date;
    metadata?: any;
  }): Promise<void> {
    await this.supabase
      .from('subscriptions')
      .update({
        ...data,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId);
  }
} 