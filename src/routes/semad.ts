// ====================================
// DOM - SEMAD (Análise e Aprovação) Routes - VERSÃO CORRIGIDA
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db';

const semad = new Hono<HonoContext>();

// Aplicar autenticação e verificar role SEMAD
semad.use('/*', authMiddleware);
semad.use('/*', requireRole('semad', 'admin'));

/**
 * GET /api/semad/pending
 * Lista matérias pendentes de análise
 */
semad.get('/pending', async (c) => {
  try {
    const result = await db.query(`
      SELECT 
        m.*,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        c.name as category_name,
        u.name as author_name,
        mt.name as matter_type_name
      FROM matters m
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN categories c ON m.category_id = c.id
      LEFT JOIN users u ON m.author_id = u.id
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      WHERE m.status = 'submitted'
      ORDER BY m.submitted_at ASC
    `);
    
    return c.json({ matters: result.rows });
    
  } catch (error: any) {
    console.error('List pending matters error:', error);
    return c.json({ error: 'Erro ao listar matérias pendentes', details: error.message }, 500);
  }
});

/**
 * GET /api/semad/approved
 * Lista matérias já aprovadas
 */
semad.get('/approved', async (c) => {
  try {
    const result = await db.query(`
      SELECT 
        m.*,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        u.name as author_name,
        mt.name as matter_type_name
      FROM matters m
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      WHERE m.status = 'approved'
      ORDER BY m.updated_at DESC
      LIMIT 50
    `);
    
    return c.json({ matters: result.rows });
    
  } catch (error: any) {
    console.error('List approved matters error:', error);
    return c.json({ error: 'Erro ao listar matérias aprovadas', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/approve
 * Aprova matéria - VERSÃO SIMPLIFICADA
 */
semad.post('/:id/approve', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { review_notes } = await c.req.json();
    
    const result = await db.query(
      'SELECT * FROM matters WHERE id = $1',
      [id]
    );
    
    const matter = result.rows[0];
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não pode ser aprovada neste status' }, 400);
    }
    
    // Primeiro, verificar quais colunas existem
    const tableInfo = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'matters'
    `);
    
    const columns = tableInfo.rows.map(row => row.column_name);
    console.log('📋 Colunas disponíveis na tabela matters:', columns);
    
    // Montar query dinamicamente
    let updateQuery = `UPDATE matters SET status = 'approved'`;
    const queryParams: any[] = [];
    let paramCount = 1;
    
    // Adicionar reviewer_id se a coluna existir
    if (columns.includes('reviewer_id')) {
      updateQuery += `, reviewer_id = $${paramCount}`;
      queryParams.push(user.id);
      paramCount++;
    }
    
    // Adicionar review_notes se a coluna existir
    if (columns.includes('review_notes') && review_notes) {
      updateQuery += `, review_notes = $${paramCount}`;
      queryParams.push(review_notes);
      paramCount++;
    }
    
    // Adicionar approved_at se a coluna existir
    if (columns.includes('approved_at')) {
      updateQuery += `, approved_at = NOW()`;
    }
    
    // Sempre atualizar updated_at
    updateQuery += `, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    queryParams.push(id);
    
    console.log('📝 Query de aprovação:', updateQuery);
    console.log('🔢 Parâmetros:', queryParams);
    
    const updateResult = await db.query(updateQuery, queryParams);
    
    // Tentar criar notificação para o autor (se a tabela notifications existir)
    try {
      await db.query(`
        INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
        VALUES ($1, $2, 'matter_approved', $3, $4, NOW())
      `, [
        matter.author_id,
        id,
        'Matéria aprovada',
        `Sua matéria "${matter.title}" foi aprovada pela SEMAD`
      ]);
    } catch (notifError) {
      console.log('⚠️ Não foi possível criar notificação:', notifError.message);
    }
    
    return c.json({ 
      message: 'Matéria aprovada com sucesso',
      status: 'approved'
    });
    
  } catch (error: any) {
    console.error('Approve matter error:', error);
    return c.json({ error: 'Erro ao aprovar matéria', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/reject
 * Rejeita matéria - VERSÃO SIMPLIFICADA
 */
semad.post('/:id/reject', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { rejection_reason } = await c.req.json();
    
    if (!rejection_reason) {
      return c.json({ error: 'Motivo da rejeição é obrigatório' }, 400);
    }
    
    const result = await db.query(
      'SELECT * FROM matters WHERE id = $1',
      [id]
    );
    
    const matter = result.rows[0];
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não pode ser rejeitada neste status' }, 400);
    }
    
    // Primeiro, verificar quais colunas existem
    const tableInfo = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'matters'
    `);
    
    const columns = tableInfo.rows.map(row => row.column_name);
    console.log('📋 Colunas disponíveis na tabela matters:', columns);
    
    // Montar query dinamicamente
    let updateQuery = `UPDATE matters SET status = 'rejected'`;
    const queryParams: any[] = [];
    let paramCount = 1;
    
    // Adicionar reviewer_id se a coluna existir
    if (columns.includes('reviewer_id')) {
      updateQuery += `, reviewer_id = $${paramCount}`;
      queryParams.push(user.id);
      paramCount++;
    }
    
    // Adicionar rejection_reason se a coluna existir
    if (columns.includes('rejection_reason')) {
      updateQuery += `, rejection_reason = $${paramCount}`;
      queryParams.push(rejection_reason);
      paramCount++;
    }
    
    // Adicionar reviewed_at se a coluna existir
    if (columns.includes('reviewed_at')) {
      updateQuery += `, reviewed_at = NOW()`;
    }
    
    // Sempre atualizar updated_at
    updateQuery += `, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    queryParams.push(id);
    
    console.log('📝 Query de rejeição:', updateQuery);
    console.log('🔢 Parâmetros:', queryParams);
    
    await db.query(updateQuery, queryParams);
    
    // Tentar criar notificação para o autor (se a tabela notifications existir)
    try {
      await db.query(`
        INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
        VALUES ($1, $2, 'matter_rejected', $3, $4, NOW())
      `, [
        matter.author_id,
        id,
        'Matéria rejeitada',
        `Sua matéria "${matter.title}" foi rejeitada pela SEMAD. Motivo: ${rejection_reason}`
      ]);
    } catch (notifError) {
      console.log('⚠️ Não foi possível criar notificação:', notifError.message);
    }
    
    return c.json({ message: 'Matéria rejeitada com sucesso' });
    
  } catch (error: any) {
    console.error('Reject matter error:', error);
    return c.json({ error: 'Erro ao rejeitar matéria', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/comment
 * Adiciona comentário/observação à matéria - VERSÃO SIMPLIFICADA
 */
semad.post('/:id/comment', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { comment, is_internal = true } = await c.req.json();
    
    if (!comment) {
      return c.json({ error: 'Comentário é obrigatório' }, 400);
    }
    
    // Verificar se a tabela comments existe
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'comments'
      );
    `);
    
    if (!tableExists.rows[0]?.exists) {
      return c.json({ error: 'Funcionalidade de comentários não disponível' }, 501);
    }
    
    const commentResult = await db.query(`
      INSERT INTO comments (matter_id, user_id, comment, is_internal, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [id, user.id, comment, is_internal]);
    
    return c.json({ 
      message: 'Comentário adicionado com sucesso',
      commentId: commentResult.rows[0].id
    });
    
  } catch (error: any) {
    console.error('Add comment error:', error);
    return c.json({ error: 'Erro ao adicionar comentário', details: error.message }, 500);
  }
});

/**
 * GET /api/semad/comments/:id
 * Lista comentários de uma matéria - VERSÃO SIMPLIFICADA
 */
semad.get('/comments/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    // Verificar se a tabela comments existe
    const tableExists = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'comments'
      );
    `);
    
    if (!tableExists.rows[0]?.exists) {
      return c.json({ comments: [] });
    }
    
    const result = await db.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.role as user_role
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.matter_id = $1
      ORDER BY c.created_at DESC
    `, [id]);
    
    return c.json({ comments: result.rows });
    
  } catch (error: any) {
    console.error('Get comments error:', error);
    return c.json({ error: 'Erro ao buscar comentários', details: error.message }, 500);
  }
});

/**
 * GET /api/semad/dashboard
 * Dashboard com estatísticas da SEMAD - VERSÃO SIMPLIFICADA
 */
semad.get('/dashboard', async (c) => {
  try {
    // Total de matérias por status
    const statusStatsResult = await db.query(`
      SELECT status, COUNT(*) as count
      FROM matters
      GROUP BY status
      ORDER BY status
    `);
    
    // Matérias pendentes de análise
    const pendingResult = await db.query(`
      SELECT COUNT(*) as count
      FROM matters
      WHERE status = 'submitted'
    `);
    
    // Matérias aprovadas recentemente
    const approvedRecentResult = await db.query(`
      SELECT COUNT(*) as count
      FROM matters
      WHERE status = 'approved' 
      AND updated_at >= NOW() - INTERVAL '7 days'
    `);
    
    // Matérias rejeitadas recentemente
    const rejectedRecentResult = await db.query(`
      SELECT COUNT(*) as count
      FROM matters
      WHERE status = 'rejected' 
      AND updated_at >= NOW() - INTERVAL '7 days'
    `);
    
    // Matérias por secretaria (top 10)
    const bySecretariaResult = await db.query(`
      SELECT 
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        COUNT(m.id) as count
      FROM matters m
      JOIN secretarias s ON m.secretaria_id = s.id
      GROUP BY s.id, s.name, s.acronym
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Matérias aguardando análise há mais tempo
    const oldestPendingResult = await db.query(`
      SELECT 
        m.id,
        m.title,
        m.submitted_at,
        s.acronym as secretaria_acronym,
        u.name as author_name
      FROM matters m
      JOIN secretarias s ON m.secretaria_id = s.id
      JOIN users u ON m.author_id = u.id
      WHERE m.status = 'submitted'
      ORDER BY m.submitted_at ASC
      LIMIT 5
    `);
    
    return c.json({
      status_stats: statusStatsResult.rows,
      pending_count: parseInt(pendingResult.rows[0]?.count || '0'),
      approved_recent: parseInt(approvedRecentResult.rows[0]?.count || '0'),
      rejected_recent: parseInt(rejectedRecentResult.rows[0]?.count || '0'),
      by_secretaria: bySecretariaResult.rows,
      oldest_pending: oldestPendingResult.rows
    });
    
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Erro ao buscar estatísticas', details: error.message }, 500);
  }
});

/**
 * GET /api/semad/analytics
 * Estatísticas detalhadas para relatórios - VERSÃO SIMPLIFICADA
 */
semad.get('/analytics', async (c) => {
  try {
    const period = c.req.query('period') || 'month'; // day, week, month, year
    
    // Definir intervalo baseado no período
    let interval = '30 days';
    switch (period) {
      case 'day':
        interval = '1 day';
        break;
      case 'week':
        interval = '7 days';
        break;
      case 'month':
        interval = '30 days';
        break;
      case 'year':
        interval = '365 days';
        break;
    }
    
    // Estatísticas por período
    const periodStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) as pending
      FROM matters
      WHERE created_at >= NOW() - INTERVAL '${interval}'
    `);
    
    // Tendência de submissões por dia
    const trendResult = await db.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as submissions,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM matters
      WHERE created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `);
    
    // Taxa de aprovação por secretaria
    const approvalRateResult = await db.query(`
      SELECT 
        s.acronym,
        s.name,
        COUNT(m.id) as total,
        COUNT(CASE WHEN m.status = 'approved' THEN 1 END) as approved,
        ROUND(COUNT(CASE WHEN m.status = 'approved' THEN 1 END) * 100.0 / NULLIF(COUNT(m.id), 0), 2) as approval_rate
      FROM matters m
      JOIN secretarias s ON m.secretaria_id = s.id
      WHERE m.created_at >= NOW() - INTERVAL '${interval}'
      GROUP BY s.id, s.acronym, s.name
      HAVING COUNT(m.id) > 0
      ORDER BY approval_rate DESC
    `);
    
    return c.json({
      period: period,
      stats: periodStatsResult.rows[0] || { total: 0, approved: 0, rejected: 0, pending: 0 },
      trend: trendResult.rows,
      approval_rates: approvalRateResult.rows
    });
    
  } catch (error: any) {
    console.error('Analytics error:', error);
    return c.json({ error: 'Erro ao buscar análises', details: error.message }, 500);
  }
});

export default semad;