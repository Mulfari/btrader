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

  private generateSignature(apiSecret: string, timestamp: number, params: string): string {
    const message = timestamp + 'GET' + '/v5/position/list' + params;
    return crypto.createHmac('sha256', apiSecret).update(message).digest('hex');
  }

  async getOpenPerpetualOperations(subaccounts: Array<{
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }>): Promise<Operation[]> {
    const allOperations: Operation[] = [];

    for (const subaccount of subaccounts) {
      try {
        this.logger.log(`Getting positions for subaccount: ${subaccount.name || subaccount.id}`);
        const operations = await this.getPositionsForSubaccount(subaccount);
        allOperations.push(...operations);
        this.logger.log(`Found ${operations.length} positions for subaccount: ${subaccount.name || subaccount.id}`);
      } catch (error: any) {
        this.logger.error(`Error getting positions for subaccount ${subaccount.name || subaccount.id}:`, {
          error: error.message,
          subaccountId: subaccount.id,
          isDemo: subaccount.is_demo
        });
        // Continue with other subaccounts even if one fails
      }
    }

    return allOperations;
  }

  private async getPositionsForSubaccount(subaccount: {
    id: string;
    api_key: string;
    secret_key: string;
    is_demo: boolean;
    name?: string;
  }): Promise<Operation[]> {
    try {
      const timestamp = Date.now();
      const params = '?category=linear&settleCoin=USDT';
      const signature = this.generateSignature(subaccount.secret_key, timestamp, params);

      // Use testnet URL if it's a demo account
      const baseUrl = subaccount.is_demo 
        ? 'https://api-testnet.bybit.com' 
        : 'https://api.bybit.com';

      this.logger.debug(`Calling Bybit API for ${subaccount.name || subaccount.id}:`, {
        url: `${baseUrl}/v5/position/list`,
        isDemo: subaccount.is_demo
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
          subaccountId: subaccount.id
        });
        throw new Error(`Bybit API error: ${response.data.retMsg} (code: ${response.data.retCode})`);
      }

      const positions: BybitPosition[] = response.data.result?.list || [];
      this.logger.debug(`Bybit returned ${positions.length} total positions for ${subaccount.name}`);
      
      // Filter only positions with size > 0 (open positions)
      const openPositions = positions.filter(pos => parseFloat(pos.size) > 0);
      this.logger.log(`Found ${openPositions.length} open positions for ${subaccount.name}`);

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
          data: error.response?.data,
          message: error.message,
          subaccountId: subaccount.id
        });
        
        // Si es un error 401, probablemente las API keys son inválidas
        if (error.response?.status === 401) {
          throw new Error(`Invalid API credentials for subaccount ${subaccount.name || subaccount.id}`);
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