# Configuración del Backend de BTrader

## Variables de Entorno Requeridas

Crea un archivo `.env` en la raíz del proyecto backend con las siguientes variables:

```env
# Configuración del servidor
PORT=8000
NODE_ENV=development

# Configuración de Supabase (REQUERIDO)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key

# JWT Secret (debe coincidir con Supabase)
JWT_SECRET=tu-jwt-secret

# URLs del Frontend (para CORS)
FRONTEND_URL=http://localhost:3000
```

## Obtener las credenciales de Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ve a Settings > API
3. Copia:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (secret) → `SUPABASE_SERVICE_ROLE_KEY`

**IMPORTANTE**: La `service_role key` tiene acceso completo a tu base de datos. Nunca la expongas en el frontend.

## Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run start:dev

# Ejecutar en producción
npm run build
npm run start:prod
```

## Verificar la configuración

1. Asegúrate de que el backend esté corriendo en el puerto configurado (por defecto 8000)
2. Verifica los logs para confirmar que Supabase se inicializó correctamente:
   - Deberías ver: `Supabase client initialized successfully`
   - Si ves: `Supabase configuration missing`, revisa tu archivo `.env`

## Funciones de Base de Datos Requeridas

El backend espera que existan las siguientes funciones RPC en Supabase:

- `get_user_subaccounts(p_user_id)` - Obtiene las subcuentas de un usuario
- `insert_subaccount(...)` - Crea una nueva subcuenta
- `delete_subaccount(...)` - Elimina una subcuenta
- `get_subaccount_balance(...)` - Obtiene el balance de una subcuenta

Si estas funciones no existen, el backend devolverá errores 500. Asegúrate de ejecutar las migraciones necesarias en Supabase.

## Solución de Problemas

### Error 500: Internal Server Error

1. Verifica que las variables de entorno estén configuradas correctamente
2. Asegúrate de que las funciones RPC existan en Supabase
3. Revisa los logs del backend para más detalles

### Error: Database function not found

Esto indica que las funciones RPC no existen en tu base de datos. Ejecuta las migraciones SQL necesarias en Supabase.

### Error: Invalid signature

Las API keys de Bybit pueden estar mal configuradas. Verifica que:
- Para cuentas demo: uses las keys de testnet.bybit.com
- Para cuentas reales: uses las keys de api.bybit.com 