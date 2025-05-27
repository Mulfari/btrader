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
        hasKey: !!supabaseKey,
        envVars: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });
      
      // No lanzar error aquí para evitar que la aplicación no arranque
      // En su lugar, manejar el error cuando se intente usar el cliente
      this.logger.warn('Supabase client not initialized due to missing configuration');
      this.supabase = null as any;
      return;
    }

    try {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing Supabase client:', error);
      this.supabase = null as any;
    }
  }

  @Get('user/all-open-perpetual-operations')
  @UseGuards(AuthGuard)
  async getUserOpenPerpetualOperations(@Request() req: any) {
    try {
      const userId = req.user.userId;
      this.logger.log(`Getting open perpetual operations for user: ${userId}`);

      // Verificar que la configuración de Supabase está correcta
      if (!this.supabase) {
        this.logger.error('Supabase client not initialized');
        throw new HttpException('Database connection not available', HttpStatus.SERVICE_UNAVAILABLE);
      }

      // Get user's subaccounts using the backend-specific function
      // This function is designed to work with service role key
      const { data: subaccounts, error } = await this.supabase
        .rpc('get_user_subaccounts_backend', { p_user_id: userId });

      if (error) {
        this.logger.error('Error fetching user subaccounts:', error);
        
        // Si es un error de función no encontrada, dar un mensaje más claro
        if (error.message?.includes('function') && error.message?.includes('does not exist')) {
          throw new HttpException(
            'Database function not found. Please ensure database migrations are up to date.',
            HttpStatus.SERVICE_UNAVAILABLE
          );
        }
        
        throw new HttpException(
          `Failed to fetch subaccounts: ${error.message}`,
          HttpStatus.BAD_REQUEST
        );
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