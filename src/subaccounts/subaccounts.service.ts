import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as crypto from 'crypto';

export interface BybitPosition {
  symbol: string;
  side: 'Buy' | 'Sell';
  size: string;
  positionValue: string;
  entryPrice: string;
  markPrice: string;
  liqPrice: string;
  bustPrice: string;
  positionMM: string;
  positionIM: string;
  tpslMode: string;
  takeProfit: string;
  stopLoss: string;
  trailingStop: string;
  unrealisedPnl: string;
  cumRealisedPnl: string;
  createdTime: string;
  updatedTime: string;
  leverage: string;
  positionStatus: string;
  autoAddMargin: number;
  adlRankIndicator: number;
  isReduceOnly: boolean;
  mmrSysUpdateTime: string;
  leverageSysUpdateTime: string;
}

export interface Operation {
  id: string;
  subAccountId: string;
  symbol: string;
  side: 'buy' | 'sell';
  status: 'open' | 'closed' | 'canceled';
  price: number | null;
  quantity: number;
  filledQuantity?: number;
  remainingQuantity?: number;
  leverage?: number;
  openTime: Date;
  closeTime?: Date;
  profit?: number;
  profitPercentage?: number;
  fee?: number;
  exchange: string;
  // Campos adicionales para futuros
  markPrice?: number | null;
  liquidationPrice?: number | null;
  positionValue?: number | null;
}

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market';
  qty: string;
  price?: string;
  category: 'spot' | 'linear';
  leverage?: string;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  orderLinkId?: string;
  message?: string;
  error?: string;
}

@Injectable()
export class SubaccountsService {
  private readonly logger = new Logger(SubaccountsService.name);

  private generateSignature(apiKey: string, apiSecret: string, timestamp: number, params: string): string {
    // Para Bybit v5, el formato es: timestamp + api_key + recv_window + queryString
    const recv_window = '5000';
    const queryString = params.substring(1); // Quitar el '?' inicial
    const message = `${timestamp}${apiKey}${recv_window}${queryString}`;
    
    return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  }

  async getOpenPerpetualOperations(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }): Promise<Operation[]> {
    this.logger.log(`Getting positions for subaccount: ${subaccount.name || subaccount.id}`);
    
    try {
      // For now, only Bybit is supported
      return await this.getPositionsForSubaccount(subaccount);
    } catch (error: any) {
      this.logger.error(`Error getting positions for subaccount ${subaccount.name}:`, {
        error: error.message,
        subaccountId: subaccount.id,
        isDemo: subaccount.is_demo
      });
      throw error;
    }
  }

  private async getPositionsForSubaccount(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }): Promise<Operation[]> {
    try {
      // Validar que tenemos las claves necesarias
      if (!subaccount.api_key || !subaccount.secret_key) {
        this.logger.error(`Missing API credentials for subaccount ${subaccount.name}`);
        throw new Error(`Missing API credentials for subaccount ${subaccount.name || subaccount.id}`);
      }

      const timestamp = Date.now();
      const params = '?category=linear&settleCoin=USDT';
      const signature = this.generateSignature(subaccount.api_key, subaccount.secret_key, timestamp, params);

      // Use testnet URL if it's a demo account
      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      this.logger.debug(`Calling Bybit API for ${subaccount.name || subaccount.id}:`, {
        url: `${baseUrl}/v5/position/list`,
        isDemo: subaccount.is_demo,
        hasApiKey: !!subaccount.api_key,
        hasSecretKey: !!subaccount.secret_key,
        apiKeyLength: subaccount.api_key?.length,
        timestamp
      });

      const response = await axios.get(`${baseUrl}/v5/position/list${params}`, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
        },
      });

      if (response.data.retCode !== 0) {
        this.logger.error(`Bybit API error for ${subaccount.name}:`, {
          retCode: response.data.retCode,
          retMsg: response.data.retMsg,
          subaccountId: subaccount.id,
          isDemo: subaccount.is_demo
        });
        
        // Mensajes de error más específicos según el código
        let errorMessage = `Bybit API error: ${response.data.retMsg}`;
        if (response.data.retCode === 10004) {
          errorMessage = `Invalid signature for ${subaccount.name}. Please check API credentials.`;
        } else if (response.data.retCode === 10003) {
          errorMessage = `Invalid API key for ${subaccount.name}. Please check API credentials.`;
        }
        
        throw new Error(errorMessage);
      }

      const positions: BybitPosition[] = response.data.result?.list || [];
      this.logger.debug(`Bybit returned ${positions.length} total positions for ${subaccount.name}`);
      
      // Filter only positions with size > 0 (open positions)
      const openPositions = positions.filter(pos => parseFloat(pos.size) > 0);
      this.logger.log(`Found ${openPositions.length} open positions for ${subaccount.name}`);

      // Log position details for debugging
      if (openPositions.length > 0) {
        openPositions.forEach(pos => {
          this.logger.debug(`Raw Position from Bybit:`, {
            symbol: pos.symbol,
            side: pos.side,
            size: pos.size,
            entryPrice: pos.entryPrice,
            markPrice: pos.markPrice,
            liqPrice: pos.liqPrice,
            unrealisedPnl: pos.unrealisedPnl,
            positionValue: pos.positionValue,
            leverage: pos.leverage,
            // Tipos de datos
            entryPriceType: typeof pos.entryPrice,
            liqPriceType: typeof pos.liqPrice,
            positionValueType: typeof pos.positionValue
          });
        });
      }

      // Transform Bybit positions to our Operation format
      return openPositions.map(position => {
        // Parsear valores con validación más estricta y logging detallado
        let entryPrice = this.parseNumericValue(position.entryPrice, 'entryPrice');
        const size = this.parseNumericValue(position.size, 'size') || 0;
        const markPrice = this.parseNumericValue(position.markPrice, 'markPrice');
        let liqPrice = this.parseNumericValue(position.liqPrice, 'liqPrice');
        const leverage = this.parseNumericValue(position.leverage, 'leverage') || 1;
        const unrealisedPnl = this.parseNumericValue(position.unrealisedPnl, 'unrealisedPnl') || 0;
        const positionValue = this.parseNumericValue(position.positionValue, 'positionValue');

        // Calcular precio de entrada dinámicamente
        // Prioridad: 1) entryPrice de Bybit, 2) calculado desde PnL y markPrice, 3) positionValue/size, 4) markPrice actual
        if (entryPrice === null && markPrice !== null && size > 0 && unrealisedPnl !== 0) {
          // Calcular entryPrice basado en PnL: entryPrice = markPrice - (PnL / size)
          const isLong = position.side === 'Buy';
          if (isLong) {
            entryPrice = markPrice - (unrealisedPnl / size);
          } else {
            entryPrice = markPrice + (unrealisedPnl / size);
          }
          this.logger.debug(`Calculated entryPrice from PnL and markPrice: ${entryPrice}`);
        }

        if (entryPrice === null && positionValue !== null && size > 0) {
          entryPrice = positionValue / size;
          this.logger.debug(`Calculated entryPrice from positionValue/size: ${entryPrice}`);
        }

        if (entryPrice === null && markPrice !== null) {
          entryPrice = markPrice;
          this.logger.debug(`Using markPrice as entryPrice fallback: ${entryPrice}`);
        }

        // USAR SOLO EL PRECIO DE LIQUIDACIÓN ORIGINAL DE BYBIT
        // No calcular dinámicamente, usar el valor real de la API
        this.logger.log(`Original Bybit liqPrice for ${position.symbol}:`, {
          originalLiqPrice: position.liqPrice,
          liqPriceType: typeof position.liqPrice,
          liqPriceParsed: liqPrice,
          side: position.side,
          leverage,
          markPrice
        });

        const createdTime = parseInt(position.createdTime) || Date.now();

        // Calcular el porcentaje de ganancia/pérdida
        const profitPercentage = entryPrice !== null && markPrice !== null 
          ? this.calculateProfitPercentage(entryPrice, markPrice, position.side === 'Buy')
          : 0;

        this.logger.log(`Transforming position for ${subaccount.name}:`, {
          symbol: position.symbol,
          entryPrice,
          size,
          markPrice,
          liqPrice,
          leverage,
          unrealisedPnl,
          positionValue,
          profitPercentage,
          createdTime,
          // Datos originales de Bybit para debugging
          originalEntryPrice: position.entryPrice,
          originalLiqPrice: position.liqPrice,
          originalPositionValue: position.positionValue,
          // Indicadores de cálculo
          entryPriceCalculated: position.entryPrice === undefined,
          liqPriceCalculated: position.liqPrice === '' || position.liqPrice === undefined,
          side: position.side
        });

        return {
          id: `${subaccount.id}-${position.symbol}-${position.side}`,
          subAccountId: subaccount.id,
          symbol: position.symbol.replace('USDT', ''), // Remove USDT suffix
          side: position.side === 'Buy' ? 'buy' : 'sell' as const,
          status: 'open' as const,
          price: entryPrice, // Precio de entrada (puede ser null si no está disponible)
          quantity: size, // Cantidad
          leverage: leverage, // Apalancamiento
          openTime: new Date(createdTime),
          profit: unrealisedPnl, // Ganancia/pérdida en USDT
          profitPercentage: profitPercentage, // Porcentaje de ganancia/pérdida
          exchange: 'Bybit',
          // Campos adicionales específicos de futuros
          markPrice: markPrice !== null && markPrice > 0 ? markPrice : undefined, // Precio actual del mercado
          liquidationPrice: liqPrice, // Precio de liquidación tal como lo devuelve Bybit
          positionValue: positionValue !== null && positionValue > 0 ? positionValue : undefined, // Valor total de la posición
        };
      });

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Axios error for subaccount ${subaccount.name || subaccount.id}:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          subaccountId: subaccount.id,
          isDemo: subaccount.is_demo
        });
        
        // Si es un error 401, probablemente las API keys son inválidas
        if (error.response?.status === 401) {
          const errorMsg = subaccount.is_demo 
            ? `Invalid testnet API credentials for ${subaccount.name}. Please ensure you're using testnet.bybit.com API keys.`
            : `Invalid API credentials for ${subaccount.name}. Please ensure you're using api.bybit.com API keys.`;
          throw new Error(errorMsg);
        }
      }
      
      throw error;
    }
  }

  private parseNumericValue(value: string | undefined, fieldName: string): number | null {
    this.logger.debug(`Parsing ${fieldName}: value="${value}", type=${typeof value}`);
    
    // Si el valor es undefined, null, o cadena vacía, devolver null
    if (value === undefined || value === null || value === '') {
      this.logger.debug(`Field ${fieldName} is undefined/null/empty: "${value}"`);
      return null;
    }
    
    // Convertir a string si no lo es ya
    const stringValue = String(value);
    
    // Si es exactamente '0', devolver 0 (no null) para algunos campos específicos
    if (stringValue === '0') {
      if (fieldName === 'entryPrice' || fieldName === 'liqPrice') {
        this.logger.debug(`Field ${fieldName} is zero, returning null for price field`);
        return null;
      } else {
        this.logger.debug(`Field ${fieldName} is zero, returning 0`);
        return 0;
      }
    }
    
    const parsed = parseFloat(stringValue);
    if (isNaN(parsed)) {
      this.logger.warn(`Field ${fieldName} could not be parsed: "${stringValue}"`);
      return null;
    }
    
    this.logger.debug(`Field ${fieldName} parsed successfully: "${stringValue}" -> ${parsed}`);
    return parsed;
  }

  private calculateProfitPercentage(entryPrice: number, markPrice: number, isLong: boolean): number {
    if (entryPrice === 0) return 0;
    
    if (isLong) {
      return ((markPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - markPrice) / entryPrice) * 100;
    }
  }

  async executeOrder(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }, orderRequest: OrderRequest): Promise<OrderResponse> {
    this.logger.log(`Executing order for subaccount: ${subaccount.name || subaccount.id}`, {
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      orderType: orderRequest.orderType,
      category: orderRequest.category,
      qty: orderRequest.qty,
      price: orderRequest.price,
      leverage: orderRequest.leverage,
      isDemo: subaccount.is_demo
    });

    try {
      // Validar que tenemos las claves necesarias
      if (!subaccount.api_key || !subaccount.secret_key) {
        this.logger.error(`Missing API credentials for subaccount ${subaccount.name}`);
        return {
          success: false,
          error: `Missing API credentials for subaccount ${subaccount.name || subaccount.id}`
        };
      }

      // Para cuentas demo, verificar que las claves son de testnet
      if (subaccount.is_demo) {
        this.logger.log(`Processing demo account order for ${subaccount.name}`);
        
        // Verificar permisos de trading para cuenta demo
        try {
          await this.checkTradingPermissions(subaccount);
        } catch (error: any) {
          this.logger.error(`Trading permissions check failed for demo account ${subaccount.name}:`, error.message);
          return {
            success: false,
            error: `Demo account trading permissions: ${error.message}`
          };
        }
      }

      // Configurar leverage si es operación de futuros
      if (orderRequest.category === 'linear' && orderRequest.leverage) {
        await this.setLeverage(subaccount, orderRequest.symbol + 'USDT', orderRequest.leverage);
      }

      const timestamp = Date.now();
      
      // Preparar parámetros de la orden
      const orderParams: any = {
        category: orderRequest.category,
        symbol: orderRequest.symbol + 'USDT', // Siempre agregar USDT
        side: orderRequest.side === 'buy' ? 'Buy' : 'Sell',
        orderType: orderRequest.orderType === 'limit' ? 'Limit' : 'Market',
        qty: orderRequest.qty,
      };

      // Agregar precio solo para órdenes limit
      if (orderRequest.orderType === 'limit' && orderRequest.price) {
        orderParams.price = orderRequest.price;
      }

      // Para futuros, agregar parámetros adicionales
      if (orderRequest.category === 'linear') {
        orderParams.positionIdx = 0; // One-way mode
      }

      // Para spot, agregar parámetros específicos de spot
      if (orderRequest.category === 'spot') {
        // Para órdenes spot market, usar qty en lugar de orderType específico
        if (orderRequest.orderType === 'market') {
          orderParams.orderType = 'Market';
        }
      }

      // Usar el método de firma mejorado para órdenes POST
      const signature = this.generateSignatureForPost(subaccount.api_key, subaccount.secret_key, timestamp, orderParams);

      // Usar testnet URL si es cuenta demo
      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      this.logger.debug(`Calling Bybit place order API for ${subaccount.name || subaccount.id}:`, {
        url: `${baseUrl}/v5/order/create`,
        isDemo: subaccount.is_demo,
        orderParams,
        timestamp,
        hasSignature: !!signature
      });

      const response = await axios.post(`${baseUrl}/v5/order/create`, orderParams, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
          'Content-Type': 'application/json',
        },
      });

      this.logger.debug(`Bybit response for ${subaccount.name}:`, {
        retCode: response.data.retCode,
        retMsg: response.data.retMsg,
        result: response.data.result
      });

      if (response.data.retCode !== 0) {
        this.logger.error(`Bybit order placement error for ${subaccount.name}:`, {
          retCode: response.data.retCode,
          retMsg: response.data.retMsg,
          subaccountId: subaccount.id,
          isDemo: subaccount.is_demo,
          orderParams
        });
        
        return {
          success: false,
          error: `Bybit API error: ${response.data.retMsg}`
        };
      }

      const result = response.data.result;
      this.logger.log(`Order placed successfully for ${subaccount.name}:`, {
        orderId: result.orderId,
        orderLinkId: result.orderLinkId,
        subaccountId: subaccount.id
      });

      return {
        success: true,
        orderId: result.orderId,
        orderLinkId: result.orderLinkId,
        message: 'Order placed successfully'
      };

    } catch (error: any) {
      this.logger.error(`Error placing order for subaccount ${subaccount.name || subaccount.id}:`, {
        error: error.message,
        subaccountId: subaccount.id,
        isDemo: subaccount.is_demo,
        orderRequest
      });

      if (axios.isAxiosError(error)) {
        this.logger.error(`Axios error for order placement:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message,
          subaccountId: subaccount.id,
          isDemo: subaccount.is_demo
        });
        
        if (error.response?.status === 401) {
          const errorMsg = subaccount.is_demo 
            ? `Invalid testnet API credentials for ${subaccount.name}. Please ensure you're using testnet.bybit.com API keys with trading permissions.`
            : `Invalid API credentials for ${subaccount.name}. Please ensure you're using api.bybit.com API keys.`;
          return {
            success: false,
            error: errorMsg
          };
        }
      }
      
      return {
        success: false,
        error: error.message || 'Unknown error occurred while placing order'
      };
    }
  }

  // Método mejorado de firma para requests POST
  private generateSignatureForPost(apiKey: string, apiSecret: string, timestamp: number, params: any): string {
    const recv_window = '5000';
    const paramString = JSON.stringify(params);
    const message = `${timestamp}${apiKey}${recv_window}${paramString}`;
    
    this.logger.debug('Signature generation:', {
      timestamp,
      apiKey: apiKey.substring(0, 8) + '...',
      recv_window,
      paramString,
      message: message.substring(0, 100) + '...'
    });
    
    return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  }

  // Verificar permisos de trading para cuentas demo
  private async checkTradingPermissions(subaccount: {
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }): Promise<void> {
    try {
      const timestamp = Date.now();
      const params = '?';
      const signature = this.generateSignature(subaccount.api_key, subaccount.secret_key, timestamp, params);

      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      // Probar acceso a la API con una llamada simple
      const response = await axios.get(`${baseUrl}/v5/user/query-api`, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
        },
      });

      if (response.data.retCode !== 0) {
        throw new Error(`API permissions check failed: ${response.data.retMsg}`);
      }

      const apiInfo = response.data.result;
      this.logger.log(`API permissions for ${subaccount.name}:`, {
        readOnly: apiInfo.readOnly,
        permissions: apiInfo.permissions
      });

      // Verificar que no sea read-only
      if (apiInfo.readOnly === 1) {
        throw new Error('API key is read-only. Trading permissions required.');
      }

      // Verificar permisos de trading
      const hasTrading = apiInfo.permissions && (
        apiInfo.permissions.ContractTrade?.includes('Order') ||
        apiInfo.permissions.Spot?.includes('SpotTrade')
      );

      if (!hasTrading) {
        throw new Error('API key does not have trading permissions. Please enable trading permissions in your Bybit API settings.');
      }

    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Invalid API credentials for demo account');
        }
      }
      throw error;
    }
  }

  private async setLeverage(subaccount: {
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }, symbol: string, leverage: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const leverageParams = {
        category: 'linear',
        symbol: symbol,
        buyLeverage: leverage,
        sellLeverage: leverage
      };

      const signature = this.generateSignatureForPost(subaccount.api_key, subaccount.secret_key, timestamp, leverageParams);

      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      const response = await axios.post(`${baseUrl}/v5/position/set-leverage`, leverageParams, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
          'Content-Type': 'application/json',
        },
      });

      if (response.data.retCode !== 0) {
        this.logger.warn(`Failed to set leverage for ${symbol}: ${response.data.retMsg}`);
        // No lanzar error ya que la orden aún puede ejecutarse con el leverage actual
      } else {
        this.logger.log(`Leverage set successfully for ${symbol}: ${leverage}x`);
      }
    } catch (error) {
      this.logger.warn(`Error setting leverage for ${symbol}:`, error);
      // No lanzar error ya que la orden aún puede ejecutarse
    }
  }

  async getAccountBalance(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }, accountType: 'UNIFIED' | 'SPOT' | 'CONTRACT' = 'UNIFIED'): Promise<any> {
    this.logger.log(`Getting account balance for subaccount: ${subaccount.name || subaccount.id}`, {
      accountType
    });
    
    try {
      if (!subaccount.api_key || !subaccount.secret_key) {
        this.logger.error(`Missing API credentials for subaccount ${subaccount.name}`);
        throw new Error(`Missing API credentials for subaccount ${subaccount.name || subaccount.id}`);
      }

      const timestamp = Date.now();
      const params = `?accountType=${accountType}`;
      const signature = this.generateSignature(subaccount.api_key, subaccount.secret_key, timestamp, params);

      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      const response = await axios.get(`${baseUrl}/v5/account/wallet-balance${params}`, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
        },
      });

      if (response.data.retCode !== 0) {
        this.logger.error(`Bybit balance API error for ${subaccount.name}:`, {
          retCode: response.data.retCode,
          retMsg: response.data.retMsg,
          subaccountId: subaccount.id,
          isDemo: subaccount.is_demo
        });
        
        throw new Error(`Bybit API error: ${response.data.retMsg}`);
      }

      return response.data.result;

    } catch (error: any) {
      this.logger.error(`Error getting balance for subaccount ${subaccount.name || subaccount.id}:`, {
        error: error.message,
        subaccountId: subaccount.id,
        isDemo: subaccount.is_demo
      });
      throw error;
    }
  }

  async testCredentials(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }): Promise<any> {
    try {
      // Validar que tenemos las claves necesarias
      if (!subaccount.api_key || !subaccount.secret_key) {
        return {
          status: 'error',
          error: 'Missing API credentials',
          recommendations: [
            'Please provide both API key and secret key',
            subaccount.is_demo 
              ? 'Create testnet API keys at: https://testnet.bybit.com/app/user/api-management'
              : 'Create mainnet API keys at: https://www.bybit.com/app/user/api-management'
          ]
        };
      }

      const timestamp = Date.now();
      const params = '?category=spot';
      const signature = this.generateSignature(subaccount.api_key, subaccount.secret_key, timestamp, params);

      // Use appropriate URL based on account type
      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      this.logger.log(`Testing credentials for ${subaccount.name || subaccount.id}:`, {
        isDemo: subaccount.is_demo,
        baseUrl,
        hasApiKey: !!subaccount.api_key,
        hasSecretKey: !!subaccount.secret_key
      });

      // Test with a simple API call (get wallet balance)
      const response = await axios.get(`${baseUrl}/v5/account/wallet-balance${params}`, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
        },
        timeout: 10000 // 10 second timeout
      });

      const isSuccess = response.data.retCode === 0;
      
      if (isSuccess) {
        this.logger.log(`Credentials test successful for ${subaccount.name}`);
        
        return {
          status: 'success',
          environment: subaccount.is_demo ? 'testnet' : 'mainnet',
          apiKeyValid: true,
          canTrade: true,
          message: subaccount.is_demo 
            ? 'Demo account credentials are valid. Ready for paper trading!'
            : 'Live account credentials are valid. Ready for real trading!',
          recommendations: subaccount.is_demo ? [
            'Use the "Request Demo Funds" feature to get test USDT',
            'All trades will be simulated with fake money',
            'Perfect for testing strategies without risk'
          ] : [
            'Ensure you have sufficient balance for trading',
            'Be careful - this is real money trading',
            'Start with small amounts to test'
          ]
        };
      } else {
        this.logger.error(`Credentials test failed for ${subaccount.name}:`, {
          retCode: response.data.retCode,
          retMsg: response.data.retMsg
        });

        return {
          status: 'error',
          environment: subaccount.is_demo ? 'testnet' : 'mainnet',
          error: response.data.retMsg,
          recommendations: this.getCredentialErrorRecommendations(response.data.retCode, subaccount.is_demo)
        };
      }

    } catch (error: any) {
      this.logger.error(`Credentials test error for ${subaccount.name}:`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      let errorMessage = 'Connection failed';
      let recommendations: string[] = [];

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          errorMessage = 'Invalid API credentials';
          recommendations = this.getCredentialErrorRecommendations(10003, subaccount.is_demo);
        } else if (error.response?.status === 403) {
          errorMessage = 'API key lacks required permissions';
          recommendations = [
            'Ensure your API key has trading permissions enabled',
            subaccount.is_demo 
              ? 'Check testnet API key permissions at: https://testnet.bybit.com/app/user/api-management'
              : 'Check mainnet API key permissions at: https://www.bybit.com/app/user/api-management'
          ];
        } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          errorMessage = 'Cannot connect to Bybit API';
          recommendations = [
            'Check your internet connection',
            'Verify firewall settings',
            'Try again in a few moments'
          ];
        }
      }

      return {
        status: 'error',
        environment: subaccount.is_demo ? 'testnet' : 'mainnet',
        error: errorMessage,
        recommendations
      };
    }
  }

  private getCredentialErrorRecommendations(retCode: number, isDemo: boolean): string[] {
    const baseRecommendations = isDemo ? [
      'Ensure you are using testnet.bybit.com API keys',
      'Create new testnet API keys at: https://testnet.bybit.com/app/user/api-management',
      'Testnet and mainnet API keys are different and cannot be mixed'
    ] : [
      'Ensure you are using www.bybit.com API keys',  
      'Create new mainnet API keys at: https://www.bybit.com/app/user/api-management',
      'Verify your API key has not expired'
    ];

    switch (retCode) {
      case 10003:
        return [
          'Invalid API key format or key not found',
          ...baseRecommendations
        ];
      case 10004:
        return [
          'Invalid signature - check your secret key',
          'Ensure there are no extra spaces in your credentials',
          ...baseRecommendations
        ];
      case 10005:
        return [
          'Invalid timestamp - check system clock',
          'Ensure your server time is synchronized',
          ...baseRecommendations
        ];
      default:
        return baseRecommendations;
    }
  }

  /**
   * Request demo funds for testnet accounts
   * This method allows demo accounts to get free USDT for testing
   */
  async requestDemoFunds(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }, coins: Array<{coin: string, amount: string}> = [
    {coin: 'USDT', amount: '10000'},
    {coin: 'BTC', amount: '1'},
    {coin: 'ETH', amount: '10'}
  ]): Promise<{success: boolean, message?: string, error?: string}> {
    
    if (!subaccount.is_demo) {
      return {
        success: false,
        error: 'Demo funds can only be requested for demo accounts'
      };
    }

    try {
      this.logger.log(`Requesting demo funds for ${subaccount.name || subaccount.id}`, {
        coins,
        subaccountId: subaccount.id
      });

      const timestamp = Date.now();
      const requestBody = {
        adjustType: 0, // 0 = add funds, 1 = reduce funds
        utaDemoApplyMoney: coins.map(coin => ({
          coin: coin.coin,
          amountStr: coin.amount
        }))
      };

      const signature = this.generateSignatureForPost(subaccount.api_key, subaccount.secret_key, timestamp, requestBody);

      const response = await axios.post('https://api-testnet.bybit.com/v5/account/demo-apply-money', requestBody, {
        headers: {
          'X-BAPI-API-KEY': subaccount.api_key,
          'X-BAPI-SIGN': signature,
          'X-BAPI-SIGN-TYPE': '2',
          'X-BAPI-TIMESTAMP': timestamp.toString(),
          'X-BAPI-RECV-WINDOW': '5000',
          'Content-Type': 'application/json',
        },
      });

      if (response.data.retCode === 0) {
        this.logger.log(`Demo funds requested successfully for ${subaccount.name}`, {
          coins,
          response: response.data.result
        });

        const coinList = coins.map(c => `${c.amount} ${c.coin}`).join(', ');
        return {
          success: true,
          message: `Successfully added demo funds: ${coinList}. Funds should appear in your account within a few minutes.`
        };
      } else {
        this.logger.error(`Demo funds request failed for ${subaccount.name}:`, {
          retCode: response.data.retCode,
          retMsg: response.data.retMsg
        });

        return {
          success: false,
          error: `Bybit API error: ${response.data.retMsg}`
        };
      }

    } catch (error: any) {
      this.logger.error(`Error requesting demo funds for ${subaccount.name}:`, {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Invalid testnet API credentials. Please check your demo account API keys.'
          };
        } else if (error.response?.status === 429) {
          return {
            success: false,
            error: 'Rate limit exceeded. Please try again in a few minutes.'
          };
        }
      }

      return {
        success: false,
        error: `Failed to request demo funds: ${error.message}`
      };
    }
  }

  /**
   * Get demo account information and status
   */
  async getDemoAccountInfo(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }): Promise<any> {
    if (!subaccount.is_demo) {
      return {
        error: 'This method only works for demo accounts',
        isDemo: false
      };
    }

    try {
      // Get account info and balance
      const balance = await this.getAccountBalance(subaccount, 'UNIFIED');
      const credentials = await this.testCredentials(subaccount);

      return {
        isDemo: true,
        environment: 'testnet',
        accountInfo: {
          subaccountId: subaccount.id,
          name: subaccount.name,
          apiKeyValid: credentials.status === 'success',
          balance: balance
        },
        features: {
          canRequestFunds: true,
          canTrade: credentials.status === 'success',
          simulatedTrading: true
        },
        urls: {
          webInterface: 'https://testnet.bybit.com',
          apiDocumentation: 'https://bybit-exchange.github.io/docs/v5/demo',
          createApiKeys: 'https://testnet.bybit.com/app/user/api-management'
        },
        limitations: [
          'Orders expire after 7 days',
          'Default rate limits apply (not upgradable)',
          'Some advanced features may not be available',
          'Data resets periodically'
        ]
      };

    } catch (error: any) {
      this.logger.error(`Error getting demo account info for ${subaccount.name}:`, error);
      return {
        error: `Failed to get demo account info: ${error.message}`,
        isDemo: true
      };
    }
  }
} 