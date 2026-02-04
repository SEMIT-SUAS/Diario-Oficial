// ====================================
// DOM - Users Management Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { hashPassword } from '../utils/auth';
import db from '../lib/db'; // Importe a conexão PostgreSQL

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
    const result = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.cpf, u.role, u.secretaria_id,
        u.active, u.created_at, u.last_login,
        s.name as secretaria_name, s.acronym as secretaria_acronym
      FROM users u
      LEFT JOIN secretarias s ON u.secretaria_id = s.id
      ORDER BY u.name ASC
    `);
    
    return c.json({ users: result.rows });
    
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Erro ao buscar usuários', details: error.message }, 500);
  }
});

/**
 * GET /api/users/stats
 * Estatísticas de usuários
 */
users.get('/stats', async (c) => {
  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN active = false THEN 1 END) as inactive_users,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'semad' THEN 1 END) as semad_users,
        COUNT(CASE WHEN role = 'secretaria' THEN 1 END) as secretaria_users,
        COUNT(CASE WHEN role = 'publico' THEN 1 END) as publico_users,
        COUNT(CASE WHEN last_login >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as active_last_month
      FROM users
    `);
    
    return c.json({ stats: result.rows[0] });
    
  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return c.json({ error: 'Erro ao buscar estatísticas de usuários', details: error.message }, 500);
  }
});

/**
 * GET /api/users/:id
 * Busca um usuário específico
 */
users.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const result = await db.query(`
      SELECT 
        u.id, u.name, u.email, u.cpf, u.role, u.secretaria_id,
        u.active, u.created_at, u.last_login,
        s.name as secretaria_name, s.acronym as secretaria_acronym
      FROM users u
      LEFT JOIN secretarias s ON u.secretaria_id = s.id
      WHERE u.id = $1
    `, [id]);
    
    const user = result.rows[0];
    
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
    if (!admin) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { name, email, cpf, password, role, secretaria_id } = await c.req.json();
    
    // Validações
    if (!name || !email || !password || !role) {
      return c.json({ 
        error: 'Campos obrigatórios: name, email, password, role' 
      }, 400);
    }
    
    // Validar role
    const validRoles = ['admin', 'semad', 'secretaria', 'publico'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Role inválida' }, 400);
    }
    
    // Verificar se email já existe
    const existingResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    
    if (existingResult.rows.length > 0) {
      return c.json({ error: 'Email já cadastrado' }, 400);
    }
    
    // Hash da senha
    const passwordHash = await hashPassword(password);
    
    // Criar usuário
    const result = await db.query(`
      INSERT INTO users (
        name, email, cpf, password_hash, role, secretaria_id, 
        active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id, name, email, role, secretaria_id
    `, [
      name, 
      email, 
      cpf || null, 
      passwordHash, 
      role, 
      secretaria_id || null
    ]);
    
    const newUser = result.rows[0];
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      admin.id,
      'user',
      newUser.id,
      'create',
      JSON.stringify({ name, email, role, secretaria_id }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({
      message: 'Usuário criado com sucesso',
      user: newUser
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
    if (!admin) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const bodyData = await c.req.json();
    let { name, email, cpf, role, secretaria_id, active } = bodyData;
    
    // DEBUG: Log dos dados recebidos
    console.log('PUT /api/users/:id - Dados recebidos:', JSON.stringify(bodyData));
    
    // Verificar se usuário existe e pegar valores atuais
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    const user = userResult.rows[0];
    
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
    
    // Validar role se for fornecida
    if (role) {
      const validRoles = ['admin', 'semad', 'secretaria', 'publico'];
      if (!validRoles.includes(role)) {
        return c.json({ error: 'Role inválida' }, 400);
      }
    }
    
    // Não permitir que usuário desative a si mesmo
    if (id === admin.id && active === false) {
      return c.json({ error: 'Não é possível desativar sua própria conta' }, 400);
    }
    
    // Não permitir que usuário altere sua própria role para não-admin
    if (id === admin.id && role !== 'admin') {
      return c.json({ error: 'Não é possível alterar sua própria role' }, 400);
    }
    
    // Garantir que secretaria_id seja null se não fornecido ou vazio
    const finalSecretariaId = (secretaria_id !== undefined && secretaria_id !== null && secretaria_id !== '') 
      ? parseInt(String(secretaria_id)) 
      : null;
    
    // Garantir que active seja boolean - se não fornecido, manter valor atual
    const finalActive = (active !== undefined) 
      ? Boolean(active)
      : user.active;
    
    console.log('PUT /api/users/:id - Valores finais:', {
      name, email, cpf: cpf || null, role, 
      secretaria_id: finalSecretariaId, 
      active: finalActive
    });
    
    // Atualizar usuário
    await db.query(`
      UPDATE users 
      SET name = $1, email = $2, cpf = $3, role = $4, 
          secretaria_id = $5, active = $6, updated_at = NOW()
      WHERE id = $7
    `, [
      name, 
      email, 
      cpf || null, 
      role, 
      finalSecretariaId, 
      finalActive, 
      id
    ]);
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      admin.id,
      'user',
      id,
      'update',
      JSON.stringify(user),
      JSON.stringify({ name, email, cpf, role, secretaria_id, active }),
      ipAddress,
      userAgent
    ]);
    
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
    if (!admin) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { new_password } = await c.req.json();
    
    if (!new_password || new_password.length < 6) {
      return c.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, 400);
    }
    
    // Verificar se usuário existe
    const userResult = await db.query(
      'SELECT id, name, email FROM users WHERE id = $1',
      [id]
    );
    
    const user = userResult.rows[0];
    
    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // Hash da nova senha
    const passwordHash = await hashPassword(new_password);
    
    // Atualizar senha
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, id]
    );
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      admin.id,
      'user',
      id,
      'reset_password',
      JSON.stringify({ reset_by_admin: admin.id }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ message: 'Senha resetada com sucesso' });
    
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return c.json({ error: 'Erro ao resetar senha', details: error.message }, 500);
  }
});

/**
 * POST /api/users/import
 * Importa múltiplos usuários de uma vez
 */
users.post('/import', async (c) => {
  try {
    const admin = c.get('user');
    if (!admin) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { users: usersToImport } = await c.req.json();
    
    if (!Array.isArray(usersToImport) || usersToImport.length === 0) {
      return c.json({ error: 'Array de usuários é obrigatório' }, 400);
    }
    
    const validRoles = ['admin', 'semad', 'secretaria', 'publico'];
    const results = {
      created: [] as any[],
      skipped: [] as { email: string; reason: string }[],
      errors: [] as { email: string; error: string }[]
    };
    
    for (const userData of usersToImport) {
      const { name, email, cpf, password, role, secretaria_id } = userData;
      
      try {
        // Validações básicas
        if (!name || !email || !role) {
          results.skipped.push({ email: email || 'unknown', reason: 'Campos obrigatórios faltando' });
          continue;
        }
        
        if (!validRoles.includes(role)) {
          results.skipped.push({ email, reason: 'Role inválida' });
          continue;
        }
        
        // Verificar se email já existe
        const existingResult = await db.query(
          'SELECT id FROM users WHERE email = $1',
          [email]
        );
        
        if (existingResult.rows.length > 0) {
          results.skipped.push({ email, reason: 'Email já cadastrado' });
          continue;
        }
        
        // Gerar senha aleatória se não fornecida
        const userPassword = password || Math.random().toString(36).slice(-8);
        const passwordHash = await hashPassword(userPassword);
        
        // Criar usuário
        const result = await db.query(`
          INSERT INTO users (
            name, email, cpf, password_hash, role, secretaria_id, 
            active, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
          RETURNING id, name, email, role
        `, [
          name, 
          email, 
          cpf || null, 
          passwordHash, 
          role, 
          secretaria_id || null
        ]);
        
        const newUser = result.rows[0];
        results.created.push({
          ...newUser,
          password_generated: !password // Flag se senha foi gerada
        });
        
      } catch (error: any) {
        results.errors.push({ email: email || 'unknown', error: error.message });
      }
    }
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      admin.id,
      'user',
      null,
      'import_multiple',
      JSON.stringify({ imported: results.created.length, total: usersToImport.length }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({
      message: `Importação concluída: ${results.created.length} criados, ${results.skipped.length} ignorados`,
      results
    });
    
  } catch (error: any) {
    console.error('Error importing users:', error);
    return c.json({ error: 'Erro ao importar usuários', details: error.message }, 500);
  }
});

/**
 * DELETE /api/users/:id
 * Deleta um usuário (desativa)
 */
users.delete('/:id', async (c) => {
  try {
    const admin = c.get('user');
    if (!admin) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    
    // Não permitir que admin delete a si mesmo
    if (id === admin.id) {
      return c.json({ error: 'Não é possível excluir sua própria conta' }, 400);
    }
    
    // Verificar se usuário existe
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    
    const user = userResult.rows[0];
    
    if (!user) {
      return c.json({ error: 'Usuário não encontrado' }, 404);
    }
    
    // Verificar se usuário tem matérias vinculadas
    const mattersResult = await db.query(
      'SELECT COUNT(*) as count FROM matters WHERE author_id = $1',
      [id]
    );
    
    const matterCount = parseInt(mattersResult.rows[0]?.count || '0');
    
    if (matterCount > 0) {
      // Soft delete - apenas desativa
      await db.query(
        'UPDATE users SET active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );
      
      // Log de auditoria
      const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
      const userAgent = c.req.header('user-agent') || 'unknown';
      
      await db.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action,
          old_values, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        admin.id,
        'user',
        id,
        'deactivate',
        JSON.stringify(user),
        ipAddress,
        userAgent
      ]);
      
      return c.json({ 
        message: 'Usuário desativado (possui matérias vinculadas)',
        soft_delete: true,
        matter_count: matterCount
      });
    }
    
    // Hard delete - remove completamente (apenas se não tiver matérias)
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      admin.id,
      'user',
      id,
      'delete',
      JSON.stringify(user),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ 
      message: 'Usuário removido com sucesso',
      soft_delete: false
    });
    
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return c.json({ error: 'Erro ao excluir usuário', details: error.message }, 500);
  }
});

export default users;