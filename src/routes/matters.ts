// src/routes/matters.ts - VERSÃO CORRIGIDA
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

    // VERIFICAÇÃO ADICIONADA para secretaria_id
    if (user.role === 'secretaria' && user.secretaria_id) {
      params.push(user.secretaria_id);
      sql += ` AND m.secretaria_id = $${params.length}`;
      console.log(`🔒 Filtro por secretaria: ${user.secretaria_id}`);
    }

    if (status) {
      params.push(status);
      sql += ` AND m.status = $${params.length}`;
      console.log(`📌 Filtro por status: ${status}`);
    }

    if (secretaria_id) {
      params.push(secretaria_id);
      sql += ` AND m.secretaria_id = $${params.length}`;
    }

    if (category_id) {
      params.push(category_id);
      sql += ` AND m.category_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      params.push(`%${search}%`);
      sql += ` AND (m.title ILIKE $${params.length - 1} OR m.content ILIKE $${params.length})`;
    }

    sql += ` ORDER BY m.created_at DESC`;

    const offset = (Number(page) - 1) * Number(limit);
    params.push(limit, offset);
    sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;

    console.log('📝 SQL:', sql);
    console.log('🔢 Parâmetros:', params);

    const result = await db.query(sql, params);
    console.log(`📊 Resultado: ${result.rows.length} matérias encontradas`);

    // Count
    let countSql = `SELECT COUNT(*) FROM matters m WHERE 1=1`;
    const countParams: any[] = [];

    if (user.role === 'secretaria' && user.secretaria_id) {
      countParams.push(user.secretaria_id);
      countSql += ` AND m.secretaria_id = $${countParams.length}`;
    }

    if (status) {
      countParams.push(status);
      countSql += ` AND m.status = $${countParams.length}`;
    }

    console.log('📝 Count SQL:', countSql);
    console.log('🔢 Count Parâmetros:', countParams);

    const countResult = await db.query(countSql, countParams);
    const total = Number(countResult.rows[0].count);

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
    
    const id = c.req.param('id');

    const { rows } = await db.query(
      `
      SELECT
        m.*,
        s.name AS secretaria_name,
        c.name AS category_name,
        u.name AS author_name
      FROM matters m
      LEFT JOIN secretarias s ON s.id = m.secretaria_id
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN users u ON u.id = m.author_id
      WHERE m.id = $1
      `,
      [id]
    );

    const matter = rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    return c.json(matter);
  } catch (err) {
    console.error(err);
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
    } = body;

    if (!title || !content || !matter_type_id) {
      return c.json({ error: 'Dados obrigatórios faltando' }, 400);
    }

    // Verificar se o usuário tem secretaria_id se for necessário
    if ((user.role === 'secretaria' || user.role === 'semad') && !user.secretaria_id) {
      return c.json({ error: 'Usuário não associado a uma secretaria' }, 400);
    }

    const { rows } = await db.query(
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
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'draft',1,NOW(),NOW())
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
      ]
    );

    return c.json(
      { message: 'Matéria criada com sucesso', matterId: rows[0].id },
      201
    );
  } catch (err) {
    console.error(err);
    return c.json({ error: 'Erro ao criar matéria' }, 500);
  }
});

export default matters;