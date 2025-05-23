import { Controller, Get, UseGuards, Request, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SubaccountsService } from './subaccounts.service';
import { AuthGuard } from '../auth.guard';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Controller('subaccounts')
@UseGuards(AuthGuard)
export class SubaccountsController {
  private readonly logger = new Logger(SubaccountsController.name);
  private supabase: SupabaseClient;

  constructor(private readonly subaccountsService: SubaccountsService) {
    // Inicializar Supabase en el constructor
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      this.logger.error('Supabase configuration missing', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey
      });
      throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  @Get('user/all-open-perpetual-operations')
  @UseGuards(AuthGuard)
  async getUserOpenPerpetualOperations(@Request() req: any) {
    try {
      const userId = req.user.userId;
      this.logger.log(`Getting open perpetual operations for user: ${userId}`);

      // Get user's subaccounts
      const { data: subaccounts, error } = await this.supabase
        .rpc('get_user_subaccounts', { p_user_id: userId });

      if (error) {
        this.logger.error('Error fetching user subaccounts:', error);
        throw new Error(`Failed to fetch subaccounts: ${error.message}`);
      }

      if (!subaccounts || subaccounts.length === 0) {
        this.logger.log('No subaccounts found for user');
        return { operations: [], errors: [] };
      }

      this.logger.log(`Found ${subaccounts.length} subaccounts for user`);

      // Obtener operaciones de todas las subcuentas en paralelo
      const operationsPromises = subaccounts.map(async (subaccount: any) => {
        try {
          const operations = await this.subaccountsService.getOpenPerpetualOperations(subaccount);
          return { success: true, operations, subaccountId: subaccount.id };
        } catch (error: any) {
          this.logger.error(`Error getting positions for subaccount ${subaccount.name}:`, {
            error: error.message,
            subaccountId: subaccount.id,
            isDemo: subaccount.is_demo
          });
          
          return { 
            success: false, 
            error: error.message, 
            subaccountId: subaccount.id,
            subaccountName: subaccount.name,
            isDemo: subaccount.is_demo
          };
        }
      });

      const results = await Promise.all(operationsPromises);

      // Separar operaciones exitosas de errores
      const successfulResults = results.filter(r => r.success);
      const failedResults = results.filter(r => !r.success);

      // Combinar todas las operaciones exitosas
      const allOperations = successfulResults.flatMap(r => r.operations || []);

      this.logger.log(`Retrieved ${allOperations.length} open operations from ${successfulResults.length} subaccounts`);
      
      if (failedResults.length > 0) {
        this.logger.warn(`Failed to get operations from ${failedResults.length} subaccounts`);
      }

      return { 
        operations: allOperations,
        errors: failedResults.map(r => ({
          subaccountId: r.subaccountId,
          subaccountName: r.subaccountName,
          error: r.error,
          isDemo: r.isDemo
        })),
        totalSubaccounts: subaccounts.length,
        successfulSubaccounts: successfulResults.length,
        failedSubaccounts: failedResults.length
      };
    } catch (error: any) {
      this.logger.error('Error in getUserOpenPerpetualOperations:', error);
      throw new Error(error.message || 'Internal server error');
    }
  }
} 