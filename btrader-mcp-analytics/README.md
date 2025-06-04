# 🚀 BTrader Analytics MCP Server

## 📖 Descripción

Servidor MCP (Model Context Protocol) que proporciona acceso a todos los datos de trading y análisis avanzados de BTrader, incluyendo:

- 📊 **Volume Profile** - Análisis de distribución de volumen por niveles de precio
- 😰 **Fear & Greed Index** - Sentimiento de mercado compuesto 
- 💸 **Liquidaciones** - Datos en tiempo real y clustering
- 📈 **Funding Rates** - Análisis de bias del mercado
- ⚖️ **Long/Short Ratios** - Sentimiento retail vs institucional
- 💰 **Datos de precios** - OHLC y métricas de trading
- 📊 **Open Interest** - Análisis de tendencias
- 🎯 **Oportunidades de Trading** - Detección automática de setups

## 🛠️ Configuración

### Variables de Entorno

Crea un archivo `.env` con las mismas credenciales de tu backend:

```bash
# Configuración de PostgreSQL
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=tu_password
PGDATABASE=btrader

# O usando variables alternativas
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=tu_password
DATABASE_NAME=btrader

# O URL completa
DATABASE_URL=postgresql://postgres:password@localhost:5432/btrader
```

### Instalación

```bash
npm install
```

### Compilación

```bash
npm run build
```

### Desarrollo

```bash
npm run dev
```

### Producción

```bash
npm start
```

## 🧰 Herramientas Disponibles

### 📊 Volume Profile

- `get_volume_profile(symbol, timeframe?)` - Volume Profile más reciente
- `get_volume_profile_history(symbol, timeframe?, hours?)` - Historial de VP

### 😰 Market Sentiment

- `get_market_sentiment(symbol)` - Análisis completo de sentimiento
- `get_fear_greed_index(symbol)` - Solo el índice numérico (0-100)
- `get_sentiment_history(symbol, hours?)` - Historial de sentimiento

### 💰 Datos de Precio

- `get_latest_price(symbol)` - Precio actual y métricas
- `get_price_history(symbol, hours?, interval?)` - Historial OHLC

### 💸 Liquidaciones

- `get_recent_liquidations(symbol, minutes?)` - Liquidaciones recientes
- `get_liquidation_clusters(symbol, hours?)` - Clusters de liquidaciones
- `get_liquidation_volume_24h(symbol)` - Volumen 24h

### 📈 Funding Rates

- `get_current_funding_rate(symbol)` - Funding rate y análisis de bias
- `get_funding_rate_history(symbol, hours?)` - Historial

### ⚖️ Long/Short Ratios

- `get_current_long_short_ratio(symbol)` - Ratio actual y sentimiento
- `get_long_short_history(symbol, hours?)` - Historial

### 📊 Open Interest & Orderbook

- `get_current_open_interest(symbol)` - Open Interest y tendencias
- `get_current_orderbook(symbol)` - Snapshot de liquidez

### 🎯 Análisis Avanzado

- `get_market_summary(symbol)` - Resumen completo de todas las métricas
- `find_trading_opportunities()` - Búsqueda automática de setups

### 🔧 Utilidades

- `get_available_symbols()` - Símbolos disponibles
- `get_data_status()` - Estado de la base de datos

## 🎯 Ejemplos de Uso

### Análisis de Mercado Completo

```javascript
// Obtener resumen completo de BTC
const summary = await get_market_summary("BTCUSDT");

// Resultado incluye:
// - Precio actual y cambios
// - Volume Profile (PoC, Value Area, gaps)
// - Fear & Greed Index
// - Funding rate y bias
// - Long/Short ratio
// - Liquidaciones 24h
// - Señal de trading consolidada
```

### Detección de Oportunidades

```javascript
// Buscar oportunidades automáticamente
const opportunities = await find_trading_opportunities();

// Filtra por:
// - Fear & Greed extremos
// - Proximidad a niveles de Volume Profile
// - Confluencias de múltiples indicadores
// - Risk/Reward favorable
```

### Análisis de Liquidaciones

```javascript
// Liquidaciones recientes para detectar presión
const liquidations = await get_recent_liquidations("BTCUSDT", 30);

// Clusters de liquidaciones masivas
const clusters = await get_liquidation_clusters("BTCUSDT", 2);
```

## 🔗 Integración con Claude

Una vez configurado, puedes usar el MCP directamente con Claude:

```
¿Cómo está el sentimiento de BTC ahora?
¿Hay oportunidades de trading disponibles?
Muéstrame el Volume Profile de ETH
¿Cuáles son los niveles clave de SOL?
```

## 🚨 Notas Importantes

1. **Dependencias**: Requiere que el backend de BTrader esté ejecutándose y recolectando datos
2. **Base de Datos**: Debe tener acceso a la misma BD PostgreSQL del backend
3. **Datos**: Solo funciona si hay datos históricos en las tablas
4. **Performance**: Las consultas están optimizadas pero pueden tardar con datasets grandes

## 🔧 Troubleshooting

### Error de Conexión a BD
```
❌ No se pudo conectar a la base de datos
```
- Verifica las variables de entorno
- Confirma que PostgreSQL esté ejecutándose
- Verifica permisos de usuario

### Sin Datos
```
null responses en todas las consultas
```
- Verifica que el backend esté recolectando datos
- Ejecuta análisis manual: `POST /analytics/scheduler/run`
- Revisa logs del backend principal

### Errores de Tipos
```
TypeScript errors
```
- Ejecuta `npm run build` para ver errores específicos
- Verifica que todas las dependencias estén instaladas

## 📈 Próximos Pasos

1. **Testing**: Probar todas las herramientas con datos reales
2. **Optimización**: Agregar cache para consultas frecuentes
3. **Alertas**: Integrar sistema de notificaciones
4. **ML**: Agregar predicciones con machine learning
5. **Trading**: Crear MCP de ejecución de órdenes

---

**🎯 Con este MCP, Claude tendrá acceso completo a tu sistema de análisis de trading institucional!** 