// ====================================
// DOM - Secretarias Routes
// CRUD Completo de Secretarias
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db'; // Importe a conexão PostgreSQL

const secretarias = new Hono<HonoContext>();

/**
 * GET /api/secretarias
 * Lista todas as secretarias (PÚBLICO - usado para filtros no frontend)
 * Deve vir ANTES do middleware de autenticação
 */
secretarias.get('/', async (c) => {
  try {
    // Apenas informações básicas para público
    const result = await db.query(`
      SELECT 
        s.id,
        s.name,
        s.acronym,
        s.active
      FROM secretarias s
      WHERE s.active = true
      ORDER BY s.name ASC
    `);
    
    return c.json({ secretarias: result.rows });
    
  } catch (error: any) {
    console.error('Error fetching secretarias:', error);
    return c.json({ error: 'Erro ao buscar secretarias', details: error.message }, 500);
  }
});

/**
 * GET /api/secretarias/all
 * Lista todas as secretarias com informações completas (apenas admin)
 * Esta rota precisa de autenticação
 */
secretarias.get('/all', authMiddleware, requireRole('admin', 'semad'), async (c) => {
  try {
    const result = await db.query(`
      SELECT s.* FROM secretarias s
      ORDER BY s.name ASC
    `);
    
    return c.json({ secretarias: result.rows });
    
  } catch (error: any) {
    console.error('Error fetching all secretarias:', error);
    return c.json({ error: 'Erro ao buscar secretarias', details: error.message }, 500);
  }
});

// Aplicar autenticação em TODAS as outras rotas de secretarias
secretarias.use('/*', authMiddleware);

/**
 * GET /api/secretarias/:id
 * Busca uma secretaria específica
 */
secretarias.get('/:id', requireRole('admin', 'semad'), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const result = await db.query(
      'SELECT s.* FROM secretarias s WHERE s.id = $1',
      [id]
    );
    
    const secretaria = result.rows[0];
    
    if (!secretaria) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Buscar usuários da secretaria
    const usersResult = await db.query(`
      SELECT id, name, email, role, active FROM users 
      WHERE secretaria_id = $1
      ORDER BY name ASC
    `, [id]);
    
    // Contar matérias da secretaria
    const mattersResult = await db.query(`
      SELECT 
        COUNT(*) as total_matters,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published_matters,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft_matters,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_matters
      FROM matters
      WHERE secretaria_id = $1
    `, [id]);
    
    return c.json({ 
      secretaria,
      users: usersResult.rows,
      stats: mattersResult.rows[0]
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { name, acronym, email, phone, responsible } = await c.req.json();
    
    if (!name || !acronym) {
      return c.json({ error: 'Nome e sigla são obrigatórios' }, 400);
    }
    
    // Verificar se sigla já existe
    const existingResult = await db.query(
      'SELECT id FROM secretarias WHERE acronym = $1',
      [acronym.toUpperCase()]
    );
    
    if (existingResult.rows.length > 0) {
      return c.json({ error: 'Sigla já está em uso' }, 400);
    }
    
    const result = await db.query(`
      INSERT INTO secretarias (
        name, acronym, email, phone, responsible,
        active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
      RETURNING id
    `, [
      name,
      acronym.toUpperCase(),
      email || null,
      phone || null,
      responsible || null
    ]);
    
    const secretariaId = result.rows[0].id;
    
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
      'secretaria',
      secretariaId,
      'create',
      JSON.stringify({ name, acronym }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ 
      message: 'Secretaria criada com sucesso',
      id: secretariaId
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { name, acronym, email, phone, responsible, active } = await c.req.json();
    
    // Verificar se existe
    const existingResult = await db.query(
      'SELECT * FROM secretarias WHERE id = $1',
      [id]
    );
    
    const existing = existingResult.rows[0];
    
    if (!existing) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Verificar se sigla está disponível
    if (acronym && acronym !== existing.acronym) {
      const acronymExistsResult = await db.query(
        'SELECT id FROM secretarias WHERE acronym = $1 AND id != $2',
        [acronym.toUpperCase(), id]
      );
      
      if (acronymExistsResult.rows.length > 0) {
        return c.json({ error: 'Sigla já está em uso' }, 400);
      }
    }
    
    await db.query(`
      UPDATE secretarias 
      SET name = $1,
          acronym = $2,
          email = $3,
          phone = $4,
          responsible = $5,
          active = $6,
          updated_at = NOW()
      WHERE id = $7
    `, [
      name || existing.name,
      acronym ? acronym.toUpperCase() : existing.acronym,
      email !== undefined ? email : existing.email,
      phone !== undefined ? phone : existing.phone,
      responsible !== undefined ? responsible : existing.responsible,
      active !== undefined ? active : existing.active,
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
      'secretaria',
      id,
      'update',
      JSON.stringify(existing),
      JSON.stringify({ name, acronym, email, phone, responsible, active }),
      ipAddress,
      userAgent
    ]);
    
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    
    // Verificar se existe
    const secretariaResult = await db.query(
      'SELECT * FROM secretarias WHERE id = $1',
      [id]
    );
    
    const secretaria = secretariaResult.rows[0];
    
    if (!secretaria) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Verificar se tem usuários ou matérias
    const usageResult = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE secretaria_id = $1) as total_users,
        (SELECT COUNT(*) FROM matters WHERE secretaria_id = $1) as total_matters
    `, [id]);
    
    const usage = usageResult.rows[0];
    const hasUsage = usage && (parseInt(usage.total_users) > 0 || parseInt(usage.total_matters) > 0);
    
    // Audit log - registrar antes da operação
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    if (hasUsage) {
      // Soft delete - apenas desativa
      await db.query(
        'UPDATE secretarias SET active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );
      
      await db.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action,
          old_values, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        user.id,
        'secretaria',
        id,
        'deactivate',
        JSON.stringify(secretaria),
        ipAddress,
        userAgent
      ]);
      
      return c.json({ 
        message: 'Secretaria desativada (possui usuários ou matérias vinculadas)',
        soft_delete: true,
        stats: {
          users: parseInt(usage.total_users),
          matters: parseInt(usage.total_matters)
        }
      });
    } else {
      // Hard delete - remove completamente
      await db.query('DELETE FROM secretarias WHERE id = $1', [id]);
      
      await db.query(`
        INSERT INTO audit_logs (
          user_id, entity_type, entity_id, action,
          old_values, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        user.id,
        'secretaria',
        id,
        'delete',
        JSON.stringify(secretaria),
        ipAddress,
        userAgent
      ]);
      
      return c.json({ 
        message: 'Secretaria removida com sucesso',
        soft_delete: false
      });
    }
    
  } catch (error: any) {
    console.error('Error deleting secretaria:', error);
    return c.json({ error: 'Erro ao deletar secretaria', details: error.message }, 500);
  }
});

/**
 * GET /api/secretarias/:id/stats
 * Estatísticas detalhadas de uma secretaria
 */
secretarias.get('/:id/stats', requireRole('admin', 'semad'), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    // Verificar se secretaria existe
    const secretariaResult = await db.query(
      'SELECT id, name, acronym FROM secretarias WHERE id = $1',
      [id]
    );
    
    if (secretariaResult.rows.length === 0) {
      return c.json({ error: 'Secretaria não encontrada' }, 404);
    }
    
    // Estatísticas de matérias
    const mattersStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'published' THEN 1 END) as published,
        COUNT(CASE WHEN status = 'draft' THEN 1 END) as draft,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
        COUNT(CASE WHEN priority = 'normal' THEN 1 END) as normal,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low
      FROM matters
      WHERE secretaria_id = $1
    `, [id]);
    
    // Estatísticas de usuários
    const usersStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
        COUNT(CASE WHEN role = 'semad' THEN 1 END) as semad,
        COUNT(CASE WHEN role = 'secretaria' THEN 1 END) as secretaria_users,
        COUNT(CASE WHEN role = 'publico' THEN 1 END) as publico,
        COUNT(CASE WHEN active = true THEN 1 END) as active,
        COUNT(CASE WHEN active = false THEN 1 END) as inactive
      FROM users
      WHERE secretaria_id = $1
    `, [id]);
    
    // Matérias por tipo
    const mattersByTypeResult = await db.query(`
      SELECT 
        mt.name as type_name,
        COUNT(m.id) as count
      FROM matters m
      JOIN matter_types mt ON m.matter_type_id = mt.id
      WHERE m.secretaria_id = $1
      GROUP BY mt.id, mt.name
      ORDER BY count DESC
    `, [id]);
    
    // Matérias por mês (últimos 6 meses)
    const mattersByMonthResult = await db.query(`
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        COUNT(*) as count
      FROM matters
      WHERE secretaria_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month DESC
    `, [id]);
    
    return c.json({
      secretaria: secretariaResult.rows[0],
      matters: mattersStatsResult.rows[0],
      users: usersStatsResult.rows[0],
      by_type: mattersByTypeResult.rows,
      by_month: mattersByMonthResult.rows
    });
    
  } catch (error: any) {
    console.error('Error fetching secretaria stats:', error);
    return c.json({ error: 'Erro ao buscar estatísticas', details: error.message }, 500);
  }
});

export default secretarias;