import { Controller, Get, Param, Query, Post } from '@nestjs/common';
import { TradesService } from './trades.service';
import { BybitWebSocketService } from './bybit-websocket.service';

@Controller('trades')
export class TradesController {
  constructor(
    private readonly tradesService: TradesService,
    private readonly bybitService: BybitWebSocketService,
  ) {}

  // Obtener datos actuales (acumulador en memoria)
  @Get(':symbol/current')
  async getCurrentData(@Param('symbol') symbol: string) {
    return this.tradesService.getCurrentData(symbol.toUpperCase());
  }

  // Obtener datos históricos por rango de fechas
  @Get(':symbol/history')
  async getHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h por defecto
    const toDate = to ? new Date(to) : new Date();
    const limitNum = limit ? parseInt(limit) : 1000;

    return this.tradesService.getHistory(symbol.toUpperCase(), fromDate, toDate, limitNum);
  }

  // Obtener datos de un día específico
  @Get(':symbol/day/:date')
  async getDayData(
    @Param('symbol') symbol: string,
    @Param('date') date: string,
  ) {
    const targetDate = new Date(date);
    return this.tradesService.getDayData(symbol.toUpperCase(), targetDate);
  }

  // Obtener resumen agregado (por minutos/horas)
  @Get(':symbol/summary')
  async getSummary(
    @Param('symbol') symbol: string,
    @Query('interval') interval: 'minute' | 'hour' = 'minute',
    @Query('duration') duration?: string,
  ) {
    const durationHours = duration ? parseInt(duration) : 24;
    return this.tradesService.getSummary(symbol.toUpperCase(), interval, durationHours);
  }

  // Obtener símbolos disponibles
  @Get('symbols')
  async getAvailableSymbols() {
    return this.tradesService.getAvailableSymbols();
  }

  // 🟢 Control de recolección de datos
  @Post('control/pause')
  async pauseDataCollection() {
    this.bybitService.pause();
    return { 
      message: '⏸️ Recolección de datos pausada exitosamente',
      status: 'paused',
      timestamp: new Date().toISOString()
    };
  }

  @Post('control/resume')
  async resumeDataCollection() {
    this.bybitService.resume();
    return { 
      message: '▶️ Recolección de datos reanudada exitosamente',
      status: 'active',
      timestamp: new Date().toISOString()
    };
  }

  @Get('control/status')
  async getCollectionStatus() {
    const status = this.bybitService.getStatus();
    return {
      ...status,
      message: status.isPaused ? 'Recolección pausada' : 'Recolección activa',
      timestamp: new Date().toISOString()
    };
  }

  // 🟢 Endpoints para Orderbook
  @Get(':symbol/orderbook/current')
  async getCurrentOrderbook(@Param('symbol') symbol: string) {
    const status = this.bybitService.getStatus();
    const orderbookData = status.orderbookData[symbol.toUpperCase()];
    
    if (!orderbookData) {
      return {
        symbol: symbol.toUpperCase(),
        bidPrice: 0,
        askPrice: 0,
        spread: 0,
        midPrice: 0,
        imbalance: 0.5,
        lastUpdate: new Date(),
        message: 'Sin datos de orderbook disponibles'
      };
    }

    return {
      symbol: symbol.toUpperCase(),
      ...orderbookData,
      timestamp: new Date().toISOString()
    };
  }

  @Get(':symbol/orderbook/history')
  async getOrderbookHistory(
    @Param('symbol') symbol: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 60 * 60 * 1000); // 1h por defecto
    const toDate = to ? new Date(to) : new Date();
    const limitNum = limit ? parseInt(limit) : 1000;

    return this.tradesService.getOrderbookHistory(symbol.toUpperCase(), fromDate, toDate, limitNum);
  }

  @Get(':symbol/orderbook/spread-analysis')
  async getSpreadAnalysis(
    @Param('symbol') symbol: string,
    @Query('duration') duration?: string,
  ) {
    const durationMinutes = duration ? parseInt(duration) : 60; // 1 hora por defecto
    return this.tradesService.getSpreadAnalysis(symbol.toUpperCase(), durationMinutes);
  }
} 