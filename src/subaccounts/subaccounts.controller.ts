import { Controller, Get, Post, Body, UseGuards, Request, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SubaccountsService, OrderRequest } from './subaccounts.service';
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

      // Use service role specific RPC function
      const { data: subaccounts, error } = await this.supabase
        .rpc('get_user_subaccounts_service_role', { p_user_id: userId });

      if (error) {
        this.logger.error('Error fetching user subaccounts:', {
          error: error,
          userId: userId,
          userIdType: typeof userId
        });
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

  @Post('execute-order')
  @UseGuards(AuthGuard)
  async executeOrder(@Request() req: any, @Body() body: {
    subaccountIds: string[];
    orderRequest: OrderRequest;
  }) {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        this.logger.error('User ID not found in request');
        throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
      }

      const { subaccountIds, orderRequest } = body;

      if (!subaccountIds || !Array.isArray(subaccountIds) || subaccountIds.length === 0) {
        throw new HttpException('subaccountIds is required and must be a non-empty array', HttpStatus.BAD_REQUEST);
      }

      if (!orderRequest) {
        throw new HttpException('orderRequest is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Executing order for user ${userId} on ${subaccountIds.length} subaccounts`, {
        subaccountIds,
        orderRequest
      });

      // Obtener las subcuentas del usuario
      const { data: userSubaccounts, error } = await this.supabase
        .rpc('get_user_subaccounts_service_role', { p_user_id: userId });

      if (error) {
        this.logger.error('Error fetching user subaccounts:', error);
        throw new HttpException(`Failed to fetch subaccounts: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      // Filtrar solo las subcuentas seleccionadas
      const selectedSubaccounts = userSubaccounts.filter(sub => subaccountIds.includes(sub.id));

      if (selectedSubaccounts.length === 0) {
        throw new HttpException('No valid subaccounts found', HttpStatus.BAD_REQUEST);
      }

      if (selectedSubaccounts.length !== subaccountIds.length) {
        this.logger.warn(`Some subaccounts not found. Requested: ${subaccountIds.length}, Found: ${selectedSubaccounts.length}`);
      }

      // Ejecutar órdenes en todas las subcuentas seleccionadas en paralelo
      const orderPromises = selectedSubaccounts.map(async (subaccount) => {
        try {
          const result = await this.subaccountsService.executeOrder(subaccount, orderRequest);
          return {
            subaccountId: subaccount.id,
            subaccountName: subaccount.name,
            ...result
          };
        } catch (error: any) {
          this.logger.error(`Error executing order for subaccount ${subaccount.name}:`, error);
          return {
            subaccountId: subaccount.id,
            subaccountName: subaccount.name,
            success: false,
            error: error.message || 'Unknown error occurred'
          };
        }
      });

      const results = await Promise.all(orderPromises);

      const successfulOrders = results.filter(r => r.success);
      const failedOrders = results.filter(r => !r.success);

      this.logger.log(`Order execution completed. Successful: ${successfulOrders.length}, Failed: ${failedOrders.length}`);

      return {
        totalSubaccounts: selectedSubaccounts.length,
        successfulOrders: successfulOrders.length,
        failedOrders: failedOrders.length,
        results: results
      };

    } catch (error: any) {
      this.logger.error('Error in executeOrder:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('get-balance')
  @UseGuards(AuthGuard)
  async getSubaccountBalance(@Request() req: any, @Body() body: {
    subaccountId: string;
    accountType?: 'SPOT' | 'CONTRACT';
  }) {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        this.logger.error('User ID not found in request');
        throw new HttpException('User ID not found', HttpStatus.BAD_REQUEST);
      }

      const { subaccountId, accountType = 'SPOT' } = body;

      if (!subaccountId) {
        throw new HttpException('subaccountId is required', HttpStatus.BAD_REQUEST);
      }

      this.logger.log(`Getting balance for subaccount ${subaccountId} (${accountType})`);

      // Verificar que la subcuenta pertenece al usuario
      const { data: userSubaccounts, error } = await this.supabase
        .rpc('get_user_subaccounts_service_role', { p_user_id: userId });

      if (error) {
        this.logger.error('Error fetching user subaccounts:', error);
        throw new HttpException(`Failed to fetch subaccounts: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const subaccount = userSubaccounts.find(sub => sub.id === subaccountId);

      if (!subaccount) {
        throw new HttpException('Subaccount not found or access denied', HttpStatus.FORBIDDEN);
      }

      const balance = await this.subaccountsService.getAccountBalance(subaccount, accountType);

      return {
        subaccountId: subaccount.id,
        subaccountName: subaccount.name,
        accountType,
        balance
      };

    } catch (error: any) {
      this.logger.error('Error in getSubaccountBalance:', error);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(
        error.message || 'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 