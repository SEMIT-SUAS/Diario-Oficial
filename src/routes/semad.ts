// ====================================
// DOM - SEMAD (Análise e Aprovação) Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext, Matter } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { generateMatterSignature } from '../utils/auth';

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
    const result = await c.env.DB
      .prepare(`
        SELECT 
          m.*,
          s.name as secretaria_name,
          s.acronym as secretaria_acronym,
          c.name as category_name,
          u.name as author_name
        FROM matters m
        LEFT JOIN secretarias s ON m.secretaria_id = s.id
        LEFT JOIN categories c ON m.category_id = c.id
        LEFT JOIN users u ON m.author_id = u.id
        WHERE m.status IN ('submitted', 'under_review')
        ORDER BY m.submitted_at ASC
      `)
      .all();
    
    return c.json({ matters: result.results });
    
  } catch (error) {
    console.error('List pending matters error:', error);
    return c.json({ error: 'Erro ao listar matérias pendentes' }, 500);
  }
});

/**
 * POST /api/semad/:id/review
 * Inicia análise de uma matéria
 */
semad.post('/:id/review', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    
    const matter = await c.env.DB
      .prepare('SELECT * FROM matters WHERE id = ?')
      .bind(id)
      .first<Matter>();
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não está aguardando análise' }, 400);
    }
    
    await c.env.DB
      .prepare(`
        UPDATE matters 
        SET status = 'under_review', reviewer_id = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(user.id, id)
      .run();
    
    return c.json({ message: 'Análise iniciada com sucesso' });
    
  } catch (error) {
    console.error('Start review error:', error);
    return c.json({ error: 'Erro ao iniciar análise' }, 500);
  }
});

/**
 * POST /api/semad/:id/approve
 * Aprova matéria
 */
semad.post('/:id/approve', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { review_notes, scheduled_date, signature_password } = await c.req.json();
    
    const matter = await c.env.DB
      .prepare('SELECT * FROM matters WHERE id = ?')
      .bind(id)
      .first<Matter>();
    
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
    
    await c.env.DB
      .prepare(`
        UPDATE matters 
        SET 
          status = ?,
          reviewer_id = ?,
          review_notes = ?,
          approved_at = datetime('now'),
          scheduled_date = ?,
          signature_hash = ?,
          signature_type = 'eletronica',
          signed_by = ?,
          signed_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(
        newStatus,
        user.id,
        review_notes || null,
        scheduled_date || null,
        signature,
        user.id,
        timestamp,
        id
      )
      .run();
    
    // Criar notificação para o autor
    await c.env.DB
      .prepare(`
        INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
        VALUES (?, ?, 'matter_approved', ?, ?, datetime('now'))
      `)
      .bind(
        matter.author_id,
        id,
        'Matéria aprovada',
        `Sua matéria "${matter.title}" foi aprovada pela SEMAD`
      )
      .run();
    
    return c.json({ 
      message: 'Matéria aprovada com sucesso',
      signature: signature,
      status: newStatus
    });
    
  } catch (error) {
    console.error('Approve matter error:', error);
    return c.json({ error: 'Erro ao aprovar matéria' }, 500);
  }
});

/**
 * POST /api/semad/:id/reject
 * Rejeita matéria e devolve para secretaria
 */
semad.post('/:id/reject', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { rejection_reason } = await c.req.json();
    
    if (!rejection_reason) {
      return c.json({ error: 'Motivo da rejeição é obrigatório' }, 400);
    }
    
    const matter = await c.env.DB
      .prepare('SELECT * FROM matters WHERE id = ?')
      .bind(id)
      .first<Matter>();
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'under_review' && matter.status !== 'submitted') {
      return c.json({ error: 'Matéria não pode ser rejeitada neste status' }, 400);
    }
    
    await c.env.DB
      .prepare(`
        UPDATE matters 
        SET 
          status = 'rejected',
          reviewer_id = ?,
          rejection_reason = ?,
          reviewed_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(user.id, rejection_reason, id)
      .run();
    
    // Criar notificação para o autor
    await c.env.DB
      .prepare(`
        INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
        VALUES (?, ?, 'matter_rejected', ?, ?, datetime('now'))
      `)
      .bind(
        matter.author_id,
        id,
        'Matéria rejeitada',
        `Sua matéria "${matter.title}" foi rejeitada pela SEMAD. Motivo: ${rejection_reason}`
      )
      .run();
    
    return c.json({ message: 'Matéria rejeitada com sucesso' });
    
  } catch (error) {
    console.error('Reject matter error:', error);
    return c.json({ error: 'Erro ao rejeitar matéria' }, 500);
  }
});

/**
 * POST /api/semad/:id/comment
 * Adiciona comentário/observação à matéria
 */
semad.post('/:id/comment', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { comment, is_internal = true } = await c.req.json();
    
    if (!comment) {
      return c.json({ error: 'Comentário é obrigatório' }, 400);
    }
    
    await c.env.DB
      .prepare(`
        INSERT INTO comments (matter_id, user_id, comment, is_internal, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `)
      .bind(id, user.id, comment, is_internal ? 1 : 0)
      .run();
    
    return c.json({ message: 'Comentário adicionado com sucesso' });
    
  } catch (error) {
    console.error('Add comment error:', error);
    return c.json({ error: 'Erro ao adicionar comentário' }, 500);
  }
});

/**
 * GET /api/semad/dashboard
 * Dashboard com estatísticas da SEMAD
 */
semad.get('/dashboard', async (c) => {
  try {
    // Total de matérias por status
    const statusStats = await c.env.DB
      .prepare(`
        SELECT status, COUNT(*) as count
        FROM matters
        GROUP BY status
      `)
      .all();
    
    // Matérias pendentes de análise
    const pendingCount = await c.env.DB
      .prepare(`
        SELECT COUNT(*) as count
        FROM matters
        WHERE status IN ('submitted', 'under_review')
      `)
      .first<{ count: number }>();
    
    // Matérias aprovadas hoje
    const approvedToday = await c.env.DB
      .prepare(`
        SELECT COUNT(*) as count
        FROM matters
        WHERE status = 'approved' AND DATE(approved_at) = DATE('now')
      `)
      .first<{ count: number }>();
    
    // Matérias por secretaria
    const bySecretaria = await c.env.DB
      .prepare(`
        SELECT 
          s.name as secretaria_name,
          s.acronym as secretaria_acronym,
          COUNT(m.id) as count
        FROM matters m
        JOIN secretarias s ON m.secretaria_id = s.id
        GROUP BY s.id, s.name, s.acronym
        ORDER BY count DESC
      `)
      .all();
    
    return c.json({
      statusStats: statusStats.results,
      pendingCount: pendingCount?.count || 0,
      approvedToday: approvedToday?.count || 0,
      bySecretaria: bySecretaria.results
    });
    
  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json({ error: 'Erro ao buscar estatísticas' }, 500);
  }
});

export default semad;
