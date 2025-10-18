// ====================================
// DOM - Secretarias Routes
// CRUD Completo de Secretarias
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';

const secretarias = new Hono<HonoContext>();

// Aplicar autenticação em todas as rotas de secretarias
secretarias.use('/*', authMiddleware);

/**
 * GET /api/secretarias
 * Lista todas as secretarias
 */
secretarias.get('/', requireRole('admin', 'semad'), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT 
        s.*,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT m.id) as total_matters
      FROM secretarias s
      LEFT JOIN users u ON s.id = u.secretaria_id AND u.active = 1
      LEFT JOIN matters m ON s.id = m.secretaria_id
      GROUP BY s.id
      ORDER BY s.name ASC
    `).all();
    
    return c.json({ secretarias: results });
    
  } catch (error: any) {
    console.error('Error fetching secretarias:', error);
    return c.json({ error: 'Erro ao buscar secretarias', details: error.message }, 500);
  }
});

/**
 * GET /api/secretarias/:id
 * Busca uma secretaria específica
 */
secretarias.get('/:id', requireRole('admin', 'semad'), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const secretaria = await c.env.DB.prepare(`
      SELECT s.* FROM secretarias s WHERE s.id = ?
    `).bind(id).first();
    
    if (!secretaria) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Buscar usuários da secretaria
    const { results: users } = await c.env.DB.prepare(`
      SELECT id, name, email, role, active FROM users 
      WHERE secretaria_id = ?
      ORDER BY name ASC
    `).bind(id).all();
    
    return c.json({ 
      secretaria,
      users 
    });
    
  } catch (error: any) {
    console.error('Error fetching secretaria:', error);
    return c.json({ error: 'Erro ao buscar secretaria', details: error.message }, 500);
  }
});

/**
 * POST /api/secretarias
 * Cria uma nova secretaria
 */
secretarias.post('/', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const { name, acronym, email, phone, responsible } = await c.req.json();
    
    if (!name || !acronym) {
      return c.json({ error: 'Nome e sigla são obrigatórios' }, 400);
    }
    
    // Verificar se sigla já existe
    const existing = await c.env.DB.prepare(
      'SELECT id FROM secretarias WHERE acronym = ?'
    ).bind(acronym).first();
    
    if (existing) {
      return c.json({ error: 'Sigla já está em uso' }, 400);
    }
    
    const result = await c.env.DB.prepare(`
      INSERT INTO secretarias (
        name, acronym, email, phone, responsible,
        active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).bind(
      name,
      acronym.toUpperCase(),
      email || null,
      phone || null,
      responsible || null
    ).run();
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'secretaria',
      result.meta.last_row_id,
      'create',
      JSON.stringify({ name, acronym }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ 
      message: 'Secretaria criada com sucesso',
      id: result.meta.last_row_id
    }, 201);
    
  } catch (error: any) {
    console.error('Error creating secretaria:', error);
    return c.json({ error: 'Erro ao criar secretaria', details: error.message }, 500);
  }
});

/**
 * PUT /api/secretarias/:id
 * Atualiza uma secretaria
 */
secretarias.put('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const { name, acronym, email, phone, responsible, active } = await c.req.json();
    
    // Verificar se existe
    const existing = await c.env.DB.prepare(
      'SELECT * FROM secretarias WHERE id = ?'
    ).bind(id).first();
    
    if (!existing) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Verificar se sigla está disponível
    if (acronym && acronym !== existing.acronym) {
      const acronymExists = await c.env.DB.prepare(
        'SELECT id FROM secretarias WHERE acronym = ? AND id != ?'
      ).bind(acronym.toUpperCase(), id).first();
      
      if (acronymExists) {
        return c.json({ error: 'Sigla já está em uso' }, 400);
      }
    }
    
    await c.env.DB.prepare(`
      UPDATE secretarias 
      SET name = ?,
          acronym = ?,
          email = ?,
          phone = ?,
          responsible = ?,
          active = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      name || existing.name,
      acronym ? acronym.toUpperCase() : existing.acronym,
      email !== undefined ? email : existing.email,
      phone !== undefined ? phone : existing.phone,
      responsible !== undefined ? responsible : existing.responsible,
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id
    ).run();
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'secretaria',
      id,
      'update',
      JSON.stringify(existing),
      JSON.stringify({ name, acronym, email, phone, responsible, active }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Secretaria atualizada com sucesso' });
    
  } catch (error: any) {
    console.error('Error updating secretaria:', error);
    return c.json({ error: 'Erro ao atualizar secretaria', details: error.message }, 500);
  }
});

/**
 * DELETE /api/secretarias/:id
 * Deleta uma secretaria (soft delete se tiver usuários/matérias)
 */
secretarias.delete('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    
    // Verificar se existe
    const secretaria = await c.env.DB.prepare(
      'SELECT * FROM secretarias WHERE id = ?'
    ).bind(id).first();
    
    if (!secretaria) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Verificar se tem usuários ou matérias
    const { results: usage } = await c.env.DB.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE secretaria_id = ?) as total_users,
        (SELECT COUNT(*) FROM matters WHERE secretaria_id = ?) as total_matters
    `).bind(id, id).all();
    
    const hasUsage = usage[0] && (usage[0].total_users > 0 || usage[0].total_matters > 0);
    
    if (hasUsage) {
      // Soft delete - apenas desativa
      await c.env.DB.prepare(
        'UPDATE secretarias SET active = 0, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(id).run();
      
      return c.json({ 
        message: 'Secretaria desativada (possui usuários ou matérias vinculadas)',
        soft_delete: true
      });
    } else {
      // Hard delete - remove completamente
      await c.env.DB.prepare('DELETE FROM secretarias WHERE id = ?').bind(id).run();
      
      return c.json({ 
        message: 'Secretaria removida com sucesso',
        soft_delete: false
      });
    }
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'secretaria',
      id,
      hasUsage ? 'deactivate' : 'delete',
      JSON.stringify(secretaria),
      ipAddress,
      userAgent
    ).run();
    
  } catch (error: any) {
    console.error('Error deleting secretaria:', error);
    return c.json({ error: 'Erro ao deletar secretaria', details: error.message }, 500);
  }
});

export default secretarias;
