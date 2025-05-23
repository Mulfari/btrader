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
  async getAllOpenPerpetualOperations(@Request() req: any) {
    try {
      this.logger.log('GET /api/subaccounts/user/all-open-perpetual-operations');
      
      // Get user ID from the authenticated request
      const userId = req.user?.id;
      if (!userId) {
        this.logger.error('User not authenticated - no user ID in request');
        throw new HttpException('User not authenticated', HttpStatus.UNAUTHORIZED);
      }

      this.logger.log(`Fetching subaccounts for user: ${userId}`);

      // Usar la función RPC en lugar de acceder directamente a la tabla
      const { data: subaccounts, error } = await this.supabase.rpc('get_user_subaccounts', {
        p_user_id: userId
      });

      if (error) {
        this.logger.error('Error fetching subaccounts from Supabase RPC:', error);
        throw new HttpException({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Failed to fetch subaccounts',
          error: error.message
        }, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      if (!subaccounts || subaccounts.length === 0) {
        this.logger.log('No subaccounts found for user');
        return { operations: [] };
      }

      this.logger.log(`Found ${subaccounts.length} subaccounts for user ${userId}`);
      
      // Log subaccount info (sin las API keys por seguridad)
      subaccounts.forEach(sub => {
        this.logger.log(`Subaccount: ${sub.name} (ID: ${sub.id}, Demo: ${sub.is_demo})`);
      });

      // Get open positions from all subaccounts
      const operations = await this.subaccountsService.getOpenPerpetualOperations(subaccounts);

      this.logger.log(`Retrieved ${operations.length} open operations`);

      return { operations };

    } catch (error: any) {
      // Si es una HttpException, reenviarla tal cual
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Para otros errores, crear una HttpException con detalles
      this.logger.error('Unexpected error in getAllOpenPerpetualOperations:', error);
      throw new HttpException({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
        error: error.message || 'Unknown error occurred'
      }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 