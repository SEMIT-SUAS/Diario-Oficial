// backend.ts - SEM inicialização do banco
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Importe TODAS as rotas (igual ao index.ts)
import auth from './src/routes/auth';
import matters from './src/routes/matters';
import semad from './src/routes/semad';
import matterTypes from './src/routes/matter-types';
import editions from './src/routes/editions';
import users from './src/routes/users';
import verification from './src/routes/verification';
import exportRoutes from './src/routes/export';
import secretarias from './src/routes/secretarias';
import settings from './src/routes/settings';
import holidays from './src/routes/holidays';
import portal from './src/routes/portal';

import { testConnection } from './src/config/database';
import type { HonoContext } from './src/types';

const app = new Hono<HonoContext>();

// Middlewares
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
}));

console.log('🚀 Iniciando backend DOM (sem inicializar banco)...');

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

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Debug
app.get('/api/debug/routes', (c) => {
  return c.json({
    routes: [
      'GET /api/health',
      'POST /api/auth/login',
      'GET /api/matters',
      'GET /api/matter-types',
      'GET /api/secretarias',
      'GET /api/users'
    ]
  });
});

const port = 3001;

async function startServer() {
  console.log('\n🔍 Verificando PostgreSQL...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('❌ PostgreSQL não conectado. Execute primeiro:');
    console.error('   npm run db:init');
    process.exit(1);
  }
  
  console.log('✅ PostgreSQL conectado!\n');
  
  serve({
    fetch: app.fetch,
    port
  }, (info) => {
    console.log(`✅ Backend rodando em http://localhost:${info.port}`);
    console.log('\n🔧 Teste:');
    console.log(`   curl http://localhost:${info.port}/api/health`);
    console.log(`   curl http://localhost:${info.port}/api/debug/routes`);
    console.log(`   curl http://localhost:${info.port}/api/matters`);
  });
}

startServer().catch(console.error);