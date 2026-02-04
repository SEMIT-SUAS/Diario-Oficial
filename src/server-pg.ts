// src/server-pg.ts - VERSÃO COMPLETA
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
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

console.log('🚀 Iniciando servidor DOM...');
console.log('⚠️  NOTA: Banco NÃO será inicializado automaticamente');
console.log('📋 Para inicializar banco: npm run db:init');

// Registrar TODAS as rotas
console.log('\n📋 Registrando rotas:');

// Lista de rotas para registrar
const routes = [
  { path: '/api/auth', router: auth, name: 'Autenticação' },
  { path: '/api/matters', router: matters, name: 'Matérias' },
  { path: '/api/semad', router: semad, name: 'SEMAD' },
  { path: '/api/matter-types', router: matterTypes, name: 'Tipos de Matéria' },
  { path: '/api/editions', router: editions, name: 'Edições' },
  { path: '/api/users', router: users, name: 'Usuários' },
  { path: '/api/verification', router: verification, name: 'Verificação' },
  { path: '/api/export', router: exportRoutes, name: 'Exportação' },
  { path: '/api/secretarias', router: secretarias, name: 'Secretarias' },
  { path: '/api/settings', router: settings, name: 'Configurações' },
  { path: '/api/holidays', router: holidays, name: 'Feriados' },
  { path: '/api/portal', router: portal, name: 'Portal' }
];

// Registrar cada rota
routes.forEach(({ path, router, name }) => {
  app.route(path, router);
  console.log(`   ✅ ${path} - ${name}`);
});

console.log('🎉 Todas as rotas registradas!');

// Health check com prefixo /api
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DOM API',
    database: 'PostgreSQL'
  });
});

// Health check sem prefixo (para compatibilidade)
app.get('/health', async (c) => {
  const dbConnected = await testConnection();
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbConnected ? 'connected' : 'disconnected'
  });
});

// Rota de teste
app.get('/api/test', (c) => {
  return c.json({
    message: 'API DOM funcionando!',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Rota de debug para ver todas as rotas
app.get('/api/debug/routes', (c) => {
  const availableRoutes = routes.map(r => ({
    path: r.path,
    name: r.name,
    endpoints: [
      `${r.path}/*` // Indica que há sub-rotas
    ]
  }));
  
  return c.json({
    message: 'Rotas disponíveis',
    routes: availableRoutes,
    timestamp: new Date().toISOString(),
    total: routes.length
  });
});

// Rota principal
app.get('/', (c) => {
  return c.json({
    message: '🚀 DOM API - Sistema de Diário Oficial Municipal',
    version: '2.0.0',
    database: 'PostgreSQL',
    endpoints: {
      auth: 'POST /api/auth/login',
      matters: 'GET /api/matters',
      matter_types: 'GET /api/matter-types',
      health: 'GET /api/health',
      debug: 'GET /api/debug/routes'
    },
    commands: {
      start: 'npm run server',
      init_db: 'npm run db:init',
      help: 'npm run help'
    }
  });
});

// 404 handler - DEVE SER A ÚLTIMA ROTA
app.notFound((c) => {
  const requestedPath = c.req.path;
  const availablePaths = routes.map(r => r.path);
  
  console.log(`❌ 404: Rota não encontrada: ${c.req.path} (Método: ${c.req.method})`);
  
  return c.json({ 
    error: 'Endpoint não encontrado',
    path: requestedPath,
    method: c.req.method,
    availableEndpoints: availablePaths,
    suggestion: `Verifique se a rota ${requestedPath} está registrada em server-pg.ts`
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('❌ Erro interno do servidor:', err);
  console.error('❌ Stack trace:', err.stack);
  
  return c.json({ 
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500);
});

// Iniciar servidor
const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

async function startServer() {
  console.log('\n🔍 Verificando conexão com PostgreSQL...');
  
  try {
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
      console.error('❌ PostgreSQL não conectado.');
      console.error('\n📋 Solução:');
      console.error('   1. Certifique-se que PostgreSQL está rodando');
      console.error('   2. Execute: npm run db:init');
      console.error('   3. Verifique as variáveis no .env');
      console.error('\n⚡ Comando rápido: npm run db:init');
      process.exit(1);
    }
    
    console.log('✅ PostgreSQL conectado!\n');
    
    serve({
      fetch: app.fetch,
      port,
    }, (info) => {
      console.log(`✅ Servidor rodando em http://localhost:${info.port}`);
      console.log('\n📋 Endpoints disponíveis:');
      console.log(`   🔐 Login:          POST http://localhost:${port}/api/auth/login`);
      console.log(`   📊 Health:         GET  http://localhost:${port}/api/health`);
      console.log(`   📋 Debug:          GET  http://localhost:${port}/api/debug/routes`);
      console.log(`   📄 Matérias:       GET  http://localhost:${port}/api/matters`);
      console.log(`   🏢 Secretarias:    GET  http://localhost:${port}/api/secretarias`);
      console.log(`   ⚙️  Configurações: GET  http://localhost:${port}/api/settings`);
      console.log(`   📅 Feriados:       GET  http://localhost:${port}/api/holidays`);
      console.log('\n👤 Credenciais de teste:');
      console.log('   📧 Email: admin@municipio.gov.br');
      console.log('   🔑 Senha: admin123');
      console.log('\n🔧 Para testar rapidamente:');
      console.log(`   curl http://localhost:${port}/api/health`);
      console.log(`   curl http://localhost:${port}/api/debug/routes`);
      console.log(`   curl -X POST http://localhost:${port}/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@municipio.gov.br","password":"admin123"}'`);
    });
    
  } catch (error: any) {
    console.error('❌ Erro ao iniciar servidor:', error.message);
    console.error('\n🔧 Execute: npm run db:init');
    process.exit(1);
  }
}

// Tratar encerramento
process.on('SIGINT', async () => {
  console.log('\n\n👋 Encerrando servidor...');
  process.exit(0);
});

// Iniciar servidor
startServer().catch(console.error);