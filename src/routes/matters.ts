import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db';

const matters = new Hono<HonoContext>();

// Todas as rotas exigem autenticação
matters.use('/*', authMiddleware);

/**
 * POST /api/matters/:id/submit
 * Submeter matéria para revisão - USANDO STATUS 'submitted'
 */
matters.post('/:id/submit', async (c) => {
  console.log('🔵 Rota /:id/submit chamada');
  
  try {
    const user = c.get('user');
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    console.log(`📝 Submetendo matéria ID: ${id} para revisão`);

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      console.log(`❌ Matéria ID: ${id} não encontrada`);
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    console.log(`📊 Matéria encontrada: ID ${matter.id}, Status: ${matter.status}, Secretaria: ${matter.secretaria_id}`);

    // Verificar permissões
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      console.log(`🚫 Acesso negado: Usuário secretaria ${user.secretaria_id} tentando acessar matéria da secretaria ${matter.secretaria_id}`);
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Só pode submeter matérias em draft
    if (matter.status !== 'draft') {
      console.log(`⚠️ Status inválido para submit: ${matter.status}`);
      return c.json({ 
        error: `Só é possível submeter matérias em rascunho. Status atual: ${matter.status}` 
      }, 400);
    }

    // Atualizar status para 'submitted' (e não 'review') e marcar data de submissão
    console.log(`🔄 Atualizando matéria ${id} para status 'submitted'`);
    const result = await db.query(
      `UPDATE matters SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    console.log(`✅ Matéria ${id} submetida com sucesso com status 'submitted'`);
    
    return c.json({
      message: 'Matéria submetida para revisão com sucesso',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Erro ao submeter matéria:', err);
    return c.json({ 
      error: 'Erro ao submeter matéria',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});


/**
 * POST /api/matters/:id/cancel
 * Cancelar envio de matéria - voltar para draft (VERSÃO SIMPLIFICADA)
 */
matters.post('/:id/cancel', async (c) => {
  console.log('🔵 Rota /:id/cancel chamada');
  
  try {
    const user = c.get('user');
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { cancelation_reason } = body;

    if (!cancelation_reason || cancelation_reason.trim() === '') {
      return c.json({ error: 'Motivo do cancelamento é obrigatório' }, 400);
    }

    console.log(`📝 Cancelando matéria ID: ${id}. Motivo: ${cancelation_reason}`);

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, status, author_id FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      console.log(`❌ Matéria ID: ${id} não encontrada`);
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    console.log(`📊 Matéria encontrada: ID ${matter.id}, Status: ${matter.status}, Secretaria: ${matter.secretaria_id}`);

    // Verificar permissões
    if (user.role === 'secretaria') {
      // Secretaria só pode cancelar suas próprias matérias
      if (matter.secretaria_id !== user.secretaria_id) {
        console.log(`🚫 Acesso negado: Usuário secretaria ${user.secretaria_id} tentando cancelar matéria da secretaria ${matter.secretaria_id}`);
        return c.json({ error: 'Acesso negado' }, 403);
      }
      // Secretaria só pode cancelar matérias que ela criou
      if (matter.author_id !== user.id) {
        console.log(`🚫 Usuário não é o autor da matéria`);
        return c.json({ error: 'Somente o autor pode cancelar o envio da matéria' }, 403);
      }
    }

    // Só pode cancelar matérias em submitted
    if (matter.status !== 'submitted') {
      console.log(`⚠️ Status inválido para cancelamento: ${matter.status}`);
      return c.json({ 
        error: `Só é possível cancelar matérias enviadas para análise. Status atual: ${matter.status}` 
      }, 400);
    }

    // VERSÃO SIMPLIFICADA: Apenas mudar o status para draft
    // Nota: Se as colunas não existirem, não tentaremos atualizá-las
    console.log(`🔄 Cancelando matéria ${id}, voltando para status 'draft'`);
    
    // Primeiro, verificar quais colunas existem
    const tableInfo = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'matters'
    `);
    
    const columns = tableInfo.rows.map(row => row.column_name);
    console.log('📋 Colunas disponíveis na tabela matters:', columns);
    
    // Montar query dinamicamente com base nas colunas existentes
    let updateQuery = `UPDATE matters SET status = 'draft'`;
    const queryParams: any[] = [];
    let paramCount = 1;
    
    // Adicionar cancelation_reason se a coluna existir
    if (columns.includes('cancelation_reason')) {
      updateQuery += `, cancelation_reason = $${paramCount}`;
      queryParams.push(cancelation_reason);
      paramCount++;
    }
    
    // Adicionar canceled_at se a coluna existir
    if (columns.includes('canceled_at')) {
      updateQuery += `, canceled_at = NOW()`;
    }
    
    // Adicionar canceler_id se a coluna existir
    if (columns.includes('canceler_id')) {
      updateQuery += `, canceler_id = $${paramCount}`;
      queryParams.push(user.id);
      paramCount++;
    }
    
    // Sempre atualizar updated_at
    updateQuery += `, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    queryParams.push(id);
    
    console.log('📝 Query de update:', updateQuery);
    console.log('🔢 Parâmetros:', queryParams);
    
    const result = await db.query(updateQuery, queryParams);

    console.log(`✅ Matéria ${id} cancelada com sucesso, status atualizado para 'draft'`);
    
    return c.json({
      message: 'Envio cancelado com sucesso. Matéria voltou para rascunho.',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Erro ao cancelar matéria:', err);
    return c.json({ 
      error: 'Erro ao cancelar envio',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});


/**
 * GET /api/matters/:id/attachments
 * Listar anexos de uma matéria
 */
matters.get('/:id/attachments', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id FROM matters WHERE id = $1',
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

    // Buscar anexos
    const result = await db.query(
      `SELECT a.*, u.name AS uploaded_by_name 
       FROM attachments a 
       LEFT JOIN users u ON u.id = a.uploaded_by
       WHERE a.matter_id = $1 
       ORDER BY a.uploaded_at DESC`,
      [id]
    );

    return c.json({
      attachments: result.rows
    });
  } catch (err: any) {
    console.error('Erro ao listar anexos:', err);
    return c.json({ error: 'Erro ao listar anexos' }, 500);
  }
});


/**
 * POST /api/matters/:id/attachments
 * Upload de anexos para uma matéria
 */
matters.post('/:id/attachments', async (c) => {
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

    // Só permite adicionar anexos em matérias em draft ou submitted
    if (matter.status !== 'draft' && matter.status !== 'submitted') {
      return c.json({ 
        error: 'Só é possível adicionar anexos em matérias em rascunho ou enviadas para análise' 
      }, 400);
    }

    const body = await c.req.parseBody();
    
    // Obter o arquivo do FormData (pode ter múltiplos arquivos)
    // Note: Hono lida com FormData de forma diferente
    const files = [];
    
    // Para FormData com múltiplos arquivos
    for (const [key, value] of Object.entries(body)) {
      if (value instanceof File) {
        files.push(value);
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'Nenhum arquivo enviado' }, 400);
    }

    // Limitar número de arquivos
    if (files.length > 10) {
      return c.json({ error: 'Máximo de 10 arquivos por upload' }, 400);
    }

    // Tamanho máximo por arquivo: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    for (const file of files) {
      if (file.size > MAX_SIZE) {
        return c.json({ 
          error: `Arquivo ${file.name} excede o tamanho máximo de 10MB` 
        }, 400);
      }
    }

    // Inserir anexos no banco de dados
    const insertedAttachments = [];
    
    for (const file of files) {
      // Em um sistema real, você salvaria o arquivo no sistema de arquivos ou S3
      // Aqui estamos apenas registrando no banco de dados
      const result = await db.query(
        `INSERT INTO attachments (
          matter_id,
          filename,
          original_name,
          file_size,
          mime_type,
          uploaded_by,
          uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *`,
        [
          id,
          file.name, // Em produção, gere um nome único
          file.name,
          file.size,
          file.type,
          user.id
        ]
      );
      
      insertedAttachments.push(result.rows[0]);
    }

    // Atualizar flag de anexos na matéria
    await db.query(
      'UPDATE matters SET has_attachments = true, updated_at = NOW() WHERE id = $1',
      [id]
    );

    return c.json({
      message: `${files.length} arquivo(s) anexado(s) com sucesso`,
      attachments: insertedAttachments
    }, 201);
  } catch (err: any) {
    console.error('Erro ao fazer upload de anexos:', err);
    return c.json({ 
      error: 'Erro ao fazer upload de anexos',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});


/**
 * GET /api/attachments/:id/download
 * Download de um anexo específico
 */
matters.get('/attachments/:id/download', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));

    // Buscar anexo
    const result = await db.query(
      `SELECT a.*, m.secretaria_id 
       FROM attachments a 
       JOIN matters m ON m.id = a.matter_id
       WHERE a.id = $1`,
      [id]
    );

    const attachment = result.rows[0];
    if (!attachment) {
      return c.json({ error: 'Anexo não encontrado' }, 404);
    }

    // Verificar permissões
    if (user.role === 'secretaria' && attachment.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Em produção, você buscaria o arquivo real do sistema de arquivos/S3
    // Aqui estamos apenas retornando uma mensagem simulada
    return c.json({
      message: 'Download de anexo - funcionalidade em desenvolvimento',
      attachment: attachment
    });

    // Em produção, seria algo como:
    // const filePath = `/path/to/uploads/${attachment.filename}`;
    // const fileBuffer = await Bun.file(filePath).arrayBuffer();
    // return new Response(fileBuffer, {
    //   headers: {
    //     'Content-Type': attachment.mime_type,
    //     'Content-Disposition': `attachment; filename="${attachment.original_name}"`
    //   }
    // });
  } catch (err: any) {
    console.error('Erro ao buscar anexo:', err);
    return c.json({ error: 'Erro ao buscar anexo' }, 500);
  }
});


/**
 * PATCH /api/matters/:id/status
 * Alterar status da matéria (usar os status permitidos pela constraint)
 */
matters.patch('/:id/status', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { status } = body;

    // USAR APENAS OS STATUS PERMITIDOS PELA CONSTRAINT
    const allowedStatuses = ['draft', 'submitted', 'approved', 'rejected', 'published'];
    
    if (!status || !allowedStatuses.includes(status)) {
      return c.json({ 
        error: `Status inválido. Status permitidos: ${allowedStatuses.join(', ')}` 
      }, 400);
    }

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    // Verificar permissões (semad/admin podem alterar status)
    if (!['semad', 'admin'].includes(user.role)) {
      return c.json({ error: 'Acesso negado. Apenas SEMAD ou Admin podem alterar status' }, 403);
    }

    // Verificar transições de status permitidas
    const allowedTransitions: Record<string, string[]> = {
      'draft': ['submitted'],
      'submitted': ['approved', 'rejected', 'draft'],
      'approved': ['published', 'rejected', 'submitted'],
      'published': [],
      'rejected': ['draft', 'submitted']
    };

    if (!allowedTransitions[matter.status]?.includes(status)) {
      return c.json({ 
        error: `Transição de status não permitida: ${matter.status} -> ${status}` 
      }, 400);
    }

    // Se estiver publicando, marcar a data de publicação
    let updateQuery = `UPDATE matters SET status = $1, updated_at = NOW()`;
    const params: any[] = [status, id];
    
    if (status === 'published') {
      updateQuery = `UPDATE matters SET status = $1, published_at = NOW(), updated_at = NOW()`;
    } else if (status === 'submitted') {
      updateQuery = `UPDATE matters SET status = $1, submitted_at = NOW(), updated_at = NOW()`;
    }

    updateQuery += ` WHERE id = $2 RETURNING *`;

    const result = await db.query(updateQuery, params);

    return c.json({
      message: `Status da matéria atualizado para ${status}`,
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('Erro ao atualizar status:', err);
    return c.json({ error: 'Erro ao atualizar status' }, 500);
  }
});

/**
 * GET /api/matters para listagem - corrigir para usar status 'submitted'
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
      // Verificar se o status é válido
      const allowedStatuses = ['draft', 'submitted', 'approved', 'rejected', 'published'];
      if (allowedStatuses.includes(status)) {
        params.push(status);
        sql += ` AND m.status = $${paramCount}`;
        paramCount++;
        console.log(`📌 Filtro por status: ${status}`);
      } else {
        console.log(`⚠️ Status inválido na query: ${status}`);
      }
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

    if (status && ['draft', 'submitted', 'approved', 'rejected', 'published'].includes(status)) {
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
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', NOW(), NOW())
      RETURNING id
      `,
      [
        title,
        content,
        summary || null,
        category_id || null,
        matter_type_id,
        user.secretaria_id,
        user.id
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
    return c.json({ 
      error: 'Erro ao criar matéria', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
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
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [
        title || null,
        content || null,
        summary || null,
        category_id || null,
        matter_type_id || null,
        id
      ]
    );

    return c.json({
      message: 'Matéria atualizada com sucesso',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('Erro ao atualizar matéria:', err);
    return c.json({ 
      error: 'Erro ao atualizar matéria',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * PATCH /api/matters/:id/status
 */
matters.patch('/:id/status', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { status } = body;

    if (!status || !['draft', 'review', 'published', 'rejected'].includes(status)) {
      return c.json({ error: 'Status inválido' }, 400);
    }

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

    // Verificar transições de status permitidas
    const allowedTransitions: Record<string, string[]> = {
      'draft': ['review'],
      'review': ['published', 'rejected', 'draft'],
      'published': [],
      'rejected': ['draft']
    };

    if (!allowedTransitions[matter.status]?.includes(status)) {
      return c.json({ 
        error: `Transição de status não permitida: ${matter.status} -> ${status}` 
      }, 400);
    }

    // Atualizar status
    const result = await db.query(
      `UPDATE matters SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    return c.json({
      message: `Status da matéria atualizado para ${status}`,
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('Erro ao atualizar status:', err);
    return c.json({ error: 'Erro ao atualizar status' }, 500);
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

console.log('✅ matters.ts carregado com rotas de attachments e submit');

export default matters;