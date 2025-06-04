import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Configuración de la base de datos
const dbConfig: PoolConfig = {
  // Usar solo DATABASE_URL si existe
  connectionString: process.env.DATABASE_URL,
  
  // Fallback a variables individuales si no hay DATABASE_URL
  ...(process.env.DATABASE_URL ? {} : {
    user: process.env.PGUSER || process.env.DATABASE_USER || 'postgres',
    host: process.env.PGHOST || process.env.DATABASE_HOST || 'localhost',
    database: process.env.PGDATABASE || process.env.DATABASE_NAME || 'btrader',
    password: process.env.PGPASSWORD || process.env.DATABASE_PASSWORD || '',
    port: parseInt(process.env.PGPORT || process.env.DATABASE_PORT || '5432'),
  }),
  
  // Configuración del pool
  max: 10, // Máximo 10 conexiones
  idleTimeoutMillis: 30000, // 30 segundos
  connectionTimeoutMillis: 15000, // 15 segundos
  
  // SSL para Railway - SIEMPRE HABILITADO
  ssl: {
    rejectUnauthorized: false
  },
  
  // Configuración adicional para Railway
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Pool de conexiones
export const pool = new Pool(dbConfig);

// Event listeners para debugging
pool.on('connect', () => {
  console.log('🔗 Conectado a PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Error en pool de PostgreSQL:', err);
  process.exit(-1);
});

// Función para probar la conexión
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    
    console.log('✅ Conexión a BD exitosa:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('❌ Error conectando a BD:', error);
    return false;
  }
}

// Función para cerrar el pool
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('🔒 Pool de conexiones cerrado');
}

// Función helper para ejecutar queries
export async function query(text: string, params?: any[]): Promise<any> {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Query ejecutado:', { text: text.substring(0, 50) + '...', duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('❌ Error en query:', { text: text.substring(0, 50) + '...', error });
    throw error;
  }
}

// Función para obtener información de tablas
export async function getTableInfo(): Promise<any> {
  try {
    const result = await query(`
      SELECT 
        table_name,
        table_type,
        is_insertable_into
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    return result.rows;
  } catch (error) {
    console.error('❌ Error obteniendo info de tablas:', error);
    throw error;
  }
}

// Función para obtener conteos de registros
export async function getTableCounts(): Promise<Record<string, number>> {
  try {
    const tables = await getTableInfo();
    const counts: Record<string, number> = {};
    
    for (const table of tables) {
      try {
        const result = await query(`SELECT COUNT(*) as count FROM ${table.table_name}`);
        counts[table.table_name] = parseInt(result.rows[0].count);
      } catch (error) {
        console.warn(`⚠️ No se pudo contar tabla ${table.table_name}:`, error);
        counts[table.table_name] = 0;
      }
    }
    
    return counts;
  } catch (error) {
    console.error('❌ Error obteniendo conteos:', error);
    throw error;
  }
} 