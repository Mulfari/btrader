#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

// Importar funciones de analytics
import {
  getVolumeProfile,
  getVolumeProfileHistory,
  getMarketSentiment,
  getFearGreedIndex,
  getMarketSentimentHistory,
  getLatestPrice,
  getPriceHistory,
  getRecentLiquidations,
  getLiquidationClusters,
  getLiquidationVolume24h,
  getCurrentFundingRate,
  getFundingRateHistory,
  getCurrentLongShortRatio,
  getLongShortRatioHistory,
  getCurrentOpenInterest,
  getCurrentOrderbook,
  getMarketSummary,
  findTradingOpportunities,
  getAvailableSymbols,
  getDataStatus
} from './analytics.js';

// Importar funciones de base de datos
import { testConnection, closePool } from './database.js';

// Crear servidor MCP
const server = new Server(
  {
    name: 'btrader-analytics',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Schemas de validación para parámetros
const SymbolSchema = z.object({
  symbol: z.string().min(1, 'Symbol is required')
});

const SymbolOptionalTimeframeSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.string().optional(),
  limit: z.number().optional()
});

const SymbolHoursSchema = z.object({
  symbol: z.string().min(1),
  hours: z.number().optional().default(24)
});

const SymbolMinutesSchema = z.object({
  symbol: z.string().min(1),
  minutes: z.number().optional().default(60)
});

const PriceHistorySchema = z.object({
  symbol: z.string().min(1),
  hours: z.number().optional().default(24),
  interval: z.string().optional().default('1m')
});

// 🛠️ Definir herramientas disponibles
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // 📊 Volume Profile Tools
      {
        name: 'get_volume_profile',
        description: 'Obtener Volume Profile más reciente para un símbolo específico',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading (ej: BTCUSDT)' },
            timeframe: { type: 'string', description: 'Timeframe opcional (5m, 15m, 1h, 4h)', default: '1h' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_volume_profile_history',
        description: 'Obtener historial de Volume Profile para análisis de tendencias',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            timeframe: { type: 'string', description: 'Timeframe' },
            hours: { type: 'number', description: 'Horas hacia atrás', default: 24 }
          },
          required: ['symbol']
        }
      },

      // 😰 Market Sentiment Tools
      {
        name: 'get_market_sentiment',
        description: 'Obtener análisis de sentimiento de mercado (Fear & Greed Index compuesto)',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_fear_greed_index',
        description: 'Obtener solo el valor numérico del Fear & Greed Index (0-100)',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_sentiment_history',
        description: 'Obtener historial de sentimiento para detectar cambios',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            hours: { type: 'number', description: 'Horas hacia atrás', default: 24 }
          },
          required: ['symbol']
        }
      },

      // 💰 Price & Trading Data Tools
      {
        name: 'get_latest_price',
        description: 'Obtener precio actual y métricas de trading',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_price_history',
        description: 'Obtener historial de precios OHLC',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            hours: { type: 'number', description: 'Horas hacia atrás', default: 24 },
            interval: { type: 'string', description: 'Intervalo (1m, 5m, 15m, 1h)', default: '1m' }
          },
          required: ['symbol']
        }
      },

      // 💸 Liquidation Tools
      {
        name: 'get_recent_liquidations',
        description: 'Obtener liquidaciones recientes para detectar presión de mercado',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            minutes: { type: 'number', description: 'Minutos hacia atrás', default: 60 }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_liquidation_clusters',
        description: 'Obtener clusters de liquidaciones masivas',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            hours: { type: 'number', description: 'Horas hacia atrás', default: 1 }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_liquidation_volume_24h',
        description: 'Obtener volumen total de liquidaciones en 24h',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },

      // 📈 Funding Rate Tools
      {
        name: 'get_current_funding_rate',
        description: 'Obtener funding rate actual y análisis de bias',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_funding_rate_history',
        description: 'Obtener historial de funding rates',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            hours: { type: 'number', description: 'Horas hacia atrás', default: 24 }
          },
          required: ['symbol']
        }
      },

      // ⚖️ Long/Short Ratio Tools
      {
        name: 'get_current_long_short_ratio',
        description: 'Obtener ratio Long/Short actual y análisis de sentimiento',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_long_short_history',
        description: 'Obtener historial de ratios Long/Short',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' },
            hours: { type: 'number', description: 'Horas hacia atrás', default: 24 }
          },
          required: ['symbol']
        }
      },

      // 📊 Open Interest & Orderbook Tools
      {
        name: 'get_current_open_interest',
        description: 'Obtener Open Interest actual y análisis de tendencia',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'get_current_orderbook',
        description: 'Obtener snapshot del orderbook y análisis de liquidez',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },

      // 🎯 Analysis & Opportunities Tools
      {
        name: 'get_market_summary',
        description: 'Obtener resumen completo de mercado con todas las métricas combinadas',
        inputSchema: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Símbolo de trading' }
          },
          required: ['symbol']
        }
      },
      {
        name: 'find_trading_opportunities',
        description: 'Buscar oportunidades de trading basadas en múltiples indicadores',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },

      // 🔧 Utility Tools
      {
        name: 'get_available_symbols',
        description: 'Obtener lista de símbolos disponibles en la base de datos',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_data_status',
        description: 'Obtener estado de la base de datos y disponibilidad de datos recientes',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ]
  };
});

// 🔧 Manejador de llamadas a herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // 📊 Volume Profile Tools
      case 'get_volume_profile': {
        const { symbol, timeframe } = SymbolOptionalTimeframeSchema.parse(args);
        const result = await getVolumeProfile(symbol, timeframe);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_volume_profile_history': {
        const { symbol, timeframe, hours } = SymbolHoursSchema.extend({
          timeframe: z.string().optional()
        }).parse(args);
        const result = await getVolumeProfileHistory(symbol, timeframe, hours);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // 😰 Market Sentiment Tools
      case 'get_market_sentiment': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getMarketSentiment(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_fear_greed_index': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getFearGreedIndex(symbol);
        return {
          content: [
            {
              type: 'text',
              text: result !== null ? result.toString() : 'null'
            }
          ]
        };
      }

      case 'get_sentiment_history': {
        const { symbol, hours } = SymbolHoursSchema.parse(args);
        const result = await getMarketSentimentHistory(symbol, hours);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // 💰 Price & Trading Data Tools
      case 'get_latest_price': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getLatestPrice(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_price_history': {
        const { symbol, hours, interval } = PriceHistorySchema.parse(args);
        const result = await getPriceHistory(symbol, hours, interval);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // 💸 Liquidation Tools
      case 'get_recent_liquidations': {
        const { symbol, minutes } = SymbolMinutesSchema.parse(args);
        const result = await getRecentLiquidations(symbol, minutes);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_liquidation_clusters': {
        const { symbol, hours } = SymbolHoursSchema.parse(args);
        const result = await getLiquidationClusters(symbol, hours);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_liquidation_volume_24h': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getLiquidationVolume24h(symbol);
        return {
          content: [
            {
              type: 'text',
              text: result.toString()
            }
          ]
        };
      }

      // 📈 Funding Rate Tools
      case 'get_current_funding_rate': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getCurrentFundingRate(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_funding_rate_history': {
        const { symbol, hours } = SymbolHoursSchema.parse(args);
        const result = await getFundingRateHistory(symbol, hours);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // ⚖️ Long/Short Ratio Tools
      case 'get_current_long_short_ratio': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getCurrentLongShortRatio(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_long_short_history': {
        const { symbol, hours } = SymbolHoursSchema.parse(args);
        const result = await getLongShortRatioHistory(symbol, hours);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // 📊 Open Interest & Orderbook Tools
      case 'get_current_open_interest': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getCurrentOpenInterest(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_current_orderbook': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getCurrentOrderbook(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // 🎯 Analysis & Opportunities Tools
      case 'get_market_summary': {
        const { symbol } = SymbolSchema.parse(args);
        const result = await getMarketSummary(symbol);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'find_trading_opportunities': {
        const result = await findTradingOpportunities();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      // 🔧 Utility Tools
      case 'get_available_symbols': {
        const result = await getAvailableSymbols();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      case 'get_data_status': {
        const result = await getDataStatus();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Herramienta desconocida: ${name}`
        );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Parámetros inválidos: ${error.errors.map(e => e.message).join(', ')}`
      );
    }
    
    console.error(`Error en herramienta ${name}:`, error);
    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : 'Error interno desconocido'
    );
  }
});

// 🚀 Función principal para iniciar el servidor
async function main() {
  console.log('🚀 Iniciando BTrader Analytics MCP Server...');
  
  // Probar conexión a la base de datos
  const connectionOk = await testConnection();
  if (!connectionOk) {
    console.error('❌ No se pudo conectar a la base de datos. Saliendo...');
    process.exit(1);
  }
  
  // Configurar el transporte
  const transport = new StdioServerTransport();
  
  // Manejar shutdown graceful
  process.on('SIGINT', async () => {
    console.log('\n🔒 Cerrando servidor...');
    await closePool();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('🔒 Cerrando servidor...');
    await closePool();
    process.exit(0);
  });
  
  // Conectar y ejecutar servidor
  await server.connect(transport);
  console.log('✅ BTrader Analytics MCP Server listo y corriendo!');
  console.log('📊 Herramientas disponibles:');
  console.log('  • Volume Profile & Analysis');
  console.log('  • Market Sentiment & Fear/Greed Index');
  console.log('  • Price Data & History');
  console.log('  • Liquidations & Clusters');
  console.log('  • Funding Rates & Market Bias');
  console.log('  • Long/Short Ratios');
  console.log('  • Open Interest & Orderbook');
  console.log('  • Trading Opportunities');
  console.log('  • Utility Functions');
}

// Ejecutar servidor si es el módulo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });
} 