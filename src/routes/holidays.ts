// ====================================
// DOM - Holidays Routes
// CRUD Completo de Feriados
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';

const holidays = new Hono<HonoContext>();

// Aplicar autenticação em todas as rotas de holidays
holidays.use('/*', authMiddleware);

/**
 * GET /api/holidays
 * Lista todos os feriados (com filtro opcional por ano)
 */
holidays.get('/', async (c) => {
  try {
    const year = c.req.query('year');
    
    let query = 'SELECT * FROM holidays WHERE 1=1';
    const params: any[] = [];
    
    if (year) {
      query += ` AND strftime('%Y', date) = ?`;
      params.push(year);
    }
    
    query += ' ORDER BY date ASC';
    
    const stmt = c.env.DB.prepare(query);
    const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
    
    return c.json({ holidays: results });
    
  } catch (error: any) {
    console.error('Error fetching holidays:', error);
    return c.json({ error: 'Erro ao buscar feriados', details: error.message }, 500);
  }
});

/**
 * GET /api/holidays/:id
 * Busca um feriado específico
 */
holidays.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const holiday = await c.env.DB.prepare(
      'SELECT * FROM holidays WHERE id = ?'
    ).bind(id).first();
    
    if (!holiday) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    return c.json({ holiday });
    
  } catch (error: any) {
    console.error('Error fetching holiday:', error);
    return c.json({ error: 'Erro ao buscar feriado', details: error.message }, 500);
  }
});

/**
 * POST /api/holidays
 * Cria um novo feriado
 */
holidays.post('/', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const { date, name, type, is_recurring } = await c.req.json();
    
    if (!date || !name || !type) {
      return c.json({ error: 'Data, nome e tipo são obrigatórios' }, 400);
    }
    
    // Validar tipo
    const validTypes = ['national', 'state', 'municipal', 'optional'];
    if (!validTypes.includes(type)) {
      return c.json({ error: 'Tipo inválido. Use: national, state, municipal ou optional' }, 400);
    }
    
    // Verificar se já existe feriado nesta data
    const existing = await c.env.DB.prepare(
      'SELECT id FROM holidays WHERE date = ?'
    ).bind(date).first();
    
    if (existing) {
      return c.json({ error: 'Já existe um feriado cadastrado nesta data' }, 400);
    }
    
    // Extrair ano da data
    const year = new Date(date + 'T00:00:00').getFullYear();
    
    const result = await c.env.DB.prepare(`
      INSERT INTO holidays (
        date, name, type, recurring, year, active, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), ?)
    `).bind(
      date,
      name,
      type,
      is_recurring ? 1 : 0,
      year,
      user.id
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
      'holiday',
      result.meta.last_row_id,
      'create',
      JSON.stringify({ date, name, type, is_recurring }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ 
      message: 'Feriado criado com sucesso',
      id: result.meta.last_row_id
    }, 201);
    
  } catch (error: any) {
    console.error('Error creating holiday:', error);
    return c.json({ error: 'Erro ao criar feriado', details: error.message }, 500);
  }
});

/**
 * PUT /api/holidays/:id
 * Atualiza um feriado
 */
holidays.put('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const { date, name, type, is_recurring } = await c.req.json();
    
    // Verificar se existe
    const existing = await c.env.DB.prepare(
      'SELECT * FROM holidays WHERE id = ?'
    ).bind(id).first<any>();
    
    if (!existing) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    // Validar tipo se fornecido
    if (type) {
      const validTypes = ['national', 'state', 'municipal', 'optional'];
      if (!validTypes.includes(type)) {
        return c.json({ error: 'Tipo inválido. Use: national, state, municipal ou optional' }, 400);
      }
    }
    
    // Verificar conflito de data
    if (date && date !== existing.date) {
      const dateConflict = await c.env.DB.prepare(
        'SELECT id FROM holidays WHERE date = ? AND id != ?'
      ).bind(date, id).first();
      
      if (dateConflict) {
        return c.json({ error: 'Já existe um feriado cadastrado nesta data' }, 400);
      }
    }
    
    // Calcular novo ano se data mudar
    const finalDate = date || existing.date;
    const year = new Date(finalDate + 'T00:00:00').getFullYear();
    
    await c.env.DB.prepare(`
      UPDATE holidays 
      SET date = ?,
          name = ?,
          type = ?,
          recurring = ?,
          year = ?
      WHERE id = ?
    `).bind(
      finalDate,
      name || existing.name,
      type || existing.type,
      is_recurring !== undefined ? (is_recurring ? 1 : 0) : existing.recurring,
      year,
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
      'holiday',
      id,
      'update',
      JSON.stringify(existing),
      JSON.stringify({ date, name, type, is_recurring }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Feriado atualizado com sucesso' });
    
  } catch (error: any) {
    console.error('Error updating holiday:', error);
    return c.json({ error: 'Erro ao atualizar feriado', details: error.message }, 500);
  }
});

/**
 * DELETE /api/holidays/:id
 * Deleta um feriado
 */
holidays.delete('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    
    // Verificar se existe
    const holiday = await c.env.DB.prepare(
      'SELECT * FROM holidays WHERE id = ?'
    ).bind(id).first();
    
    if (!holiday) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    // Deletar feriado
    await c.env.DB.prepare('DELETE FROM holidays WHERE id = ?').bind(id).run();
    
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
      'holiday',
      id,
      'delete',
      JSON.stringify(holiday),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Feriado removido com sucesso' });
    
  } catch (error: any) {
    console.error('Error deleting holiday:', error);
    return c.json({ error: 'Erro ao deletar feriado', details: error.message }, 500);
  }
});

export default holidays;
