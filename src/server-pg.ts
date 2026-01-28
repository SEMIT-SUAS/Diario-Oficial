// src/server-pg.ts - CORREÇÃO FINAL
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import authRoutes from './routes/auth';
import { testConnection } from './config/database';

// ✅ Use o tipo correto do seu types/index.ts
import type { HonoContext } from './types';

const app = new Hono<HonoContext>();

// Carregar variáveis de ambiente
import 'dotenv/config';

// Middlewares
app.use('*', logger());
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
}));

// ✅ DEBUG: Adicione este middleware para ver todas as rotas auth
app.use('/api/auth/*', async (c, next) => {
  console.log(`📥 Rota auth acessada: ${c.req.path} (Método: ${c.req.method})`);
  await next();
});

// ✅ Rota de teste para verificar parse JSON
app.post('/api/test-json', async (c) => {
  try {
    console.log('🧪 Testando parse de JSON...');
    
    const contentType = c.req.header('Content-Type');
    console.log('📋 Content-Type recebido:', contentType);
    
    // Tente parsear como JSON
    let jsonBody;
    try {
      jsonBody = await c.req.json();
      console.log('✅ JSON parseado com sucesso:', jsonBody);
    } catch (jsonError: any) {
      console.error('❌ Erro ao parsear JSON:', jsonError.message);
      
      // Tente ler como texto
      const rawText = await c.req.text();
      console.log('📝 Corpo RAW:', rawText);
      
      return c.json({ 
        success: false, 
        error: 'JSON inválido',
        details: jsonError.message,
        rawBody: rawText
      }, 400);
    }
    
    return c.json({ 
      success: true, 
      message: 'JSON recebido corretamente',
      received: jsonBody
    });
  } catch (error: any) {
    console.error('❌ Erro geral:', error);
    return c.json({ 
      success: false, 
      error: error.message 
    }, 500);
  }
});

// Health check
app.get('/health', async (c) => {
  try {
    const dbConnected = await testConnection();
    
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'DOM API',
      version: '1.0.0',
      database: dbConnected ? 'connected' : 'disconnected',
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error: any) {
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: 'error'
    }, 500);
  }
});

// Teste de conexão com banco
app.get('/test-db', async (c) => {
  try {
    const result = await testConnection();
    return c.json({
      success: result,
      message: result ? 'Conexão com PostgreSQL OK' : 'Falha na conexão',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// Rota de teste
app.get('/test', (c) => {
  return c.json({
    message: 'API DOM com PostgreSQL funcionando!',
    timestamp: new Date().toISOString()
  });
});

// ✅ Rota de debug direto no app principal (não no auth router)
app.get('/api/auth/debug', (c) => {
  console.log('✅ Rota /api/auth/debug acessada no app principal');
  return c.json({
    message: 'App principal está funcionando!',
    timestamp: new Date().toISOString(),
    note: 'Esta rota está no app principal, não no auth router'
  });
});

// ✅ Mount auth routes - IMPORTANTE: Isso deve vir DEPOIS das rotas específicas do app principal
app.route('/api/auth', authRoutes);

// Rota padrão
app.get('/', (c) => {
  return c.json({
    message: '🚀 DOM API - Sistema de Diário Oficial Municipal',
    version: '1.0.0',
    database: 'PostgreSQL',
    environment: process.env.NODE_ENV || 'development',
    endpoints: {
      auth: {
        debug: 'GET /api/auth/debug (principal)',
        'auth-debug': 'GET /api/auth/auth-debug (router)',
        login: 'POST /api/auth/login',
        register: 'POST /api/auth/register',
        me: 'GET /api/auth/me',
        'change-password': 'POST /api/auth/change-password'
      },
      system: {
        health: 'GET /health',
        test: 'GET /test',
        'db-test': 'GET /test-db',
        'json-test': 'POST /api/test-json'
      }
    }
  });
});

// 404 handler - DEVE SER A ÚLTIMA ROTA
app.notFound((c) => {
  console.log(`❌ 404: Rota não encontrada: ${c.req.path} (Método: ${c.req.method})`);
  return c.json({ 
    error: 'Endpoint não encontrado',
    path: c.req.path,
    method: c.req.method,
    availableEndpoints: [
      'GET  /',
      'GET  /health',
      'GET  /test-db',
      'GET  /test',
      'POST /api/test-json',
      'GET  /api/auth/debug (principal)',
      'GET  /api/auth/auth-debug (router)',
      'POST /api/auth/login'
    ]
  }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('❌ Erro não tratado:', err);
  console.error('❌ Stack:', err.stack);
  return c.json({ 
    error: 'Erro interno do servidor',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  }, 500);
});

// Iniciar servidor
const port = process.env.API_PORT ? parseInt(process.env.API_PORT) : 3001;

async function startServer() {
  console.log('============================================================');
  console.log('  🚀 DOM - Sistema de Diário Oficial Municipal');
  console.log('============================================================');
  console.log('📦 Configuração: PostgreSQL');
  console.log(`🌐 API Server: http://localhost:${port}`);
  console.log(`📊 Frontend: http://localhost:3000`);
  console.log('📝 Banco de Dados: PostgreSQL');
  console.log('============================================================\n');
  
  // Testar conexão com banco de dados
  console.log('🔍 Testando conexão com PostgreSQL...');
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('❌ Falha na conexão com PostgreSQL. Verifique:');
    console.error('   1. PostgreSQL está rodando?');
    console.error('   2. Credenciais no .env estão corretas?');
    console.error('   3. Banco dom_database existe?');
    process.exit(1);
  }
  
  console.log('✅ Conexão com PostgreSQL estabelecida!\n');
  
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`✅ Servidor rodando em http://localhost:${info.port}`);
    console.log('\n📋 Endpoints disponíveis:');
    console.log(`   🧪 Debug (principal): GET http://localhost:${port}/api/auth/debug`);
    console.log(`   🧪 Debug (auth router): GET http://localhost:${port}/api/auth/auth-debug`);
    console.log(`   🔐 Login: POST http://localhost:${port}/api/auth/login`);
    console.log(`   📋 Health: GET http://localhost:${port}/health`);
    console.log(`   🛠️  Test DB: GET http://localhost:${port}/test-db`);
    console.log(`   🧪 Test JSON: POST http://localhost:${port}/api/test-json`);
    console.log('\n👤 Credenciais padrão:');
    console.log('   📧 Email: admin@municipio.gov.br');
    console.log('   🔑 Senha: admin123');
    console.log('\n🔧 Para testar rapidamente:');
    console.log(`   curl -X POST http://localhost:${port}/api/test-json -H "Content-Type: application/json" -d '{"test":"data"}'`);
    console.log(`   curl -X GET http://localhost:${port}/api/auth/debug`);
    console.log(`   curl -X GET http://localhost:${port}/api/auth/auth-debug`);
  });
}

// Tratar encerramento
process.on('SIGINT', async () => {
  console.log('\n\n👋 Encerrando servidor...');
  const { closePool } = await import('./config/database');
  await closePool();
  process.exit(0);
});

// Iniciar servidor
startServer().catch(console.error);