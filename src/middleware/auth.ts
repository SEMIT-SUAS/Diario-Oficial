// ====================================
// DOM - Authentication Middleware
// ====================================

import { Context, Next } from 'hono';
import { HonoContext, User, UserRole } from '../types';
import { verifyToken } from '../utils/auth';

/**
 * Middleware para verificar autenticação
 */
export async function authMiddleware(c: Context<HonoContext>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Token de autenticação não fornecido' }, 401);
  }
  
  const token = authHeader.substring(7); // Remove "Bearer "
  const decoded = await verifyToken(token);
  
  if (!decoded) {
    return c.json({ error: 'Token inválido ou expirado' }, 401);
  }
  
  // Buscar usuário no banco
  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE id = ? AND active = 1')
    .bind(decoded.userId)
    .first<User>();
  
  if (!user) {
    return c.json({ error: 'Usuário não encontrado ou inativo' }, 401);
  }
  
  // Armazenar usuário no contexto
  c.set('user', user);
  
  await next();
}

/**
 * Middleware para verificar permissão por role
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return async (c: Context<HonoContext>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Permissão negada' }, 403);
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
  if (user.role === 'secretaria' && user.secretaria_id?.toString() !== secretariaId) {
    return c.json({ error: 'Acesso negado a esta secretaria' }, 403);
  }
  
  await next();
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
    if (c.res.status < 400) {
      const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP') || 'unknown';
      const userAgent = c.req.header('User-Agent') || 'unknown';
      
      await c.env.DB
        .prepare(`
          INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address, user_agent, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(user?.id || null, entityType, entityId, action, ipAddress, userAgent)
        .run();
    }
  };
}
