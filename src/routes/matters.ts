// ====================================
// DOM - Matters (Matérias) Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext, Matter, MatterStatus } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { generateMatterSignature } from '../utils/auth';
import { getCurrentTimestamp } from '../utils/date';

const matters = new Hono<HonoContext>();

// Aplicar autenticação em todas as rotas
matters.use('/*', authMiddleware);

/**
 * GET /api/matters
 * Lista matérias com filtros
 */
matters.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { status, secretaria_id, category_id, search, page = '1', limit = '20' } = c.req.query();
    
    let query = `
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
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    // Filtro por role do usuário
    if (user.role === 'secretaria') {
      query += ` AND m.secretaria_id = ?`;
      params.push(user.secretaria_id);
    }
    
    // Filtros opcionais
    if (status) {
      query += ` AND m.status = ?`;
      params.push(status);
    }
    
    if (secretaria_id) {
      query += ` AND m.secretaria_id = ?`;
      params.push(secretaria_id);
    }
    
    if (category_id) {
      query += ` AND m.category_id = ?`;
      params.push(category_id);
    }
    
    if (search) {
      query += ` AND (m.title LIKE ? OR m.content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ` ORDER BY m.created_at DESC`;
    
    // Paginação
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    const stmt = c.env.DB.prepare(query);
    const result = await stmt.bind(...params).all();
    
    // Contar total
    let countQuery = `SELECT COUNT(*) as total FROM matters m WHERE 1=1`;
    const countParams: any[] = [];
    
    if (user.role === 'secretaria') {
      countQuery += ` AND m.secretaria_id = ?`;
      countParams.push(user.secretaria_id);
    }
    
    if (status) {
      countQuery += ` AND m.status = ?`;
      countParams.push(status);
    }
    
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>();
    
    return c.json({
      matters: result.results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult?.total || 0,
        totalPages: Math.ceil((countResult?.total || 0) / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error('List matters error:', error);
    return c.json({ error: 'Erro ao listar matérias' }, 500);
  }
});

/**
 * GET /api/matters/:id
 * Busca matéria por ID
 */
matters.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    
    const matter = await c.env.DB
      .prepare(`
        SELECT 
          m.*,
          s.name as secretaria_name,
          s.acronym as secretaria_acronym,
          c.name as category_name,
          u.name as author_name,
          r.name as reviewer_name
        FROM matters m
        LEFT JOIN secretarias s ON m.secretaria_id = s.id
        LEFT JOIN categories c ON m.category_id = c.id
        LEFT JOIN users u ON m.author_id = u.id
        LEFT JOIN users r ON m.reviewer_id = r.id
        WHERE m.id = ?
      `)
      .bind(id)
      .first();
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    // Verificar permissão
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    
    // Buscar histórico de versões
    const versions = await c.env.DB
      .prepare(`
        SELECT 
          v.*,
          u.name as changed_by_name
        FROM matter_versions v
        LEFT JOIN users u ON v.changed_by = u.id
        WHERE v.matter_id = ?
        ORDER BY v.version DESC
      `)
      .bind(id)
      .all();
    
    // Buscar comentários
    const comments = await c.env.DB
      .prepare(`
        SELECT 
          c.*,
          u.name as user_name,
          u.role as user_role
        FROM comments c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.matter_id = ?
        ORDER BY c.created_at DESC
      `)
      .bind(id)
      .all();
    
    return c.json({
      matter,
      versions: versions.results,
      comments: comments.results
    });
    
  } catch (error) {
    console.error('Get matter error:', error);
    return c.json({ error: 'Erro ao buscar matéria' }, 500);
  }
});

/**
 * POST /api/matters
 * Cria nova matéria (apenas Secretaria)
 */
matters.post('/', requireRole('secretaria'), async (c) => {
  try {
    const user = c.get('user');
    const { title, content, summary, matter_type, category_id, layout_columns = 1 } = await c.req.json();
    
    if (!title || !content || !matter_type) {
      return c.json({ error: 'Dados obrigatórios faltando' }, 400);
    }
    
    const result = await c.env.DB
      .prepare(`
        INSERT INTO matters (
          title, content, summary, matter_type, category_id, 
          secretaria_id, author_id, status, version, layout_columns,
          created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', 1, ?, datetime('now'), datetime('now'))
      `)
      .bind(
        title, content, summary || null, matter_type, category_id || null,
        user.secretaria_id, user.id, layout_columns
      )
      .run();
    
    // Criar primeira versão
    await c.env.DB
      .prepare(`
        INSERT INTO matter_versions (matter_id, version, title, content, changed_by, change_description, created_at)
        VALUES (?, 1, ?, ?, ?, 'Versão inicial', datetime('now'))
      `)
      .bind(result.meta.last_row_id, title, content, user.id)
      .run();
    
    // Log de auditoria
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Real-IP') || 'unknown';
    const userAgent = c.req.header('User-Agent') || 'unknown';
    await c.env.DB
      .prepare(`
        INSERT INTO audit_logs (user_id, entity_type, entity_id, action, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(user.id, 'matter', result.meta.last_row_id, 'create', ipAddress, userAgent)
      .run();
    
    return c.json({
      message: 'Matéria criada com sucesso',
      matterId: result.meta.last_row_id
    }, 201);
    
  } catch (error) {
    console.error('Create matter error:', error);
    return c.json({ error: 'Erro ao criar matéria' }, 500);
  }
});

/**
 * PUT /api/matters/:id
 * Atualiza matéria
 */
matters.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const { title, content, summary, matter_type, category_id, layout_columns } = await c.req.json();
    
    // Buscar matéria atual
    const matter = await c.env.DB
      .prepare('SELECT * FROM matters WHERE id = ?')
      .bind(id)
      .first<Matter>();
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    // Verificar permissão
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    
    // Não permitir edição de matérias publicadas (apenas admin/semad)
    if (matter.status === 'published' && user.role !== 'admin' && user.role !== 'semad') {
      return c.json({ error: 'Matéria já publicada não pode ser editada' }, 400);
    }
    
    const newVersion = matter.version + 1;
    
    // Atualizar matéria
    await c.env.DB
      .prepare(`
        UPDATE matters 
        SET title = ?, content = ?, summary = ?, matter_type = ?, 
            category_id = ?, layout_columns = ?, version = ?, updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(title, content, summary || null, matter_type, category_id || null, layout_columns, newVersion, id)
      .run();
    
    // Criar nova versão
    await c.env.DB
      .prepare(`
        INSERT INTO matter_versions (matter_id, version, title, content, changed_by, change_description, created_at)
        VALUES (?, ?, ?, ?, ?, 'Atualização manual', datetime('now'))
      `)
      .bind(id, newVersion, title, content, user.id)
      .run();
    
    return c.json({ message: 'Matéria atualizada com sucesso' });
    
  } catch (error) {
    console.error('Update matter error:', error);
    return c.json({ error: 'Erro ao atualizar matéria' }, 500);
  }
});

/**
 * POST /api/matters/:id/submit
 * Envia matéria para análise SEMAD
 */
matters.post('/:id/submit', requireRole('secretaria'), async (c) => {
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
    
    if (matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }
    
    if (matter.status !== 'draft') {
      return c.json({ error: 'Apenas matérias em rascunho podem ser enviadas' }, 400);
    }
    
    await c.env.DB
      .prepare(`
        UPDATE matters 
        SET status = 'submitted', submitted_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `)
      .bind(id)
      .run();
    
    // Criar notificação para SEMAD
    const semadUsers = await c.env.DB
      .prepare('SELECT id FROM users WHERE role = ? AND active = 1')
      .bind('semad')
      .all();
    
    for (const semadUser of semadUsers.results) {
      await c.env.DB
        .prepare(`
          INSERT INTO notifications (user_id, matter_id, type, title, message, created_at)
          VALUES (?, ?, 'matter_submitted', ?, ?, datetime('now'))
        `)
        .bind(
          semadUser.id,
          id,
          'Nova matéria enviada para análise',
          `A matéria "${matter.title}" foi enviada para análise pela ${user.secretaria_id}`
        )
        .run();
    }
    
    return c.json({ message: 'Matéria enviada para análise com sucesso' });
    
  } catch (error) {
    console.error('Submit matter error:', error);
    return c.json({ error: 'Erro ao enviar matéria' }, 500);
  }
});

export default matters;
