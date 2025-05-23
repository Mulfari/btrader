import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { AuthGuard } from '../auth.guard';
import { createClient } from '@supabase/supabase-js';

@Controller('subaccounts')
@UseGuards(AuthGuard)
export class SubaccountsController {
  private readonly logger = new Logger(SubaccountsController.name);
  private supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  constructor(private readonly subaccountsService: SubaccountsService) {}

  @Get('user/all-open-perpetual-operations')
  async getAllOpenPerpetualOperations(@Request() req: any) {
    try {
      this.logger.log('GET /api/subaccounts/user/all-open-perpetual-operations');
      
      // Get user ID from the authenticated request
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get user's subaccounts from Supabase
      const { data: subaccounts, error } = await this.supabase
        .from('subaccounts')
        .select('id, api_key, secret_key, is_demo')
        .eq('user_id', userId);

      if (error) {
        this.logger.error('Error fetching subaccounts from Supabase:', error);
        throw new Error('Failed to fetch subaccounts');
      }

      if (!subaccounts || subaccounts.length === 0) {
        this.logger.log('No subaccounts found for user');
        return { operations: [] };
      }

      this.logger.log(`Found ${subaccounts.length} subaccounts for user ${userId}`);

      // Get open positions from all subaccounts
      const operations = await this.subaccountsService.getOpenPerpetualOperations(subaccounts);

      this.logger.log(`Retrieved ${operations.length} open operations`);

      return { operations };

    } catch (error) {
      this.logger.error('Error in getAllOpenPerpetualOperations:', error);
      throw error;
    }
  }
} 