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
    
    const stmt = db.query(query);
    const { results } = await (params.length > 0 ? stmt.bind(...params) : stmt).all();
    
    // Mapear tipos do banco (português) para frontend (inglês)
    const reverseTypeMap: Record<string, string> = {
      'nacional': 'national',
      'estadual': 'state',
      'municipal': 'municipal',
      'ponto_facultativo': 'optional'
    };
    
    const mappedResults = (results as any[]).map(h => ({
      ...h,
      type: reverseTypeMap[h.type] || h.type,
      is_recurring: h.recurring // Adicionar alias para frontend
    }));
    
    return c.json({ holidays: mappedResults });
    
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
    
    const holiday = await db.query(
      'SELECT * FROM holidays WHERE id = ?'
    ).bind(id).first<any>();
    
    if (!holiday) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    // Mapear tipos do banco (português) para frontend (inglês)
    const reverseTypeMap: Record<string, string> = {
      'nacional': 'national',
      'estadual': 'state',
      'municipal': 'municipal',
      'ponto_facultativo': 'optional'
    };
    
    const mappedHoliday = {
      ...holiday,
      type: reverseTypeMap[holiday.type] || holiday.type,
      is_recurring: holiday.recurring
    };
    
    return c.json({ holiday: mappedHoliday });
    
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
    
    // Mapear tipo do frontend (inglês) para banco (português)
    const typeMap: Record<string, string> = {
      'national': 'nacional',
      'state': 'estadual',
      'municipal': 'municipal',
      'optional': 'ponto_facultativo'
    };
    
    const validTypes = ['national', 'state', 'municipal', 'optional'];
    if (!validTypes.includes(type)) {
      return c.json({ error: 'Tipo inválido. Use: national, state, municipal ou optional' }, 400);
    }
    
    const dbType = typeMap[type] || type;
    
    // Verificar se já existe feriado nesta data
    const existing = await db.query(
      'SELECT id FROM holidays WHERE date = ?'
    ).bind(date).first();
    
    if (existing) {
      return c.json({ error: 'Já existe um feriado cadastrado nesta data' }, 400);
    }
    
    // Extrair ano da data
    const year = new Date(date + 'T00:00:00').getFullYear();
    
    const result = await db.query(`
      INSERT INTO holidays (
        date, name, type, recurring, year, active, created_at, created_by
      ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'), ?)
    `).bind(
      date,
      name,
      dbType,  // Usar valor mapeado para português
      is_recurring ? 1 : 0,
      year,
      user.id
    ).run();
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
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
    const existing = await db.query(
      'SELECT * FROM holidays WHERE id = ?'
    ).bind(id).first<any>();
    
    if (!existing) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    // Mapear tipo do frontend (inglês) para banco (português)
    const typeMap: Record<string, string> = {
      'national': 'nacional',
      'state': 'estadual',
      'municipal': 'municipal',
      'optional': 'ponto_facultativo'
    };
    
    // Validar tipo se fornecido
    if (type) {
      const validTypes = ['national', 'state', 'municipal', 'optional'];
      if (!validTypes.includes(type)) {
        return c.json({ error: 'Tipo inválido. Use: national, state, municipal ou optional' }, 400);
      }
    }
    
    const dbType = type ? (typeMap[type] || type) : existing.type;
    
    // Verificar conflito de data
    if (date && date !== existing.date) {
      const dateConflict = await db.query(
        'SELECT id FROM holidays WHERE date = ? AND id != ?'
      ).bind(date, id).first();
      
      if (dateConflict) {
        return c.json({ error: 'Já existe um feriado cadastrado nesta data' }, 400);
      }
    }
    
    // Calcular novo ano se data mudar
    const finalDate = date || existing.date;
    const year = new Date(finalDate + 'T00:00:00').getFullYear();
    
    await db.query(`
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
      dbType,  // Usar valor mapeado
      is_recurring !== undefined ? (is_recurring ? 1 : 0) : existing.recurring,
      year,
      id
    ).run();
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
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
    const holiday = await db.query(
      'SELECT * FROM holidays WHERE id = ?'
    ).bind(id).first();
    
    if (!holiday) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    // Deletar feriado
    await db.query('DELETE FROM holidays WHERE id = ?').bind(id).run();
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
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
