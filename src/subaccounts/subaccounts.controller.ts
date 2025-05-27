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
      const userId = req.user.id;
      
      this.logger.debug('User object from request:', {
        user: req.user,
        userId: userId,
        userIdType: typeof userId
      });
      
      if (!userId) {
        this.logger.error('User ID not found in request');
        throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
      }
      
      this.logger.log(`Getting open perpetual operations for user: ${userId}`);

      // Supabase client is guaranteed to be initialized in constructor

      // Get user's subaccounts directly from table and decrypt manually
      // This approach avoids RPC function cache issues
      const { data: rawSubaccounts, error: queryError } = await this.supabase
        .from('subaccounts')
        .select('id, name, api_key, secret_key, is_demo, created_at, updated_at')
        .eq('user_id', userId);

      if (queryError) {
        this.logger.error('Error querying subaccounts table:', {
          error: queryError,
          userId: userId,
          userIdType: typeof userId
        });
        throw new Error(`Failed to fetch subaccounts: ${queryError.message}`);
      }

      // Decrypt the API keys for each subaccount
      const subaccounts: any[] = [];
      for (const rawSub of rawSubaccounts || []) {
        try {
          // Get decrypted keys from vault
          const { data: apiKeyData } = await this.supabase
            .from('vault.decrypted_secrets')
            .select('decrypted_secret')
            .eq('name', rawSub.api_key)
            .single();

          const { data: secretKeyData } = await this.supabase
            .from('vault.decrypted_secrets')
            .select('decrypted_secret')
            .eq('name', rawSub.secret_key)
            .single();

          subaccounts.push({
            id: rawSub.id,
            name: rawSub.name,
            api_key: apiKeyData?.decrypted_secret || null,
            secret_key: secretKeyData?.decrypted_secret || null,
            is_demo: rawSub.is_demo,
            created_at: rawSub.created_at,
            updated_at: rawSub.updated_at
          });
        } catch (decryptError) {
          this.logger.warn(`Failed to decrypt keys for subaccount ${rawSub.id}:`, decryptError);
          // Include the subaccount but with null keys
          subaccounts.push({
            id: rawSub.id,
            name: rawSub.name,
            api_key: null,
            secret_key: null,
            is_demo: rawSub.is_demo,
            created_at: rawSub.created_at,
            updated_at: rawSub.updated_at
          });
        }
      }

      // Subaccounts retrieved successfully

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
      
      // Si ya es una HttpException, relanzarla
      if (error instanceof HttpException) {
        throw error;
      }
      
      // De lo contrario, crear una nueva HttpException con el error
      throw new HttpException(
        error.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 