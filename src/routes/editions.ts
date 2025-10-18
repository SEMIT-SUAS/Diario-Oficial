// ====================================
// DOM - Editions (Edições) Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { getCurrentTimestamp, formatDate } from '../utils/date';
import { generateEditionPDF } from '../utils/pdf-generator';

const editions = new Hono<HonoContext>();

// Rotas públicas (sem autenticação) - DEVEM VIR ANTES DO MIDDLEWARE
// GET /api/editions/:id/pdf - Download público de PDF
editions.get('/:id/pdf', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    // Buscar edição publicada
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ? AND status = ?'
    ).bind(id, 'published').first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada ou não publicada' }, 404);
    }
    
    // Buscar matérias da edição para gerar HTML
    const { results: matters } = await c.env.DB.prepare(`
      SELECT 
        m.*,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        u.name as author_name,
        em.display_order
      FROM edition_matters em
      INNER JOIN matters m ON em.matter_id = m.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
      WHERE em.edition_id = ?
      ORDER BY em.display_order ASC
    `).bind(id).all();
    
    // Gerar PDF novamente (contém o HTML)
    const { generateEditionPDF } = await import('../utils/pdf-generator');
    const pdfResult = await generateEditionPDF(c.env.R2, {
      edition: edition as any,
      matters: matters as any[]
    }, c.env.DB);
    
    // Retornar HTML diretamente para download
    const filename = `diario-oficial-${edition.edition_number.replace(/\//g, '-')}-${edition.year}.html`;
    
    return new Response(pdfResult.htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Hash': pdfResult.hash
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching PDF:', error);
    return c.json({ error: 'Erro ao buscar PDF', details: error.message }, 500);
  }
});

// Aplicar autenticação em todas as outras rotas
editions.use('/*', authMiddleware);

/**
 * GET /api/editions
 * Lista todas as edições (com filtros opcionais)
 */
editions.get('/', async (c) => {
  try {
    const { status, year, search, page = '1', limit = '20' } = c.req.query();
    
    let query = `
      SELECT 
        e.*,
        u.name as published_by_name,
        COUNT(DISTINCT em.matter_id) as matter_count
      FROM editions e
      LEFT JOIN users u ON e.published_by = u.id
      LEFT JOIN edition_matters em ON e.id = em.edition_id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ` AND e.status = ?`;
      params.push(status);
    }
    
    if (year) {
      query += ` AND e.year = ?`;
      params.push(parseInt(year));
    }
    
    if (search) {
      query += ` AND (e.edition_number LIKE ? OR e.year LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += `
      GROUP BY e.id
      ORDER BY e.edition_date DESC, e.edition_number DESC
      LIMIT ? OFFSET ?
    `;
    
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);
    
    const stmt = c.env.DB.prepare(query).bind(...params);
    const { results } = await stmt.all();
    
    // Contar total para paginação
    let countQuery = 'SELECT COUNT(*) as total FROM editions WHERE 1=1';
    const countParams: any[] = [];
    
    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }
    if (year) {
      countQuery += ' AND year = ?';
      countParams.push(parseInt(year));
    }
    
    const countResult = await c.env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total || 0;
    
    return c.json({
      editions: results,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total as number,
        pages: Math.ceil((total as number) / parseInt(limit))
      }
    });
    
  } catch (error: any) {
    console.error('Error fetching editions:', error);
    return c.json({ error: 'Erro ao buscar edições', details: error.message }, 500);
  }
});

/**
 * GET /api/editions/:id
 * Busca uma edição específica com suas matérias
 */
editions.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    // Buscar edição
    const edition = await c.env.DB.prepare(`
      SELECT 
        e.*,
        u.name as published_by_name
      FROM editions e
      LEFT JOIN users u ON e.published_by = u.id
      WHERE e.id = ?
    `).bind(id).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    // Buscar matérias da edição
    const { results: matters } = await c.env.DB.prepare(`
      SELECT 
        m.*,
        em.display_order,
        em.page_start,
        em.page_end,
        em.added_at,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        u.name as author_name
      FROM edition_matters em
      INNER JOIN matters m ON em.matter_id = m.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
      WHERE em.edition_id = ?
      ORDER BY em.display_order ASC
    `).bind(id).all();
    
    return c.json({
      ...edition,
      matters: matters || []
    });
    
  } catch (error: any) {
    console.error('Error fetching edition:', error);
    return c.json({ error: 'Erro ao buscar edição', details: error.message }, 500);
  }
});

/**
 * POST /api/editions
 * Cria uma nova edição (apenas ADMIN e SEMAD)
 * Suporta: edições normais e suplementares
 * Data e número são AUTOMÁTICOS se não fornecidos
 */
editions.post('/', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    let { edition_number, edition_date, year, is_supplemental = false } = await c.req.json();
    
    // Data automática (hoje) se não fornecida
    if (!edition_date) {
      edition_date = new Date().toISOString().split('T')[0];
    }
    
    // Ano automático (ano atual) se não fornecido
    if (!year) {
      year = new Date().getFullYear();
    }
    
    // Número automático se não fornecido
    if (!edition_number) {
      if (is_supplemental) {
        // Para edição suplementar: buscar último suplemento do ano
        const lastSupplement = await c.env.DB.prepare(`
          SELECT edition_number, supplemental_number FROM editions 
          WHERE year = ? AND is_supplemental = 1
          ORDER BY CAST(COALESCE(supplemental_number, '0') AS INTEGER) DESC 
          LIMIT 1
        `).bind(parseInt(year)).first();
        
        let nextSupplementNumber = 1;
        if (lastSupplement && lastSupplement.supplemental_number) {
          nextSupplementNumber = parseInt(lastSupplement.supplemental_number as string) + 1;
        }
        
        // Formato: "001-A/2025" para suplementares
        const paddedNumber = nextSupplementNumber.toString().padStart(3, '0');
        edition_number = `${paddedNumber}-A/${year}`;
        
      } else {
        // Para edição normal: buscar última edição normal do ano
        const lastEdition = await c.env.DB.prepare(`
          SELECT edition_number FROM editions 
          WHERE year = ? AND (is_supplemental = 0 OR is_supplemental IS NULL)
          ORDER BY CAST(substr(edition_number, 1, instr(edition_number, '/') - 1) AS INTEGER) DESC 
          LIMIT 1
        `).bind(parseInt(year)).first();
        
        let nextNumber = 1;
        if (lastEdition && lastEdition.edition_number) {
          // Extrair número da edição (ex: "001/2025" -> 1)
          const match = (lastEdition.edition_number as string).match(/^(\d+)/);
          if (match) {
            nextNumber = parseInt(match[1]) + 1;
          }
        }
        
        // Formato: "001/2025"
        const paddedNumber = nextNumber.toString().padStart(3, '0');
        edition_number = `${paddedNumber}/${year}`;
      }
    }
    
    // Extrair supplemental_number se for suplementar
    let supplemental_number = null;
    if (is_supplemental) {
      const match = edition_number.match(/^(\d+)-[A-Z]\//);
      if (match) {
        supplemental_number = match[1];
      }
    }
    
    // Verificar se já existe edição com esse número
    const existing = await c.env.DB.prepare(
      'SELECT id FROM editions WHERE edition_number = ?'
    ).bind(edition_number).first();
    
    if (existing) {
      return c.json({ error: 'Já existe uma edição com este número' }, 400);
    }
    
    // Criar edição
    const result = await c.env.DB.prepare(`
      INSERT INTO editions (
        edition_number, edition_date, year, status,
        is_supplemental, supplemental_number,
        created_at, updated_at
      ) VALUES (?, ?, ?, 'draft', ?, ?, datetime('now'), datetime('now'))
    `).bind(
      edition_number, 
      edition_date, 
      parseInt(year), 
      is_supplemental ? 1 : 0,
      supplemental_number
    ).run();
    
    const editionId = result.meta.last_row_id;
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition',
      editionId,
      'create',
      JSON.stringify({ edition_number, edition_date, year, is_supplemental }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({
      message: is_supplemental ? 'Edição suplementar criada com sucesso' : 'Edição criada com sucesso',
      edition: {
        id: editionId,
        edition_number,
        edition_date,
        year,
        is_supplemental,
        status: 'draft'
      }
    }, 201);
    
  } catch (error: any) {
    console.error('Error creating edition:', error);
    return c.json({ error: 'Erro ao criar edição', details: error.message }, 500);
  }
});

/**
 * PUT /api/editions/:id
 * Atualiza uma edição (apenas se ainda não foi publicada)
 */
editions.put('/:id', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    const { edition_number, edition_date, year } = await c.req.json();
    
    // Verificar se edição existe
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(id).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    // Não permitir edição de edições já publicadas
    if (edition.status === 'published') {
      return c.json({ 
        error: 'Não é possível editar uma edição já publicada' 
      }, 400);
    }
    
    // Atualizar edição
    await c.env.DB.prepare(`
      UPDATE editions 
      SET edition_number = ?, edition_date = ?, year = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(edition_number, edition_date, parseInt(year), id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition',
      id,
      'update',
      JSON.stringify(edition),
      JSON.stringify({ edition_number, edition_date, year }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Edição atualizada com sucesso' });
    
  } catch (error: any) {
    console.error('Error updating edition:', error);
    return c.json({ error: 'Erro ao atualizar edição', details: error.message }, 500);
  }
});

/**
 * POST /api/editions/:id/add-matter
 * Adiciona uma matéria aprovada à edição
 */
editions.post('/:id/add-matter', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    const editionId = parseInt(c.req.param('id'));
    const { matter_id } = await c.req.json();
    
    // Verificar se edição existe e não está publicada
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(editionId).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    if (edition.status === 'published') {
      return c.json({ 
        error: 'Não é possível adicionar matérias a uma edição já publicada' 
      }, 400);
    }
    
    // Verificar se matéria existe e está aprovada
    const matter = await c.env.DB.prepare(
      'SELECT * FROM matters WHERE id = ?'
    ).bind(matter_id).first();
    
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }
    
    if (matter.status !== 'approved') {
      return c.json({ 
        error: 'Apenas matérias aprovadas podem ser adicionadas à edição' 
      }, 400);
    }
    
    // Verificar se matéria já está na edição
    const existing = await c.env.DB.prepare(
      'SELECT id FROM edition_matters WHERE edition_id = ? AND matter_id = ?'
    ).bind(editionId, matter_id).first();
    
    if (existing) {
      return c.json({ error: 'Matéria já está nesta edição' }, 400);
    }
    
    // Buscar próxima ordem de exibição
    const lastOrder = await c.env.DB.prepare(
      'SELECT MAX(display_order) as max_order FROM edition_matters WHERE edition_id = ?'
    ).bind(editionId).first();
    
    const nextOrder = (lastOrder?.max_order || 0) + 1;
    
    // Adicionar matéria à edição
    await c.env.DB.prepare(`
      INSERT INTO edition_matters (
        edition_id, matter_id, display_order, added_by, added_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).bind(editionId, matter_id, nextOrder, user.id).run();
    
    // Atualizar campo edition_id na matéria
    await c.env.DB.prepare(
      'UPDATE matters SET edition_id = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(editionId, matter_id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition_matter',
      editionId,
      'add_matter',
      JSON.stringify({ matter_id, display_order: nextOrder }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ 
      message: 'Matéria adicionada à edição com sucesso',
      display_order: nextOrder
    });
    
  } catch (error: any) {
    console.error('Error adding matter to edition:', error);
    return c.json({ error: 'Erro ao adicionar matéria', details: error.message }, 500);
  }
});

/**
 * POST /api/editions/:id/add-matters
 * Adiciona múltiplas matérias aprovadas à edição de uma só vez
 */
editions.post('/:id/add-matters', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    const editionId = parseInt(c.req.param('id'));
    const { matter_ids } = await c.req.json(); // Array de IDs
    
    if (!Array.isArray(matter_ids) || matter_ids.length === 0) {
      return c.json({ error: 'matter_ids deve ser um array com pelo menos 1 ID' }, 400);
    }
    
    // Verificar se edição existe e não está publicada
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(editionId).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    if (edition.status === 'published') {
      return c.json({ 
        error: 'Não é possível adicionar matérias a uma edição já publicada' 
      }, 400);
    }
    
    // Buscar próxima ordem de exibição
    const lastOrder = await c.env.DB.prepare(
      'SELECT MAX(display_order) as max_order FROM edition_matters WHERE edition_id = ?'
    ).bind(editionId).first();
    
    let currentOrder = (lastOrder?.max_order || 0) + 1;
    
    const results = {
      added: [] as number[],
      skipped: [] as { id: number; reason: string }[]
    };
    
    // Adicionar cada matéria
    for (const matterId of matter_ids) {
      try {
        // Verificar se matéria existe e está aprovada
        const matter = await c.env.DB.prepare(
          'SELECT * FROM matters WHERE id = ?'
        ).bind(matterId).first();
        
        if (!matter) {
          results.skipped.push({ id: matterId, reason: 'Matéria não encontrada' });
          continue;
        }
        
        if (matter.status !== 'approved') {
          results.skipped.push({ id: matterId, reason: 'Matéria não aprovada' });
          continue;
        }
        
        // Verificar se matéria já está na edição
        const existing = await c.env.DB.prepare(
          'SELECT id FROM edition_matters WHERE edition_id = ? AND matter_id = ?'
        ).bind(editionId, matterId).first();
        
        if (existing) {
          results.skipped.push({ id: matterId, reason: 'Matéria já está nesta edição' });
          continue;
        }
        
        // Adicionar matéria à edição
        await c.env.DB.prepare(`
          INSERT INTO edition_matters (
            edition_id, matter_id, display_order, added_by, added_at
          ) VALUES (?, ?, ?, ?, datetime('now'))
        `).bind(editionId, matterId, currentOrder, user.id).run();
        
        // Atualizar campo edition_id na matéria
        await c.env.DB.prepare(
          'UPDATE matters SET edition_id = ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(editionId, matterId).run();
        
        results.added.push(matterId);
        currentOrder++;
        
      } catch (err) {
        console.error(`Error adding matter ${matterId}:`, err);
        results.skipped.push({ 
          id: matterId, 
          reason: err instanceof Error ? err.message : 'Erro desconhecido' 
        });
      }
    }
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition_matter',
      editionId,
      'add_multiple_matters',
      JSON.stringify({ matter_ids, results }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ 
      message: `${results.added.length} matérias adicionadas com sucesso`,
      results
    });
    
  } catch (error: any) {
    console.error('Error adding multiple matters to edition:', error);
    return c.json({ error: 'Erro ao adicionar matérias', details: error.message }, 500);
  }
});

/**
 * DELETE /api/editions/:id/remove-matter/:matterId
 * Remove uma matéria da edição
 */
editions.delete('/:id/remove-matter/:matterId', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    const editionId = parseInt(c.req.param('id'));
    const matterId = parseInt(c.req.param('matterId'));
    
    // Verificar se edição existe e não está publicada
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(editionId).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    if (edition.status === 'published') {
      return c.json({ 
        error: 'Não é possível remover matérias de uma edição já publicada' 
      }, 400);
    }
    
    // Remover matéria da edição
    await c.env.DB.prepare(
      'DELETE FROM edition_matters WHERE edition_id = ? AND matter_id = ?'
    ).bind(editionId, matterId).run();
    
    // Remover edition_id da matéria
    await c.env.DB.prepare(
      'UPDATE matters SET edition_id = NULL, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(matterId).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition_matter',
      editionId,
      'remove_matter',
      JSON.stringify({ matter_id: matterId }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Matéria removida da edição com sucesso' });
    
  } catch (error: any) {
    console.error('Error removing matter from edition:', error);
    return c.json({ error: 'Erro ao remover matéria', details: error.message }, 500);
  }
});

/**
 * PUT /api/editions/:id/reorder
 * Reordena as matérias na edição
 */
editions.put('/:id/reorder', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    const editionId = parseInt(c.req.param('id'));
    const { matter_orders } = await c.req.json(); // Array: [{ matter_id, display_order }]
    
    // Verificar se edição existe e não está publicada
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(editionId).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    if (edition.status === 'published') {
      return c.json({ 
        error: 'Não é possível reordenar matérias de uma edição já publicada' 
      }, 400);
    }
    
    // Atualizar ordem de cada matéria
    for (const order of matter_orders) {
      await c.env.DB.prepare(`
        UPDATE edition_matters 
        SET display_order = ?
        WHERE edition_id = ? AND matter_id = ?
      `).bind(order.display_order, editionId, order.matter_id).run();
    }
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition',
      editionId,
      'reorder_matters',
      JSON.stringify({ matter_orders }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Matérias reordenadas com sucesso' });
    
  } catch (error: any) {
    console.error('Error reordering matters:', error);
    return c.json({ error: 'Erro ao reordenar matérias', details: error.message }, 500);
  }
});

/**
 * POST /api/editions/:id/publish
 * Publica a edição e gera o PDF final
 */
editions.post('/:id/publish', requireRole('admin', 'semad'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    
    // Verificar se edição existe
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(id).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    if (edition.status === 'published') {
      return c.json({ error: 'Edição já foi publicada' }, 400);
    }
    
    // Verificar se há matérias na edição
    const matterCount = await c.env.DB.prepare(
      'SELECT COUNT(*) as count FROM edition_matters WHERE edition_id = ?'
    ).bind(id).first();
    
    if (!matterCount || matterCount.count === 0) {
      return c.json({ 
        error: 'Não é possível publicar uma edição sem matérias' 
      }, 400);
    }
    
    // Buscar todas as matérias da edição ordenadas
    const { results: matters } = await c.env.DB.prepare(`
      SELECT 
        m.*,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        u.name as author_name,
        em.display_order
      FROM edition_matters em
      INNER JOIN matters m ON em.matter_id = m.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
      WHERE em.edition_id = ?
      ORDER BY em.display_order ASC
    `).bind(id).all();
    
    // Gerar PDF da edição
    const pdfResult = await generateEditionPDF(c.env.R2, {
      edition: edition as any,
      matters: matters as any[]
    }, c.env.DB);
    
    // Atualizar edição com informações do PDF
    await c.env.DB.prepare(`
      UPDATE editions 
      SET status = 'published',
          pdf_url = ?,
          pdf_hash = ?,
          total_pages = ?,
          published_at = datetime('now'),
          published_by = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      pdfResult.url,
      pdfResult.hash,
      pdfResult.totalPages,
      user.id,
      id
    ).run();
    
    // Atualizar status de todas as matérias para 'published'
    for (const matter of matters) {
      await c.env.DB.prepare(`
        UPDATE matters 
        SET status = 'published',
            published_at = datetime('now'),
            pdf_url = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(pdfResult.url, matter.id).run();
    }
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition',
      id,
      'publish',
      JSON.stringify({ 
        pdf_url: pdfResult.url,
        pdf_hash: pdfResult.hash,
        total_pages: pdfResult.totalPages,
        matter_count: matters.length
      }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({
      message: 'Edição publicada com sucesso',
      pdf_url: pdfResult.url,
      pdf_hash: pdfResult.hash,
      total_pages: pdfResult.totalPages
    });
    
  } catch (error: any) {
    console.error('Error publishing edition:', error);
    return c.json({ error: 'Erro ao publicar edição', details: error.message }, 500);
  }
});

// Rota movida para cima (antes do authMiddleware) para permitir acesso público

/**
 * DELETE /api/editions/:id
 * Deleta uma edição (apenas se não publicada)
 */
editions.delete('/:id', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const id = parseInt(c.req.param('id'));
    
    // Verificar se edição existe
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ?'
    ).bind(id).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    // Não permitir exclusão de edições publicadas
    if (edition.status === 'published') {
      return c.json({ 
        error: 'Não é possível excluir uma edição já publicada' 
      }, 400);
    }
    
    // Remover relacionamentos com matérias
    await c.env.DB.prepare(
      'DELETE FROM edition_matters WHERE edition_id = ?'
    ).bind(id).run();
    
    // Deletar edição
    await c.env.DB.prepare(
      'DELETE FROM editions WHERE id = ?'
    ).bind(id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition',
      id,
      'delete',
      JSON.stringify(edition),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Edição excluída com sucesso' });
    
  } catch (error: any) {
    console.error('Error deleting edition:', error);
    return c.json({ error: 'Erro ao excluir edição', details: error.message }, 500);
  }
});

/**
 * POST /api/editions/:id/auto-build
 * Montagem automática do diário
 * - Busca todas as matérias aprovadas do dia
 * - Organiza por secretaria (alfabética) e depois por tipo
 * - Define display_order automático
 * - Adiciona todas à edição
 */
editions.post('/:id/auto-build', requireRole('admin', 'semad'), async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const user = c.get('user');
    
    // Verificar se edição existe e está em draft
    const edition = await c.env.DB.prepare(
      'SELECT * FROM editions WHERE id = ? AND status = ?'
    ).bind(id, 'draft').first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada ou já publicada' }, 404);
    }
    
    // Buscar todas as matérias aprovadas e ainda não publicadas
    const { results: matters } = await c.env.DB.prepare(`
      SELECT 
        m.*,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        mt.name as matter_type_name
      FROM matters m
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      WHERE m.status = 'approved'
        AND m.id NOT IN (
          SELECT matter_id FROM edition_matters WHERE edition_id != ?
        )
      ORDER BY s.name ASC, mt.name ASC, m.title ASC
    `).bind(id).all();
    
    if (!matters || matters.length === 0) {
      return c.json({ 
        message: 'Nenhuma matéria aprovada disponível',
        matters_added: 0
      });
    }
    
    // Remover matérias existentes da edição (se houver)
    await c.env.DB.prepare(
      'DELETE FROM edition_matters WHERE edition_id = ?'
    ).bind(id).run();
    
    // Adicionar todas as matérias com display_order sequencial
    let displayOrder = 1;
    for (const matter of matters) {
      await c.env.DB.prepare(`
        INSERT INTO edition_matters (edition_id, matter_id, display_order, added_at, added_by)
        VALUES (?, ?, ?, datetime('now'), ?)
      `).bind(id, matter.id, displayOrder, user.id).run();
      
      displayOrder++;
    }
    
    // Atualizar updated_at da edição
    await c.env.DB.prepare(
      'UPDATE editions SET updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(id).run();
    
    // Log de auditoria
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'edition',
      id,
      'auto_build',
      JSON.stringify({ matters_count: matters.length }),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({
      message: 'Diário montado automaticamente com sucesso',
      matters_added: matters.length,
      matters: matters.map((m: any) => ({
        id: m.id,
        title: m.title,
        secretaria: m.secretaria_acronym,
        type: m.matter_type_name
      }))
    });
    
  } catch (error: any) {
    console.error('Error auto-building edition:', error);
    return c.json({ error: 'Erro ao montar diário automaticamente', details: error.message }, 500);
  }
});

export default editions;
