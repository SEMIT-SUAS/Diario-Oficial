// ====================================
// DOM - Users Management Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { hashPassword } from '../utils/auth';

const users = new Hono<HonoContext>();

// Aplicar autenticação e restrição a admin
users.use('/*', authMiddleware);
users.use('/*', requireRole('admin'));

/**
 * GET /api/users
 * Lista todos os usuários
 */
users.get('/', async (c) => {
  try {
    const { results } = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.cpf, u.role, u.secretaria_id,
        u.active, u.created_at, u.last_login,
        s.name as secretaria_name, s.acronym as secretaria_acronym
      FROM users u
      LEFT JOIN secretarias s ON u.secretaria_id = s.id
      ORDER BY u.name ASC
    `).all();
    
    return c.json({ users: results });
    
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Erro ao buscar usuários', details: error.message }, 500);
  }
});

/**
 * GET /api/users/:id
 * Busca um usuário específico
 */
users.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const user = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.cpf, u.role, u.secretaria_id,
        u.active, u.created_at, u.last_login,
        s.name as secretaria_name, s.acronym as secretaria_acronym
      FROM users u
      LEFT JOIN secretarias s ON u.secretaria_id = s.id
      WHERE u.id = ?
    `).bind(id).first();
    
    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    return c.json({ user });
    
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Erro ao buscar usuário', details: error.message }, 500);
  }
});

/**
 * POST /api/users
 * Cria um novo usuário
 */
users.post('/', async (c) => {
  try {
    const admin = c.get('user');
    const { name, email, cpf, password, role, secretaria_id } = await c.req.json();
    
    // Validações
    if (!name || !email || !password || !role) {
      return c.json({ 
        error: 'Campos obrigatórios: name, email, password, role' 
      }, 400);
    }
    
    // Verificar se email já existe
    const existing = await db.query(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();
    
    if (existing) {
      return c.json({ error: 'Email já cadastrado' }, 400);
    }
    
    // Hash da senha
    const passwordHash = await hashPassword(password);
    
    // Criar usuário
    const result = await db.query(`
      INSERT INTO users (
        name, email, cpf, password_hash, role, secretaria_id, 
        active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).bind(name, email, cpf || null, passwordHash, role, secretaria_id || null).run();
    
    const userId = result.meta.last_row_id;
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      admin.id,
      'user',
      userId,
      'create',
      JSON.stringify({ name, email, role, secretaria_id }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({
      message: 'Usuário criado com sucesso',
      user: { id: userId, name, email, role }
    }, 201);
    
  } catch (error: any) {
    console.error('Error creating user:', error);
    return c.json({ error: 'Erro ao criar usuário', details: error.message }, 500);
  }
});

/**
 * PUT /api/users/:id
 * Atualiza um usuário
 */
users.put('/:id', async (c) => {
  try {
    const admin = c.get('user');
    const id = parseInt(c.req.param('id'));
    const bodyData = await c.req.json();
    let { name, email, cpf, role, secretaria_id, active } = bodyData;
    
    // DEBUG: Log dos dados recebidos
    console.log('PUT /api/users/:id - Dados recebidos:', JSON.stringify(bodyData));
    
    // Verificar se usuário existe e pegar valores atuais
    const user = await db.query(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();
    
    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // Se campos não foram enviados, usar valores atuais do banco
    name = name || user.name;
    email = email || user.email;
    role = role || user.role;
    
    // Validação mínima - só email é realmente obrigatório
    if (!email) {
      return c.json({ error: 'Email é obrigatório' }, 400);
    }
    
    // Não permitir que usuário desative a si mesmo
    if (id === admin.id && active === 0) {
      return c.json({ error: 'Não é possível desativar sua própria conta' }, 400);
    }
    
    // Garantir que secretaria_id seja null se não fornecido ou vazio
    const finalSecretariaId = (secretaria_id !== undefined && secretaria_id !== null && secretaria_id !== '') 
      ? parseInt(String(secretaria_id)) 
      : null;
    
    // Garantir que active seja 0 ou 1 - se não fornecido, manter valor atual
    const finalActive = (active !== undefined) 
      ? ((active === true || active === 1 || active === '1') ? 1 : 0)
      : user.active;
    
    console.log('PUT /api/users/:id - Valores finais:', {
      name, email, cpf: cpf || null, role, 
      secretaria_id: finalSecretariaId, 
      active: finalActive
    });
    
    // Atualizar usuário
    await db.query(`
      UPDATE users 
      SET name = ?, email = ?, cpf = ?, role = ?, 
          secretaria_id = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(name, email, cpf || null, role, finalSecretariaId, finalActive, id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      admin.id,
      'user',
      id,
      'update',
      JSON.stringify(user),
      JSON.stringify({ name, email, cpf, role, secretaria_id, active }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Usuário atualizado com sucesso' });
    
  } catch (error: any) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Erro ao atualizar usuário', details: error.message }, 500);
  }
});

/**
 * PUT /api/users/:id/reset-password
 * Reset de senha pelo admin
 */
users.put('/:id/reset-password', async (c) => {
  try {
    const admin = c.get('user');
    const id = parseInt(c.req.param('id'));
    const { new_password } = await c.req.json();
    
    if (!new_password || new_password.length < 6) {
      return c.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, 400);
    }
    
    // Verificar se usuário existe
    const user = await db.query(
      'SELECT id, name, email FROM users WHERE id = ?'
    ).bind(id).first();
    
    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // Hash da nova senha
    const passwordHash = await hashPassword(new_password);
    
    // Atualizar senha
    await db.query(
      'UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(passwordHash, id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      admin.id,
      'user',
      id,
      'reset_password',
      JSON.stringify({ reset_by_admin: admin.id }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Senha resetada com sucesso' });
    
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return c.json({ error: 'Erro ao resetar senha', details: error.message }, 500);
  }
});

/**
 * DELETE /api/users/:id
 * Deleta um usuário (desativa)
 */
users.delete('/:id', async (c) => {
  try {
    const admin = c.get('user');
    const id = parseInt(c.req.param('id'));
    
    // Não permitir que admin delete a si mesmo
    if (id === admin.id) {
      return c.json({ error: 'Não é possível excluir sua própria conta' }, 400);
    }
    
    // Verificar se usuário existe
    const user = await db.query(
      'SELECT * FROM users WHERE id = ?'
    ).bind(id).first();
    
    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // EXCLUIR usuário permanentemente (hard delete)
    // AVISO: Isso remove o usuário completamente do banco de dados
    await db.query(
      'DELETE FROM users WHERE id = ?'
    ).bind(id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      admin.id,
      'user',
      id,
      'delete',
      JSON.stringify(user),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Usuário desativado com sucesso' });
    
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Erro ao excluir usuário', details: error.message }, 500);
  }
});

export default users;
