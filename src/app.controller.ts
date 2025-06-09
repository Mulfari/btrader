import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { BybitWebSocketService } from './trades/bybit-websocket.service';
import { AnalyticsSchedulerService } from './trades/analytics-scheduler.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly bybitService: BybitWebSocketService,
    private readonly schedulerService: AnalyticsSchedulerService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * 🎛️ CONTROL CONSOLIDADO DE RECOLECCIÓN DE DATOS
   */

  /**
   * ⏸️ Pausar TODA la recolección automática de datos
   * POST /pause-all-data-collection
   */
  @Post('pause-all-data-collection')
  async pauseAllDataCollection() {
    // Pausar WebSocket (datos en tiempo real)
    this.bybitService.pause();
    
    // Pausar Scheduler (análisis automáticos)
    this.schedulerService.pause();

    return {
      success: true,
      message: '⏸️ TODA la recolección automática de datos ha sido PAUSADA',
      details: {
        webSocketService: 'pausado - Sin recolección de datos en tiempo real',
        analyticsScheduler: 'pausado - Sin análisis automáticos cada 5 minutos'
      },
      timestamp: new Date().toISOString(),
      note: 'Los datos solo se obtendrán cuando se activen manualmente desde el widget'
    };
  }

  /**
   * ▶️ Reanudar TODA la recolección automática de datos
   * POST /resume-all-data-collection
   */
  @Post('resume-all-data-collection')
  async resumeAllDataCollection() {
    // Reanudar WebSocket (datos en tiempo real)
    this.bybitService.resume();
    
    // Reanudar Scheduler (análisis automáticos)
    this.schedulerService.resume();

    return {
      success: true,
      message: '▶️ TODA la recolección automática de datos ha sido REANUDADA',
      details: {
        webSocketService: 'activo - Recolectando datos en tiempo real',
        analyticsScheduler: 'activo - Ejecutando análisis automáticos cada 5 minutos'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 🔍 Estado consolidado de todos los sistemas
   * GET /data-collection-status
   */
  @Get('data-collection-status')
  async getDataCollectionStatus() {
    const webSocketStatus = this.bybitService.getStatus();
    const schedulerStatus = this.schedulerService.getSchedulerStatus();

    const allPaused = webSocketStatus.isPaused && schedulerStatus.isPaused;
    const allActive = !webSocketStatus.isPaused && !schedulerStatus.isPaused;

    return {
      overall: {
        status: allPaused ? 'TOTALMENTE_PAUSADO' : allActive ? 'TOTALMENTE_ACTIVO' : 'PARCIALMENTE_ACTIVO',
        message: allPaused 
          ? 'No hay recolección automática de datos' 
          : allActive 
            ? 'Recolección automática completa activa'
            : 'Solo algunos sistemas están activos',
        allSystemsPaused: allPaused,
        automaticDataCollection: !allPaused
      },
      services: {
        webSocketService: {
          status: webSocketStatus.isPaused ? 'pausado' : 'activo',
          description: 'Recolección de datos en tiempo real (trades, orderbook, liquidaciones)',
          isPaused: webSocketStatus.isPaused,
          isConnected: webSocketStatus.isConnected,
          symbols: webSocketStatus.symbols
        },
        analyticsScheduler: {
          status: schedulerStatus.isPaused ? 'pausado' : 'activo',
          description: 'Análisis automáticos cada 5 minutos (Fear & Greed, Volume Profile)',
          isPaused: schedulerStatus.isPaused,
          nextRun: schedulerStatus.nextRun,
          symbols: schedulerStatus.symbols
        }
      },
      controlEndpoints: {
        pauseAll: 'POST /pause-all-data-collection',
        resumeAll: 'POST /resume-all-data-collection',
        status: 'GET /data-collection-status',
        individualControls: {
          webSocket: {
            pause: 'POST /trades/control/pause',
            resume: 'POST /trades/control/resume',
            status: 'GET /trades/control/status'
          },
          scheduler: {
            pause: 'POST /analytics/scheduler/pause',
            resume: 'POST /analytics/scheduler/resume',
            status: 'GET /analytics/scheduler/status'
          }
        }
      },
      timestamp: new Date().toISOString()
    };
  }
}
