import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { AnalyticsSchedulerService } from './analytics-scheduler.service';

@Controller('analytics/scheduler')
export class AnalyticsSchedulerController {
  constructor(
    private readonly schedulerService: AnalyticsSchedulerService
  ) {}

  /**
   * 📊 Obtener estadísticas del scheduler
   * GET /analytics/scheduler/stats
   */
  @Get('stats')
  async getSchedulerStats() {
    const stats = await this.schedulerService.getSchedulerStats();
    
    return {
      message: 'Scheduler funcionando correctamente',
      ...stats
    };
  }

  /**
   * 🎯 Ejecutar análisis manual inmediato
   * POST /analytics/scheduler/run?symbol=BTCUSDT
   */
  @Post('run')
  async runManualAnalysis(@Query('symbol') symbol?: string) {
    const startTime = Date.now();
    
    await this.schedulerService.runManualAnalysis(symbol);
    
    const duration = Date.now() - startTime;
    
    return {
      success: true,
      message: `Análisis manual completado${symbol ? ` para ${symbol}` : ''}`,
      duration: `${duration}ms`,
      timestamp: new Date()
    };
  }

  /**
   * 🔄 Actualizar símbolos procesados automáticamente
   * POST /analytics/scheduler/symbols
   * Body: { "symbols": ["BTCUSDT", "ETHUSDT", "SOLUSDT"] }
   */
  @Post('symbols')
  async updateSymbols(@Body() body: { symbols: string[] }) {
    const { symbols } = body;
    
    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return {
        success: false,
        message: 'Debe proporcionar un array de símbolos válido'
      };
    }

    // Validar que los símbolos sean strings válidos
    const validSymbols = symbols.filter(s => 
      typeof s === 'string' && s.length > 0 && s.match(/^[A-Z0-9]+$/)
    );

    if (validSymbols.length !== symbols.length) {
      return {
        success: false,
        message: 'Algunos símbolos no son válidos. Use formato: BTCUSDT, ETHUSDT, etc.'
      };
    }

    this.schedulerService.updateSymbols(validSymbols);
    
    return {
      success: true,
      message: `Símbolos actualizados: ${validSymbols.join(', ')}`,
      symbols: validSymbols
    };
  }

  /**
   * ⏰ Obtener información sobre próximas ejecuciones
   * GET /analytics/scheduler/schedule
   */
  @Get('schedule')
  async getScheduleInfo() {
    const stats = await this.schedulerService.getSchedulerStats();
    
    return {
      currentTime: new Date(),
      nextRun: stats.nextRun,
      timeUntilNextRun: this.formatTimeUntil(stats.nextRun),
      cronExpression: '0 */5 * * * *', // Cada 5 minutos
      cronDescription: 'Cada 5 minutos',
      timezone: 'UTC'
    };
  }

  /**
   * 📈 Obtener métricas de rendimiento
   * GET /analytics/scheduler/metrics
   */
  @Get('metrics')
  async getMetrics() {
    const stats = await this.schedulerService.getSchedulerStats();
    
    // Calcular métricas agregadas
    const totalVPRecords = Object.values(stats.symbolStats).reduce(
      (sum: number, stat: any) => sum + stat.volumeProfileRecords, 0
    );
    
    const totalMSRecords = Object.values(stats.symbolStats).reduce(
      (sum: number, stat: any) => sum + stat.marketSentimentRecords, 0
    );

    return {
      overview: {
        totalSymbols: stats.symbols.length,
        totalTimeframes: stats.timeframes.length,
        totalVolumeProfileRecords: totalVPRecords,
        totalMarketSentimentRecords: totalMSRecords
      },
      bySymbol: stats.symbolStats,
      configuration: {
        symbols: stats.symbols,
        timeframes: stats.timeframes,
        executionInterval: '5 minutes',
        status: stats.status
      }
    };
  }

  /**
   * 🏥 Health check del scheduler
   * GET /analytics/scheduler/health
   */
  @Get('health')
  async healthCheck() {
    try {
      const stats = await this.schedulerService.getSchedulerStats();
      
      return {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        schedulerStatus: stats.status,
        nextRun: stats.nextRun,
        symbolsConfigured: stats.symbols.length,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * 🔧 Utilidad para formatear tiempo
   */
  private formatTimeUntil(targetTime: Date): string {
    const now = new Date();
    const diff = targetTime.getTime() - now.getTime();
    
    if (diff <= 0) {
      return 'Ejecutándose ahora';
    }
    
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }
} 