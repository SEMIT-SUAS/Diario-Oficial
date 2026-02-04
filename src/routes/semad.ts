// ====================================
// DOM - SEMAD (Análise e Aprovação) Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext, Matter } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { generateMatterSignature } from '../utils/auth';
import db from '../lib/db'; // Importe a conexão PostgreSQL

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
      WHERE m.status IN ('submitted', 'under_review')
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
      WHERE m.status IN ('approved', 'scheduled')
      ORDER BY m.approved_at DESC
      LIMIT 50
    `);
    
    return c.json({ matters: result.rows });
    
  } catch (error: any) {
    console.error('List approved matters error:', error);
    return c.json({ error: 'Erro ao listar matérias aprovadas', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/review
 * Inicia análise de uma matéria
 */
semad.post('/:id/review', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    
    const result = await db.query(
      'SELECT * FROM matters WHERE id = $1',
      [id]
    );
    
    const matter = result.rows[0];
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não está aguardando análise' }, 400);
    }
    
    await db.query(`
      UPDATE matters 
      SET status = 'under_review', reviewer_id = $1, reviewed_at = NOW(), updated_at = NOW()
      WHERE id = $2
    `, [user.id, id]);
    
    return c.json({ message: 'Análise iniciada com sucesso' });
    
  } catch (error: any) {
    console.error('Start review error:', error);
    return c.json({ error: 'Erro ao iniciar análise', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/approve
 * Aprova matéria
 */
semad.post('/:id/approve', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));
    const { review_notes, scheduled_date } = await c.req.json();
    
    const result = await db.query(
      'SELECT * FROM matters WHERE id = $1',
      [id]
    );
    
    const matter = result.rows[0];
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'under_review' && matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não pode ser aprovada neste status' }, 400);
    }
    
    // Gerar assinatura eletrônica
    const timestamp = new Date().toISOString();
    const signature = await generateMatterSignature(
      matter.id,
      user.id,
      matter.content,
      timestamp
    );
    
    // Determinar novo status
    const newStatus = scheduled_date ? 'scheduled' : 'approved';
    
    await db.query(`
      UPDATE matters 
      SET 
        status = $1,
        reviewer_id = $2,
        review_notes = $3,
        approved_at = NOW(),
        scheduled_date = $4,
        signature_hash = $5,
        signature_type = 'eletronica',
        signed_by = $6,
        signed_at = $7,
        updated_at = NOW()
      WHERE id = $8
    `, [
      newStatus,
      user.id,
      review_notes || null,
      scheduled_date || null,
      signature,
      user.id,
      timestamp,
      id
    ]);
    
    // Criar notificação para o autor
    await db.query(`
      INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
      VALUES ($1, $2, 'matter_approved', $3, $4, NOW())
    `, [
      matter.author_id,
      id,
      'Matéria aprovada',
      `Sua matéria "${matter.title}" foi aprovada pela SEMAD`
    ]);
    
    // Registro de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      user.id,
      'matter',
      id,
      'approve',
      JSON.stringify({ status: newStatus, review_notes, scheduled_date, signature }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ 
      message: 'Matéria aprovada com sucesso',
      signature: signature,
      status: newStatus
    });
    
  } catch (error: any) {
    console.error('Approve matter error:', error);
    return c.json({ error: 'Erro ao aprovar matéria', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/reject
 * Rejeita matéria e devolve para secretaria
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
    
    if (matter.status !== 'under_review' && matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não pode ser rejeitada neste status' }, 400);
    }
    
    await db.query(`
      UPDATE matters 
      SET 
        status = 'rejected',
        reviewer_id = $1,
        rejection_reason = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
    `, [user.id, rejection_reason, id]);
    
    // Criar notificação para o autor
    await db.query(`
      INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
      VALUES ($1, $2, 'matter_rejected', $3, $4, NOW())
    `, [
      matter.author_id,
      id,
      'Matéria rejeitada',
      `Sua matéria "${matter.title}" foi rejeitada pela SEMAD. Motivo: ${rejection_reason}`
    ]);
    
    // Registro de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      user.id,
      'matter',
      id,
      'reject',
      JSON.stringify({ rejection_reason }),
      ipAddress,
      userAgent
    ]);
    
    return c.json({ message: 'Matéria rejeitada com sucesso' });
    
  } catch (error: any) {
    console.error('Reject matter error:', error);
    return c.json({ error: 'Erro ao rejeitar matéria', details: error.message }, 500);
  }
});

/**
 * POST /api/semad/:id/comment
 * Adiciona comentário/observação à matéria
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
    
    const commentResult = await db.query(`
      INSERT INTO comments (matter_id, user_id, comment, is_internal, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `, [id, user.id, comment, is_internal]);
    
    // Criar notificação se comentário for externo
    if (!is_internal) {
      const matterResult = await db.query(
        'SELECT author_id, title FROM matters WHERE id = $1',
        [id]
      );
      
      const matter = matterResult.rows[0];
      
      if (matter) {
        await db.query(`
          INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
          VALUES ($1, $2, 'comment_added', $3, $4, NOW())
        `, [
          matter.author_id,
          id,
          'Novo comentário na matéria',
          `A matéria "${matter.title}" recebeu um novo comentário da SEMAD`
        ]);
      }
    }
    
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
 * Lista comentários de uma matéria
 */
semad.get('/comments/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const result = await db.query(`
      SELECT 
        c.*,
        u.name as user_name,
        u.role as user_role,
        s.acronym as secretaria_acronym
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN secretarias s ON u.secretaria_id = s.id
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
 * Dashboard com estatísticas da SEMAD
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
      WHERE status IN ('submitted', 'under_review')
    `);
    
    // Matérias aprovadas hoje
    const approvedTodayResult = await db.query(`
      SELECT COUNT(*) as count
      FROM matters
      WHERE status = 'approved' 
      AND DATE(approved_at) = CURRENT_DATE
    `);
    
    // Matérias rejeitadas hoje
    const rejectedTodayResult = await db.query(`
      SELECT COUNT(*) as count
      FROM matters
      WHERE status = 'rejected' 
      AND DATE(reviewed_at) = CURRENT_DATE
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
      WHERE m.status IN ('submitted', 'under_review')
      ORDER BY m.submitted_at ASC
      LIMIT 5
    `);
    
    // Atividades recentes da SEMAD
    const recentActivityResult = await db.query(`
      SELECT 
        al.*,
        u.name as user_name
      FROM audit_logs al
      JOIN users u ON al.user_id = u.id
      WHERE u.role IN ('semad', 'admin')
        AND al.entity_type = 'matter'
      ORDER BY al.created_at DESC
      LIMIT 10
    `);
    
    return c.json({
      status_stats: statusStatsResult.rows,
      pending_count: parseInt(pendingResult.rows[0]?.count || '0'),
      approved_today: parseInt(approvedTodayResult.rows[0]?.count || '0'),
      rejected_today: parseInt(rejectedTodayResult.rows[0]?.count || '0'),
      by_secretaria: bySecretariaResult.rows,
      oldest_pending: oldestPendingResult.rows,
      recent_activity: recentActivityResult.rows
    });
    
  } catch (error: any) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Erro ao buscar estatísticas', details: error.message }, 500);
  }
});

/**
 * GET /api/semad/analytics
 * Estatísticas detalhadas para relatórios
 */
semad.get('/analytics', async (c) => {
  try {
    const period = c.req.query('period') || 'month'; // day, week, month, year
    
    // Definir intervalo baseado no período
    let dateFilter = '';
    switch (period) {
      case 'day':
        dateFilter = "CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "CURRENT_DATE - INTERVAL '365 days'";
        break;
      default:
        dateFilter = "CURRENT_DATE - INTERVAL '30 days'";
    }
    
    // Estatísticas por período
    const periodStatsResult = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status IN ('submitted', 'under_review') THEN 1 END) as pending,
        AVG(EXTRACT(EPOCH FROM (reviewed_at - submitted_at)) / 3600) as avg_review_time_hours
      FROM matters
      WHERE submitted_at >= $1
    `, [dateFilter]);
    
    // Tendência de submissões por dia
    const trendResult = await db.query(`
      SELECT 
        DATE(submitted_at) as date,
        COUNT(*) as submissions,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected
      FROM matters
      WHERE submitted_at >= $1
      GROUP BY DATE(submitted_at)
      ORDER BY date DESC
      LIMIT 30
    `, [dateFilter]);
    
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
      WHERE m.submitted_at >= $1
      GROUP BY s.id, s.acronym, s.name
      HAVING COUNT(m.id) > 0
      ORDER BY approval_rate DESC
    `, [dateFilter]);
    
    return c.json({
      period: period,
      stats: periodStatsResult.rows[0],
      trend: trendResult.rows,
      approval_rates: approvalRateResult.rows
    });
    
  } catch (error: any) {
    console.error('Analytics error:', error);
    return c.json({ error: 'Erro ao buscar análises', details: error.message }, 500);
  }
});

export default semad;