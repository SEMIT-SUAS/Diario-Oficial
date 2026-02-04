// ====================================
// DOM - Holidays Routes
// CRUD Completo de Feriados
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db'; // Importe a conexão PostgreSQL

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
      // PostgreSQL usa EXTRACT(YEAR FROM date) para extrair o ano
      query += ` AND EXTRACT(YEAR FROM date) = $1`;
      params.push(year);
    }
    
    query += ' ORDER BY date ASC';
    
    const result = params.length > 0 
      ? await db.query(query, params)
      : await db.query(query);
    
    // Mapear tipos do banco (português) para frontend (inglês)
    const reverseTypeMap: Record<string, string> = {
      'nacional': 'national',
      'estadual': 'state',
      'municipal': 'municipal',
      'ponto_facultativo': 'optional'
    };
    
    const mappedResults = result.rows.map((h: any) => ({
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
    
    const result = await db.query(
      'SELECT * FROM holidays WHERE id = $1',
      [id]
    );
    
    const holiday = result.rows[0];
    
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
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
    const existingResult = await db.query(
      'SELECT id FROM holidays WHERE date = $1',
      [date]
    );
    
    if (existingResult.rows.length > 0) {
      return c.json({ error: 'Já existe um feriado cadastrado nesta data' }, 400);
    }
    
    // Extrair ano da data
    const year = new Date(date + 'T00:00:00').getFullYear();
    
    const result = await db.query(`
      INSERT INTO holidays (
        date, name, type, recurring, year, active, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, true, NOW(), $6)
      RETURNING id
    `, [
      date,
      name,
      dbType,  // Usar valor mapeado para português
      is_recurring ? 1 : 0,
      year,
      user.id
    ]);
    
    const holidayId = result.rows[0].id;
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      user.id,
      'holiday',
      holidayId,
      'create',
      JSON.stringify({ date, name, type, is_recurring }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ 
      message: 'Feriado criado com sucesso',
      id: holidayId
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { date, name, type, is_recurring } = await c.req.json();
    
    // Verificar se existe
    const existingResult = await db.query(
      'SELECT * FROM holidays WHERE id = $1',
      [id]
    );
    
    const existing = existingResult.rows[0];
    
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
      const dateConflictResult = await db.query(
        'SELECT id FROM holidays WHERE date = $1 AND id != $2',
        [date, id]
      );
      
      if (dateConflictResult.rows.length > 0) {
        return c.json({ error: 'Já existe um feriado cadastrado nesta data' }, 400);
      }
    }
    
    // Calcular novo ano se data mudar
    const finalDate = date || existing.date;
    const year = new Date(finalDate + 'T00:00:00').getFullYear();
    
    await db.query(`
      UPDATE holidays 
      SET date = $1,
          name = $2,
          type = $3,
          recurring = $4,
          year = $5
      WHERE id = $6
    `, [
      finalDate,
      name || existing.name,
      dbType,  // Usar valor mapeado
      is_recurring !== undefined ? (is_recurring ? 1 : 0) : existing.recurring,
      year,
      id
    ]);
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      user.id,
      'holiday',
      id,
      'update',
      JSON.stringify(existing),
      JSON.stringify({ date, name, type, is_recurring }),
      ipAddress,
      userAgent
    ]);
    
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    
    // Verificar se existe
    const holidayResult = await db.query(
      'SELECT * FROM holidays WHERE id = $1',
      [id]
    );
    
    const holiday = holidayResult.rows[0];
    
    if (!holiday) {
      return c.json({ error: 'Feriado não encontrado' }, 404);
    }
    
    // Deletar feriado
    await db.query('DELETE FROM holidays WHERE id = $1', [id]);
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      user.id,
      'holiday',
      id,
      'delete',
      JSON.stringify(holiday),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ message: 'Feriado removido com sucesso' });
    
  } catch (error: any) {
    console.error('Error deleting holiday:', error);
    return c.json({ error: 'Erro ao deletar feriado', details: error.message }, 500);
  }
});

/**
 * POST /api/holidays/generate-year
 * Gera feriados recorrentes para um ano específico
 */
holidays.post('/generate-year', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { year } = await c.req.json();
    
    if (!year || year < 1900 || year > 2100) {
      return c.json({ error: 'Ano inválido. Deve estar entre 1900 e 2100' }, 400);
    }
    
    // Buscar feriados recorrentes
    const recurringResult = await db.query(
      'SELECT * FROM holidays WHERE recurring = 1 AND active = 1'
    );
    
    const recurringHolidays = recurringResult.rows;
    let created = 0;
    let skipped = 0;
    
    // Para cada feriado recorrente, criar para o ano especificado
    for (const holiday of recurringHolidays) {
      try {
        // Extrair mês e dia da data original
        const originalDate = new Date(holiday.date);
        const month = originalDate.getMonth() + 1; // Mês 0-indexed
        const day = originalDate.getDate();
        
        // Criar nova data para o ano especificado
        const newDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        
        // Verificar se já existe
        const existingResult = await db.query(
          'SELECT id FROM holidays WHERE date = $1',
          [newDate]
        );
        
        if (existingResult.rows.length > 0) {
          skipped++;
          continue;
        }
        
        // Criar novo feriado
        await db.query(`
          INSERT INTO holidays (
            date, name, type, recurring, year, active, created_at, created_by
          ) VALUES ($1, $2, $3, 0, $4, true, NOW(), $5)
        `, [
          newDate,
          holiday.name,
          holiday.type,
          year,
          user.id
        ]);
        
        created++;
        
      } catch (err) {
        console.error(`Error generating holiday ${holiday.id} for year ${year}:`, err);
        skipped++;
      }
    }
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      user.id,
      'holiday',
      null,
      'generate_year',
      JSON.stringify({ year, created, skipped, total_recurring: recurringHolidays.length }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({
      message: `Geração de feriados para ${year} concluída`,
      created,
      skipped,
      total_recurring: recurringHolidays.length
    });
    
  } catch (error: any) {
    console.error('Error generating holidays for year:', error);
    return c.json({ error: 'Erro ao gerar feriados', details: error.message }, 500);
  }
});

export default holidays;