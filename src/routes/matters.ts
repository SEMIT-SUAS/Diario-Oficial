// src/routes/matters.ts - VERSÃO CORRIGIDA PARA POSTGRESQL
import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db';

const matters = new Hono<HonoContext>();

// Todas as rotas exigem autenticação
matters.use('/*', authMiddleware);

/**
 * GET /api/matters
 */
matters.get('/', async (c) => {
  try {
    console.log('📥 GET /api/matters chamado');
    
    const user = c.get('user');
    console.log('👤 Usuário:', user);
    
    // Verificação explícita do usuário
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }
    
    const {
      status,
      secretaria_id,
      category_id,
      search,
      page = '1',
      limit = '20',
    } = c.req.query();

    console.log('📋 Parâmetros:', { status, secretaria_id, category_id, search, page, limit });

    let sql = `
      SELECT
        m.*,
        s.name AS secretaria_name,
        s.acronym AS secretaria_acronym,
        c.name AS category_name,
        u.name AS author_name
      FROM matters m
      LEFT JOIN secretarias s ON s.id = m.secretaria_id
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN users u ON u.id = m.author_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    // VERIFICAÇÃO ADICIONADA para secretaria_id
    if (user.role === 'secretaria' && user.secretaria_id) {
      params.push(user.secretaria_id);
      sql += ` AND m.secretaria_id = $${paramCount}`;
      paramCount++;
      console.log(`🔒 Filtro por secretaria: ${user.secretaria_id}`);
    }

    if (status) {
      params.push(status);
      sql += ` AND m.status = $${paramCount}`;
      paramCount++;
      console.log(`📌 Filtro por status: ${status}`);
    }

    if (secretaria_id && (user.role === 'admin' || user.role === 'semad')) {
      params.push(secretaria_id);
      sql += ` AND m.secretaria_id = $${paramCount}`;
      paramCount++;
    }

    if (category_id) {
      params.push(category_id);
      sql += ` AND m.category_id = $${paramCount}`;
      paramCount++;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (m.title ILIKE $${paramCount} OR m.content ILIKE $${paramCount})`;
      paramCount++;
    }

    sql += ` ORDER BY m.created_at DESC`;

    // Adicionar LIMIT e OFFSET
    params.push(Number(limit));
    sql += ` LIMIT $${paramCount}`;
    paramCount++;
    
    const offset = (Number(page) - 1) * Number(limit);
    params.push(offset);
    sql += ` OFFSET $${paramCount}`;

    console.log('📝 SQL:', sql);
    console.log('🔢 Parâmetros:', params);

    const result = await db.query(sql, params);
    console.log(`📊 Resultado: ${result.rows.length} matérias encontradas`);

    // Count
    let countSql = `SELECT COUNT(*) FROM matters m WHERE 1=1`;
    const countParams: any[] = [];
    let countParamCount = 1;

    if (user.role === 'secretaria' && user.secretaria_id) {
      countParams.push(user.secretaria_id);
      countSql += ` AND m.secretaria_id = $${countParamCount}`;
      countParamCount++;
    }

    if (status) {
      countParams.push(status);
      countSql += ` AND m.status = $${countParamCount}`;
      countParamCount++;
    }

    if (secretaria_id && (user.role === 'admin' || user.role === 'semad')) {
      countParams.push(secretaria_id);
      countSql += ` AND m.secretaria_id = $${countParamCount}`;
      countParamCount++;
    }

    if (category_id) {
      countParams.push(category_id);
      countSql += ` AND m.category_id = $${countParamCount}`;
      countParamCount++;
    }

    if (search) {
      countParams.push(`%${search}%`);
      countSql += ` AND (m.title ILIKE $${countParamCount} OR m.content ILIKE $${countParamCount})`;
      countParamCount++;
    }

    console.log('📝 Count SQL:', countSql);
    console.log('🔢 Count Parâmetros:', countParams);

    const countResult = await db.query(countSql, countParams);
    const total = Number(countResult.rows[0]?.count || 0);

    return c.json({
      matters: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err: any) {
    console.error('❌ Erro detalhado ao listar matérias:', err);
    console.error('❌ Stack:', err.stack);
    return c.json({ 
      error: 'Erro ao listar matérias',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * GET /api/matters/:id
 */
matters.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    
    // Verificação explícita do usuário
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id')); // CONVERTER PARA NÚMERO

    const result = await db.query(
      `
      SELECT
        m.*,
        s.name AS secretaria_name,
        s.acronym AS secretaria_acronym,
        c.name AS category_name,
        u.name AS author_name,
        mt.name AS matter_type_name
      FROM matters m
      LEFT JOIN secretarias s ON s.id = m.secretaria_id
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN users u ON u.id = m.author_id
      LEFT JOIN matter_types mt ON mt.id = m.matter_type_id
      WHERE m.id = $1
      `,
      [id]
    );

    const matter = result.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    // Verificar permissões
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Buscar anexos se existirem
    const attachmentsResult = await db.query(
      'SELECT * FROM attachments WHERE matter_id = $1',
      [id]
    );

    return c.json({
      ...matter,
      attachments: attachmentsResult.rows || []
    });
  } catch (err: any) {
    console.error('Erro ao buscar matéria:', err);
    return c.json({ error: 'Erro ao buscar matéria' }, 500);
  }
});

/**
 * POST /api/matters
 */
matters.post('/', requireRole('secretaria', 'semad', 'admin'), async (c) => {
  try {
    const user = c.get('user');
    
    // Verificação explícita do usuário
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }
    
    const body = await c.req.json();

    const {
      title,
      content,
      summary,
      category_id,
      matter_type_id,
      priority = 'normal',
      layout_columns = 2
    } = body;

    if (!title || !content || !matter_type_id) {
      return c.json({ error: 'Título, conteúdo e tipo de matéria são obrigatórios' }, 400);
    }

    // Verificar se o usuário tem secretaria_id se for necessário
    if ((user.role === 'secretaria' || user.role === 'semad') && !user.secretaria_id) {
      return c.json({ error: 'Usuário não associado a uma secretaria' }, 400);
    }

    const result = await db.query(
      `
      INSERT INTO matters (
        title,
        content,
        summary,
        category_id,
        matter_type_id,
        secretaria_id,
        author_id,
        status,
        version,
        priority,
        layout_columns,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', 1, $8, $9, NOW(), NOW())
      RETURNING id
      `,
      [
        title,
        content,
        summary || null,
        category_id || null,
        matter_type_id,
        user.secretaria_id,
        user.id,
        priority,
        layout_columns
      ]
    );

    return c.json(
      { 
        message: 'Matéria criada com sucesso', 
        matterId: result.rows[0].id 
      },
      201
    );
  } catch (err: any) {
    console.error('Erro ao criar matéria:', err);
    return c.json({ error: 'Erro ao criar matéria', details: err.message }, 500);
  }
});

/**
 * PUT /api/matters/:id
 */
matters.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, author_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    // Verificar permissões
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Não permitir edição de matérias já publicadas
    if (matter.status === 'published' && user.role !== 'admin') {
      return c.json({ error: 'Não é possível editar uma matéria já publicada' }, 400);
    }

    const {
      title,
      content,
      summary,
      category_id,
      matter_type_id,
      priority,
      layout_columns
    } = body;

    const result = await db.query(
      `
      UPDATE matters 
      SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        summary = COALESCE($3, summary),
        category_id = COALESCE($4, category_id),
        matter_type_id = COALESCE($5, matter_type_id),
        priority = COALESCE($6, priority),
        layout_columns = COALESCE($7, layout_columns),
        version = version + 1,
        updated_at = NOW()
      WHERE id = $8
      RETURNING *
      `,
      [
        title || null,
        content || null,
        summary || null,
        category_id || null,
        matter_type_id || null,
        priority || null,
        layout_columns || null,
        id
      ]
    );

    return c.json({
      message: 'Matéria atualizada com sucesso',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('Erro ao atualizar matéria:', err);
    return c.json({ error: 'Erro ao atualizar matéria' }, 500);
  }
});

/**
 * DELETE /api/matters/:id
 */
matters.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    // Verificar permissões
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Não permitir exclusão de matérias publicadas
    if (matter.status === 'published' && user.role !== 'admin') {
      return c.json({ error: 'Não é possível excluir uma matéria já publicada' }, 400);
    }

    // Deletar anexos primeiro
    await db.query('DELETE FROM attachments WHERE matter_id = $1', [id]);

    // Deletar matéria
    await db.query('DELETE FROM matters WHERE id = $1', [id]);

    return c.json({ message: 'Matéria excluída com sucesso' });
  } catch (err: any) {
    console.error('Erro ao excluir matéria:', err);
    return c.json({ error: 'Erro ao excluir matéria' }, 500);
  }
});

export default matters;