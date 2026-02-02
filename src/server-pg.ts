// src/server-pg.ts - VERSÃO SEM AUTO-INICIALIZAÇÃO
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Importe TODAS as rotas
import auth from './routes/auth';
import matters from './routes/matters';
import semad from './routes/semad';
import matterTypes from './routes/matter-types';
import editions from './routes/editions';
import users from './routes/users';
import verification from './routes/verification';
import exportRoutes from './routes/export';
import secretarias from './routes/secretarias';
import settings from './routes/settings';
import holidays from './routes/holidays';
import portal from './routes/portal';

import { testConnection } from './config/database';
import type { HonoContext } from './types';

const app = new Hono<HonoContext>();

// Middlewares
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

console.log('🚀 Iniciando servidor DOM...');
console.log('⚠️  NOTA: Banco NÃO será inicializado automaticamente');
console.log('📋 Para inicializar banco: npm run db:init');

// Registrar TODAS as rotas
app.route('/api/auth', auth);
app.route('/api/matters', matters);
app.route('/api/semad', semad);
app.route('/api/matter-types', matterTypes);
app.route('/api/editions', editions);
app.route('/api/users', users);
app.route('/api/verification', verification);
app.route('/api/export', exportRoutes);
app.route('/api/secretarias', secretarias);
app.route('/api/settings', settings);
app.route('/api/holidays', holidays);
app.route('/api/portal', portal);

console.log('✅ Todas as rotas registradas');

// Health check
app.get('/health', async (c) => {
  try {
    const dbConnected = await testConnection();
    
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: dbConnected ? 'connected' : 'disconnected',
      note: 'Banco não é inicializado automaticamente. Use npm run db:init'
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      error: error.message
    }, 500);
  }
});

// API Health (com prefixo /api)
app.get('/api/health', async (c) => {
  const dbConnected = await testConnection();
  return c.json({
    status: 'ok',
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Rota de teste
app.get('/test', (c) => {
  return c.json({
    message: 'API DOM funcionando!',
    timestamp: new Date().toISOString()
  });
});

// Debug
app.get('/api/debug/routes', (c) => {
  return c.json({
    routes: [
      'GET /health',
      'GET /api/health',
      'GET /test',
      'POST /api/auth/login',
      'GET /api/matters',
      'GET /api/matter-types',
      'GET /api/secretarias'
    ]
  });
});

// Rota principal
app.get('/', (c) => {
  return c.json({
    message: 'DOM API - Sistema de Diário Oficial Municipal',
    version: '2.0.0',
    note: 'Banco NÃO é inicializado automaticamente',
    commands: {
      start: 'npm run server',
      init_db: 'npm run db:init',
      reset_db: 'npm run db:reset'
    }
  });
});

// 404 handler
app.notFound((c) => {
  console.log(`❌ 404: ${c.req.method} ${c.req.path}`);
  return c.json({ 
    error: 'Rota não encontrada',
    path: c.req.path
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('❌ Erro:', err);
  return c.json({ error: 'Erro interno' }, 500);
});

const port = 3001;

async function startServer() {
  console.log('\n🔍 Verificando conexão com PostgreSQL...');
  
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ PostgreSQL não conectado.');
      console.error('\n📋 Solução:');
      console.error('   1. Certifique-se que PostgreSQL está rodando');
      console.error('   2. Configure as variáveis no .env');
      console.error('   3. Execute: npm run db:init');
      console.error('\n🔧 Para mais ajuda, execute: npm run db:init');
      process.exit(1);
    }
    
    console.log('✅ PostgreSQL conectado!\n');
    
    serve({
      fetch: app.fetch,
      port
    }, (info) => {
      console.log(`✅ Servidor rodando em http://localhost:${info.port}`);
      console.log('\n📋 Teste:');
      console.log(`   curl http://localhost:${info.port}/health`);
      console.log(`   curl http://localhost:${info.port}/api/debug/routes`);
      console.log(`   curl http://localhost:${info.port}/api/matters`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error);
    console.error('\n🔧 Execute: npm run db:init');
    process.exit(1);
  }
}

// Tratar encerramento
process.on('SIGINT', () => {
  console.log('\n👋 Encerrando servidor...');
  process.exit(0);
});

// Iniciar servidor
startServer().catch(console.error);