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
  price: number;
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
          this.logger.debug(`Position: ${pos.symbol} ${pos.side} Size: ${pos.size} PnL: ${pos.unrealisedPnl}`);
        });
      }

      // Transform Bybit positions to our Operation format
      return openPositions.map(position => ({
        id: `${subaccount.id}-${position.symbol}-${position.side}`,
        subAccountId: subaccount.id,
        symbol: position.symbol.replace('USDT', ''), // Remove USDT suffix
        side: position.side === 'Buy' ? 'buy' : 'sell' as const,
        status: 'open' as const,
        price: parseFloat(position.entryPrice),
        quantity: parseFloat(position.size),
        leverage: parseFloat(position.leverage),
        openTime: new Date(parseInt(position.createdTime)),
        profit: parseFloat(position.unrealisedPnl),
        profitPercentage: this.calculateProfitPercentage(
          parseFloat(position.entryPrice),
          parseFloat(position.markPrice),
          position.side === 'Buy'
        ),
        exchange: 'Bybit',
      }));

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

  private calculateProfitPercentage(entryPrice: number, markPrice: number, isLong: boolean): number {
    if (entryPrice === 0) return 0;
    
    if (isLong) {
      return ((markPrice - entryPrice) / entryPrice) * 100;
    } else {
      return ((entryPrice - markPrice) / entryPrice) * 100;
    }
  }
} 