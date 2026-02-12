// ====================================
// DOM - Authentication Middleware (PostgreSQL)
// ====================================

import { Context, Next } from 'hono';
import { HonoContext, User, UserRole } from '../types';
import { verifyToken, signToken, TokenPayload, generatePreviewToken } from '../utils/auth';
import db from '../lib/db';

// Re-exportar funções de utils para facilitar importação
export { verifyToken, signToken, TokenPayload, generatePreviewToken };

/**
 * Middleware para verificar autenticação - AGORA COM SUPORTE A TOKEN VIA QUERY STRING
 */
export async function authMiddleware(c: Context<HonoContext>, next: Next) {
  try {
    console.log('🔐 Auth middleware executando...');
    
    // Tentar obter token de diferentes lugares:
    // 1. Header Authorization (Bearer token)
    // 2. Query parameter ?token=
    let token = null;
    
    // Verificar header Authorization
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('🔑 Token obtido do header Authorization');
    }
    
    // Se não encontrou no header, verificar query parameter
    if (!token) {
      token = c.req.query('token');
      if (token) {
        console.log('🔑 Token obtido da query string');
      }
    }
    
    if (!token) {
      console.log('⚠️ Token não fornecido ou formato inválido');
      c.set('user', undefined);
      await next();
      return;
    }
    
    // Verificar token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      console.log('❌ Token inválido ou expirado');
      c.set('user', undefined);
      await next();
      return;
    }
    
    console.log('✅ Token válido. Payload:', decoded);
    
    // Buscar usuário no banco - Sintaxe PostgreSQL
    const result = await db.query(
      `SELECT 
        id, 
        name, 
        email, 
        password_hash, 
        role, 
        secretaria_id, 
        active, 
        created_at, 
        updated_at, 
        last_login 
       FROM users 
       WHERE id = $1 AND active = 1`,
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      console.log('❌ Usuário não encontrado ou inativo');
      c.set('user', undefined);
      await next();
      return;
    }
    
    const user = result.rows[0] as User;
    console.log(`✅ Usuário autenticado: ${user.name} (${user.role}) ID: ${user.id}`);
    
    // Armazenar usuário no contexto
    c.set('user', user);
    
    await next();
  } catch (error: any) {
    console.error('❌ Erro no authMiddleware:', error.message);
    c.set('user', undefined);
    await next();
  }
}

/**
 * Middleware para verificar permissão por role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (c: Context<HonoContext>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ 
        error: 'Usuário não autenticado',
        code: 'UNAUTHENTICATED'
      }, 401);
    }
    
    if (!allowedRoles.includes(user.role)) {
      return c.json({ 
        error: 'Permissão negada',
        userRole: user.role,
        requiredRoles: allowedRoles,
        code: 'FORBIDDEN'
      }, 403);
    }
    
    await next();
  };
}

/**
 * Middleware para verificar se usuário pertence à secretaria
 */
export async function requireOwnSecretaria(c: Context<HonoContext>, next: Next) {
  const user = c.get('user');
  const secretariaId = c.req.param('secretariaId');
  
  if (!user) {
    return c.json({ error: 'Usuário não autenticado' }, 401);
  }
  
  // Admin e SEMAD podem acessar todas as secretarias
  if (user.role === 'admin' || user.role === 'semad') {
    await next();
    return;
  }
  
  // Usuários de secretaria só podem acessar sua própria secretaria
  if (user.role === 'secretaria') {
    const userSecretariaId = user.secretaria_id?.toString();
    
    if (userSecretariaId !== secretariaId) {
      return c.json({ 
        error: 'Acesso negado a esta secretaria',
        userSecretariaId,
        requestedSecretariaId: secretariaId
      }, 403);
    }
    
    await next();
    return;
  }
  
  // Outros roles não têm acesso
  return c.json({ error: 'Acesso negado' }, 403);
}

/**
 * Middleware para log de auditoria
 */
export function auditLog(action: string, entityType: string) {
  return async (c: Context<HonoContext>, next: Next) => {
    const user = c.get('user');
    const entityId = c.req.param('id') || null;
    
    await next();
    
    // Registrar log apenas se a operação foi bem-sucedida
    if (c.res.status >= 200 && c.res.status < 400) {
      const ipAddress = c.req.header('CF-Connecting-IP') || 
                       c.req.header('X-Real-IP') || 
                       c.req.header('x-forwarded-for') || 
                       'unknown';
      
      const userAgent = c.req.header('User-Agent') || 'unknown';
      
      try {
        await db.query(
          `INSERT INTO audit_logs 
           (user_id, entity_type, entity_id, action, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [user?.id || null, entityType, entityId, action, ipAddress, userAgent]
        );
      } catch (error: any) {
        console.error('❌ Erro ao registrar log de auditoria:', error.message);
      }
    }
  };
}

/**
 * Middleware opcional de autenticação (não bloqueia se não tiver token)
 */
export async function optionalAuthMiddleware(c: Context<HonoContext>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      
      if (decoded) {
        const result = await db.query(
          `SELECT 
            id, 
            name, 
            email, 
            password_hash, 
            role, 
            secretaria_id, 
            active, 
            created_at, 
            updated_at, 
            last_login 
           FROM users 
           WHERE id = $1 AND active = 1`,
          [decoded.userId]
        );
        
        if (result.rows.length > 0) {
          c.set('user', result.rows[0] as User);
        }
      }
    }
  } catch (error) {
    console.log('⚠️ Token opcional inválido, continuando sem autenticação');
  }
  
  await next();
}

/**
 * Middleware específico para token de preview (com expiração curta)
 */
export async function previewTokenMiddleware(c: Context<HonoContext>, next: Next) {
  try {
    console.log('🔐 Preview Token middleware executando...');
    
    const token = c.req.query('token');
    
    if (!token) {
      console.log('⚠️ Token de preview não fornecido');
      return c.json({ error: 'Token de preview não fornecido' }, 401);
    }
    
    // Verificar token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      console.log('❌ Token de preview inválido ou expirado');
      return c.json({ error: 'Token inválido ou expirado' }, 401);
    }
    
    // Verificar se o token tem propósito específico de preview
    if (decoded.purpose && decoded.purpose !== 'preview') {
      console.log('❌ Token não é para preview');
      return c.json({ error: 'Token inválido para esta operação' }, 401);
    }
    
    // Verificar se o token expirou
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      console.log('❌ Token de preview expirado');
      return c.json({ error: 'Token de preview expirado' }, 401);
    }
    
    // Verificar se o editionId corresponde
    const editionId = parseInt(c.req.param('id'));
    if (decoded.editionId && decoded.editionId !== editionId) {
      console.log(`❌ Token não corresponde a esta edição (esperado: ${decoded.editionId}, recebido: ${editionId})`);
      return c.json({ error: 'Token inválido para esta edição' }, 401);
    }
    
    console.log('✅ Token de preview válido');
    
    // Buscar usuário (opcional para preview)
    const result = await db.query(
      `SELECT 
        id, 
        name, 
        email, 
        role, 
        secretaria_id, 
        active 
       FROM users 
       WHERE id = $1 AND active = 1`,
      [decoded.userId]
    );
    
    if (result.rows.length > 0) {
      c.set('user', result.rows[0] as User);
    }
    
    await next();
  } catch (error: any) {
    console.error('❌ Erro no previewTokenMiddleware:', error.message);
    return c.json({ error: 'Erro na autenticação do preview' }, 500);
  }
}

/**
 * Middleware para desenvolvimento (simula usuário admin)
 */
export function devAuthMiddleware(c: Context<HonoContext>, next: Next) {
  console.log('🔓 Middleware de desenvolvimento - Acesso liberado');
  
  const mockUser: User = {
    id: 1,
    email: 'admin@municipio.gov.br',
    name: 'Administrador',
    password_hash: '',
    role: 'admin',
    secretaria_id: 1,
    active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  c.set('user', mockUser);
  
  return next();
}

/**
 * Helper para verificar se usuário tem acesso à matéria
 */
export function canAccessMatter(user: User | undefined, matter: any): boolean {
  if (!user) return false;
  
  if (user.role === 'admin' || user.role === 'semad') {
    return true;
  }
  
  if (user.role === 'secretaria') {
    return matter.secretaria_id === user.secretaria_id;
  }
  
  return false;
}

/**
 * Helper para verificar se usuário pode editar a matéria
 */
export function canEditMatter(user: User | undefined, matter: any): boolean {
  if (!user) return false;
  
  if (user.role === 'admin') {
    return true;
  }
  
  if (user.role === 'semad') {
    return matter.status === 'under_review' || matter.status === 'submitted';
  }
  
  if (user.role === 'secretaria') {
    return matter.secretaria_id === user.secretaria_id && 
           (matter.status === 'draft' || matter.status === 'rejected');
  }
  
  return false;
}

/**
 * Helper para verificar se usuário pode aprovar/rejeitar matéria
 */
export function canReviewMatter(user: User | undefined): boolean {
  if (!user) return false;
  return user.role === 'semad' || user.role === 'admin';
}

/**
 * Helper para verificar se usuário pode publicar matéria
 */
export function canPublishMatter(user: User | undefined): boolean {
  if (!user) return false;
  return user.role === 'semad' || user.role === 'admin';
}