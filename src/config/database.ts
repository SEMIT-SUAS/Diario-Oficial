// ====================================
// DOM - PostgreSQL Database Configuration
// ====================================

import { Pool } from 'pg';

// Configurações do pool de conexões
const poolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'dom_database',
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Pool de conexões
let pool: Pool | null = null;

/**
 * Obter pool de conexões
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);
    
    pool.on('error', (err) => {
      console.error('❌ Erro inesperado no pool de conexões:', err);
      process.exit(-1);
    });
    
    console.log('✅ Pool de conexões PostgreSQL criado');
  }
  
  return pool;
}

/**
 * Executar query
 */
export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const pool = getPool();
  
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executada:', {
        text: text.substring(0, 100),
        duration: `${duration}ms`,
        rows: result.rowCount
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro na query:', {
      error: error.message,
      query: text.substring(0, 100)
    });
    throw error;
  }
}

/**
 * Obter uma conexão do pool
 */
export async function getClient() {
  const pool = getPool();
  return await pool.connect();
}

/**
 * Testar conexão
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    console.log('✅ Conexão com PostgreSQL OK:', {
      time: result.rows[0].now,
      version: result.rows[0].version.split(',')[0]
    });
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com PostgreSQL:', error.message);
    return false;
  }
}

/**
 * Fechar pool de conexões
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Pool de conexões fechado');
  }
}

// Export default
export default {
  getPool,
  query,
  getClient,
  testConnection,
  closePool
};
