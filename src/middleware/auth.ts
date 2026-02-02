// ====================================
// DOM - Authentication Middleware (PostgreSQL)
// ====================================

import { Context, Next } from 'hono';
import { HonoContext, User, UserRole } from '../types';
import { verifyToken, TokenPayload } from '../utils/auth';
import db from '../lib/db';

/**
 * Middleware para verificar autenticação
 */
export async function authMiddleware(c: Context<HonoContext>, next: Next) {
  try {
    console.log('🔐 Auth middleware executando...');
    
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('⚠️  Token não fornecido ou formato inválido');
      // Para desenvolvimento, vamos permitir continuar sem token
      c.set('user', undefined);
      await next();
      return;
    }
    
    const token = authHeader.substring(7); // Remove "Bearer "
    
    // Verificar token
    const decoded = await verifyToken(token);
    
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
        cpf, 
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
export async function auditLog(action: string, entityType: string) {
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
        // Verificar se a tabela audit_logs existe
        await db.query(
          `INSERT INTO audit_logs 
           (user_id, entity_type, entity_id, action, ip_address, user_agent, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [user?.id || null, entityType, entityId, action, ipAddress, userAgent]
        );
      } catch (error: any) {
        console.error('❌ Erro ao registrar log de auditoria:', error.message);
        // Não falhar a requisição principal por causa do log
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
      const decoded = await verifyToken(token);
      
      if (decoded) {
        const result = await db.query(
          `SELECT 
            id, 
            name, 
            email, 
            password_hash, 
            cpf, 
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
    console.log('⚠️  Token opcional inválido, continuando sem autenticação');
  }
  
  await next();
}

/**
 * Middleware para desenvolvimento (simula usuário admin)
 */
export function devAuthMiddleware(c: Context<HonoContext>, next: Next) {
  // Crie um usuário mock para desenvolvimento
  const mockUser: User = {
    id: 1,
    email: 'admin@municipio.gov.br',
    name: 'Administrador',
    password_hash: 'hashed_password',
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
  
  // Admin e SEMAD podem acessar todas
  if (user.role === 'admin' || user.role === 'semad') {
    return true;
  }
  
  // Secretaria só pode acessar suas próprias matérias
  if (user.role === 'secretaria') {
    return matter.secretaria_id === user.secretaria_id;
  }
  
  // Outros roles não têm acesso
  return false;
}

/**
 * Helper para verificar se usuário pode editar a matéria
 */
export function canEditMatter(user: User | undefined, matter: any): boolean {
  if (!user) return false;
  
  // Admin pode editar tudo
  if (user.role === 'admin') {
    return true;
  }
  
  // SEMAD pode editar matérias em análise
  if (user.role === 'semad') {
    return matter.status === 'under_review' || matter.status === 'submitted';
  }
  
  // Secretaria só pode editar suas próprias matérias em draft ou rejeitadas
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
  
  // Apenas SEMAD e admin podem revisar
  return user.role === 'semad' || user.role === 'admin';
}

/**
 * Helper para verificar se usuário pode publicar matéria
 */
export function canPublishMatter(user: User | undefined): boolean {
  if (!user) return false;
  
  // Apenas SEMAD e admin podem publicar
  return user.role === 'semad' || user.role === 'admin';
}