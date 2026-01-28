// ====================================
// DOM - Authentication Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext, User } from '../types';
import { hashPassword, verifyPassword, generateToken } from '../utils/auth';
import { authMiddleware } from '../middleware/auth';
import db from '../lib/db'; // Importe a conexão PostgreSQL

const auth = new Hono<HonoContext>();

auth.get('/auth-debug', (c) => {
  console.log('✅ Rota /api/auth/auth-debug acessada dentro do auth router');
  return c.json({ 
    message: 'Auth router está funcionando corretamente!',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'POST /api/auth/register',
      'POST /api/auth/change-password',
      'POST /api/auth/forgot-password',
      'POST /api/auth/reset-password'
    ]
  });
});

/**
 * POST /api/auth/login
 * Login de usuário
 */
auth.post('/login', async (c) => {
  try {
    console.log('📨 Recebendo requisição de login...');
    
    // Verifique se o corpo da requisição é JSON
    const contentType = c.req.header('Content-Type');
    console.log('📋 Content-Type:', contentType);
    
    if (!contentType?.includes('application/json')) {
      console.log('⚠️  Content-Type não é JSON');
      return c.json({ error: 'Content-Type deve ser application/json' }, 400);
    }
    
    let body;
    try {
      body = await c.req.json();
      console.log('📦 Corpo recebido:', JSON.stringify(body));
    } catch (jsonError: any) {
      console.error('❌ Erro ao parsear JSON:', jsonError.message);
      
      // Tente ler o corpo como texto para debug
      try {
        const rawBody = await c.req.text();
        console.log('📝 Corpo RAW:', rawBody);
      } catch (textError) {
        console.error('❌ Não foi possível ler corpo como texto:', textError);
      }
      
      return c.json({ 
        error: 'Corpo da requisição inválido. Deve ser JSON válido.',
        details: jsonError.message 
      }, 400);
    }
    
    const { email, password } = body;
    
    if (!email || !password) {
      console.log('⚠️  Email ou senha faltando');
      return c.json({ 
        error: 'Email e senha são obrigatórios',
        received: { email: !!email, password: !!password }
      }, 400);
    }
    
    console.log('🔍 Buscando usuário:', email);
    
    // Buscar usuário por email - PostgreSQL
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1 AND active = 1',
      [email]
    );
    
    console.log(`📊 Resultado da query: ${result.rows.length} usuário(s) encontrado(s)`);
    
    const user = result.rows[0] as User;
    
    if (!user) {
      console.log('❌ Usuário não encontrado ou inativo');
      return c.json({ error: 'Credenciais inválidas' }, 401);
    }
    
    console.log('✅ Usuário encontrado:', { id: user.id, name: user.name, role: user.role });
    
    // Verificar senha
    const isValidPassword = await verifyPassword(password, user.password_hash);
    
    console.log('🔐 Verificação de senha:', isValidPassword ? '✅ Válida' : '❌ Inválida');
    
    if (!isValidPassword) {
      console.log('❌ Senha inválida');
      return c.json({ error: 'Credenciais inválidas' }, 401);
    }
    
    console.log('✅ Senha válida');
    
    // Atualizar último login - PostgreSQL
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );
    
    // Gerar token
    const token = await generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    
    console.log('🎟️  Token gerado:', token ? '✅' : '❌');
    
    // Buscar informações da secretaria se aplicável
    let secretaria = null;
    if (user.secretaria_id) {
      const secretariaResult = await db.query(
        'SELECT id, name, acronym FROM secretarias WHERE id = $1',
        [user.secretaria_id]
      );
      secretaria = secretariaResult.rows[0];
      console.log('🏢 Secretaria encontrada:', secretaria);
    }
    
    // Remover senha do retorno
    const { password_hash, ...userWithoutPassword } = user;
    
    console.log('✅ Login bem-sucedido para usuário:', user.id);
    
    return c.json({
      token,
      user: {
        ...userWithoutPassword,
        secretaria
      }
    });
    
  } catch (error: any) {
    console.error('❌ Login error:', error.message);
    console.error('❌ Stack:', error.stack);
    return c.json({ 
      error: 'Erro ao fazer login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    }, 500);
  }
});

/**
 * POST /api/auth/register
 * Registro de novo usuário (apenas admin pode criar usuários)
 */
auth.post('/register', async (c) => {
  try {
    const { name, email, password, cpf, role, secretaria_id } = await c.req.json();
    
    if (!name || !email || !password || !role) {
      return c.json({ error: 'Dados obrigatórios faltando' }, 400);
    }
    
    // Validar role
    const validRoles = ['admin', 'semad', 'secretaria', 'publico'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Role inválida' }, 400);
    }
    
    // Verificar se email já existe - PostgreSQL
    const existingResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingResult.rows.length > 0) {
      return c.json({ error: 'Email já cadastrado' }, 400);
    }
    
    // Hash da senha
    const passwordHash = await hashPassword(password);
    
    // Inserir usuário - PostgreSQL
    const result = await db.query(
      `INSERT INTO users 
       (name, email, password_hash, cpf, role, secretaria_id, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 1, NOW(), NOW())
       RETURNING id`,
      [name, email, passwordHash, cpf || null, role, secretaria_id || null]
    );
    
    return c.json({
      message: 'Usuário cadastrado com sucesso',
      userId: result.rows[0].id
    }, 201);
    
  } catch (error: any) {
    console.error('Register error:', error);
    return c.json({ error: 'Erro ao cadastrar usuário' }, 500);
  }
});

/**
 * POST /api/auth/change-password
 * Alterar senha do usuário autenticado
 */
auth.post('/change-password', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { currentPassword, newPassword } = await c.req.json();
    
    if (!currentPassword || !newPassword) {
      return c.json({ error: 'Senhas são obrigatórias' }, 400);
    }
    
    if (newPassword.length < 6) {
      return c.json({ error: 'Nova senha deve ter pelo menos 6 caracteres' }, 400);
    }
    
    // Verificar senha atual
    const isValidPassword = await verifyPassword(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return c.json({ error: 'Senha atual incorreta' }, 401);
    }
    
    // Hash da nova senha
    const newPasswordHash = await hashPassword(newPassword);
    
    // Atualizar senha - PostgreSQL
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, user.id]
    );
    
    return c.json({ message: 'Senha alterada com sucesso' });
    
  } catch (error: any) {
    console.error('Change password error:', error);
    return c.json({ error: 'Erro ao alterar senha' }, 500);
  }
});

/**
 * GET /api/auth/me
 * Retorna dados do usuário autenticado
 */
auth.get('/me', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    // Buscar informações da secretaria se aplicável
    let secretaria = null;
    if (user.secretaria_id) {
      const secretariaResult = await db.query(
        'SELECT id, name, acronym FROM secretarias WHERE id = $1',
        [user.secretaria_id]
      );
      secretaria = secretariaResult.rows[0];
    }
    
    // Remover senha do retorno
    const { password_hash, ...userWithoutPassword } = user;
    
    return c.json({
      ...userWithoutPassword,
      secretaria
    });
    
  } catch (error: any) {
    console.error('Get user error:', error);
    return c.json({ error: 'Erro ao buscar dados do usuário' }, 500);
  }
});

/**
 * POST /api/auth/forgot-password
 * Solicita redefinição de senha (simulado - sem email real)
 */
auth.post('/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();
    
    if (!email) {
      return c.json({ error: 'Email é obrigatório' }, 400);
    }
    
    // Buscar usuário - PostgreSQL
    const result = await db.query(
      'SELECT id, email, name FROM users WHERE email = $1 AND active = 1',
      [email]
    );
    
    const user = result.rows[0];
    
    // Por segurança, sempre retornar sucesso mesmo se email não existir
    if (user) {
      // Registrar log - PostgreSQL
      const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';
      const userAgent = c.req.header('user-agent') || 'unknown';
      
      await db.query(
        `INSERT INTO audit_logs 
         (user_id, action, entity_type, entity_id, new_values, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          user.id,
          'forgot_password_request',
          'user',
          user.id,
          JSON.stringify({ email: user.email }),
          ipAddress,
          userAgent
        ]
      );
    }
    
    return c.json({ 
      message: 'Se o email existir em nossa base, você receberá instruções para redefinir sua senha.',
      info: 'Em produção, um email será enviado. Entre em contato com o administrador do sistema.'
    });
    
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return c.json({ error: 'Erro ao processar solicitação' }, 500);
  }
});

/**
 * POST /api/auth/reset-password
 * Redefine senha com token (placeholder para implementação futura)
 */
auth.post('/reset-password', async (c) => {
  try {
    const { token, newPassword } = await c.req.json();
    
    if (!token || !newPassword) {
      return c.json({ error: 'Token e nova senha são obrigatórios' }, 400);
    }
    
    if (newPassword.length < 6) {
      return c.json({ error: 'Nova senha deve ter pelo menos 6 caracteres' }, 400);
    }
    
    return c.json({ 
      error: 'Funcionalidade em desenvolvimento. Entre em contato com o administrador do sistema.' 
    }, 501);
    
  } catch (error: any) {
    console.error('Reset password error:', error);
    return c.json({ error: 'Erro ao redefinir senha' }, 500);
  }
});

export default auth;