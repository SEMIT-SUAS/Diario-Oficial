// ====================================
// Portal Routes - Public API endpoints
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import db from '../lib/db'; // Importe a conexão PostgreSQL

const portal = new Hono<HonoContext>();

// GET /api/portal/stats - Estatísticas gerais do portal
portal.get('/stats', async (c) => {
  try {
    // Total de edições publicadas
    const totalEditionsResult = await db.query(`
      SELECT COUNT(*) as count FROM editions 
      WHERE status = 'published'
    `);
    
    // Total de matérias publicadas
    const totalMattersResult = await db.query(`
      SELECT COUNT(*) as count FROM matters 
      WHERE status = 'published'
    `);
    
    // Publicações deste mês (PostgreSQL usa EXTRACT e DATE_TRUNC)
    const thisMonthResult = await db.query(`
      SELECT COUNT(*) as count FROM editions 
      WHERE status = 'published' 
      AND DATE_TRUNC('month', edition_date) = DATE_TRUNC('month', CURRENT_DATE)
    `);
    
    return c.json({
      total_editions: parseInt(totalEditionsResult.rows[0]?.count || '0'),
      total_matters: parseInt(totalMattersResult.rows[0]?.count || '0'),
      this_month: parseInt(thisMonthResult.rows[0]?.count || '0')
    });
    
  } catch (error: any) {
    console.error('Error fetching portal stats:', error);
    return c.json({ error: 'Erro ao buscar estatísticas', details: error.message }, 500);
  }
});

// GET /api/portal/editions - Últimas edições publicadas
portal.get('/editions', async (c) => {
  try {
    const limit = parseInt(c.req.query('limit') || '10');
    
    // Buscar últimas edições publicadas com contagem de matérias
    const result = await db.query(`
      SELECT 
        e.id,
        e.edition_number,
        e.edition_date,
        e.year,
        e.is_supplemental,
        e.published_at,
        COUNT(em.matter_id) as matter_count
      FROM editions e
      LEFT JOIN edition_matters em ON e.id = em.edition_id
      WHERE e.status = 'published'
      GROUP BY e.id
      ORDER BY e.published_at DESC
      LIMIT $1
    `, [limit]);
    
    return c.json({
      editions: result.rows || []
    });
    
  } catch (error: any) {
    console.error('Error fetching portal editions:', error);
    return c.json({ error: 'Erro ao buscar edições', details: error.message }, 500);
  }
});

// GET /api/portal/search - Pesquisa pública de publicações
portal.get('/search', async (c) => {
  try {
    const query = c.req.query('q') || '';
    const status = c.req.query('status') || 'published'; // Filtro de status
    const year = c.req.query('year') || '';
    const secretaria = c.req.query('secretaria') || '';
    const type = c.req.query('type') || '';
    const limit = parseInt(c.req.query('limit') || '20');
    
    if (!query || query.trim().length < 3) {
      return c.json({ 
        results: [],
        message: 'Digite pelo menos 3 caracteres para pesquisar'
      });
    }
    
    // Construir query dinâmica com filtros
    let sqlQuery = `
      SELECT 
        m.id,
        m.title,
        m.content,
        m.status,
        m.created_at,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        mt.name as matter_type_name,
        e.edition_number,
        e.year as edition_year,
        e.edition_date,
        e.status as edition_status
      FROM matters m
      INNER JOIN secretarias s ON m.secretaria_id = s.id
      INNER JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN edition_matters em ON m.id = em.matter_id
      LEFT JOIN editions e ON em.edition_id = e.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramCount = 1;
    
    // Filtro de status (padrão: apenas publicadas)
    if (status && status !== 'all') {
      sqlQuery += ` AND m.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    
    // Filtro de busca textual
    const searchPattern = `%${query.trim()}%`;
    sqlQuery += ` AND (m.title ILIKE $${paramCount} OR m.content ILIKE $${paramCount})`;
    params.push(searchPattern);
    paramCount++;
    
    // Filtro por ano
    if (year) {
      sqlQuery += ` AND e.year = $${paramCount}`;
      params.push(parseInt(year));
      paramCount++;
    }
    
    // Filtro por secretaria
    if (secretaria) {
      sqlQuery += ` AND s.acronym = $${paramCount}`;
      params.push(secretaria);
      paramCount++;
    }
    
    // Filtro por tipo
    if (type) {
      sqlQuery += ` AND mt.name = $${paramCount}`;
      params.push(type);
      paramCount++;
    }
    
    sqlQuery += ` ORDER BY m.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);
    
    // Executar query
    const result = await db.query(sqlQuery, params);
    
    return c.json({
      results: result.rows || [],
      count: result.rows?.length || 0,
      query: query,
      filters: {
        status,
        year,
        secretaria,
        type
      }
    });
    
  } catch (error: any) {
    console.error('Error searching portal:', error);
    return c.json({ error: 'Erro ao pesquisar publicações', details: error.message }, 500);
  }
});

// GET /api/portal/analytics - Estatísticas avançadas
portal.get('/analytics', async (c) => {
  try {
    // Matérias por secretaria
    const mattersBySecretariaResult = await db.query(`
      SELECT 
        s.acronym,
        s.name,
        COUNT(m.id) as count
      FROM secretarias s
      LEFT JOIN matters m ON s.id = m.secretaria_id AND m.status = 'published'
      GROUP BY s.id, s.acronym, s.name
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Tipos de matéria mais publicados
    const mattersByTypeResult = await db.query(`
      SELECT 
        mt.name,
        COUNT(m.id) as count
      FROM matter_types mt
      LEFT JOIN matters m ON mt.id = m.matter_type_id AND m.status = 'published'
      GROUP BY mt.id, mt.name
      ORDER BY count DESC
      LIMIT 10
    `);
    
    // Tendência de publicações (últimos 6 meses) - PostgreSQL
    const publicationTrendResult = await db.query(`
      SELECT 
        TO_CHAR(e.edition_date, 'YYYY-MM') as month,
        COUNT(DISTINCT e.id) as editions,
        COUNT(m.id) as matters
      FROM editions e
      LEFT JOIN edition_matters em ON e.id = em.edition_id
      LEFT JOIN matters m ON em.matter_id = m.id
      WHERE e.status = 'published'
      AND e.edition_date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(e.edition_date, 'YYYY-MM')
      ORDER BY month ASC
    `);
    
    // Matérias mais recentes (opcional)
    const recentMattersResult = await db.query(`
      SELECT 
        m.id,
        m.title,
        m.created_at,
        s.acronym as secretaria_acronym,
        mt.name as matter_type_name
      FROM matters m
      INNER JOIN secretarias s ON m.secretaria_id = s.id
      INNER JOIN matter_types mt ON m.matter_type_id = mt.id
      WHERE m.status = 'published'
      ORDER BY m.created_at DESC
      LIMIT 10
    `);
    
    return c.json({
      by_secretaria: mattersBySecretariaResult.rows || [],
      by_type: mattersByTypeResult.rows || [],
      trend: publicationTrendResult.rows || [],
      recent_matters: recentMattersResult.rows || []
    });
    
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return c.json({ error: 'Erro ao buscar análises', details: error.message }, 500);
  }
});

// GET /api/portal/filters - Opções de filtros disponíveis
portal.get('/filters', async (c) => {
  try {
    // Anos disponíveis
    const yearsResult = await db.query(`
      SELECT DISTINCT year FROM editions 
      WHERE status = 'published'
      ORDER BY year DESC
    `);
    
    // Secretarias com publicações
    const secretariasResult = await db.query(`
      SELECT DISTINCT s.acronym, s.name 
      FROM secretarias s
      INNER JOIN matters m ON s.id = m.secretaria_id
      WHERE m.status = 'published'
      ORDER BY s.acronym
    `);
    
    // Tipos de matéria publicados
    const typesResult = await db.query(`
      SELECT DISTINCT mt.name 
      FROM matter_types mt
      INNER JOIN matters m ON mt.id = m.matter_type_id
      WHERE m.status = 'published'
      ORDER BY mt.name
    `);
    
    // Status disponíveis para administradores (no portal público, sempre "published")
    const statuses = [
      { value: 'published', label: 'Publicadas' },
      { value: 'draft', label: 'Rascunhos' },
      { value: 'submitted', label: 'Submetidas' },
      { value: 'approved', label: 'Aprovadas' },
      { value: 'rejected', label: 'Rejeitadas' }
    ];
    
    // Secretarias ativas (mesmo sem publicações ainda)
    const allSecretariasResult = await db.query(`
      SELECT acronym, name 
      FROM secretarias 
      WHERE active = true
      ORDER BY acronym
    `);
    
    // Todos os tipos de matéria (mesmo sem publicações ainda)
    const allTypesResult = await db.query(`
      SELECT name 
      FROM matter_types 
      WHERE active = true
      ORDER BY name
    `);
    
    return c.json({
      years: yearsResult.rows || [],
      secretarias: secretariasResult.rows || [],
      all_secretarias: allSecretariasResult.rows || [],
      types: typesResult.rows || [],
      all_types: allTypesResult.rows || [],
      statuses: statuses
    });
    
  } catch (error: any) {
    console.error('Error fetching filters:', error);
    return c.json({ error: 'Erro ao buscar filtros', details: error.message }, 500);
  }
});

// GET /api/portal/most-searched - Palavras mais pesquisadas (simulado)
portal.get('/most-searched', async (c) => {
  // Em produção, você pode rastrear pesquisas em uma tabela search_logs
  // Por enquanto, retornar termos fixos ou buscar do banco se houver tabela
  
  try {
    // Verificar se existe tabela de logs de busca
    const hasSearchLogsResult = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'search_logs'
      )
    `);
    
    const hasSearchLogs = hasSearchLogsResult.rows[0]?.exists;
    
    if (hasSearchLogs) {
      // Buscar termos mais pesquisados
      const searchTermsResult = await db.query(`
        SELECT 
          query_term as term,
          COUNT(*) as count
        FROM search_logs
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY query_term
        ORDER BY count DESC
        LIMIT 10
      `);
      
      if (searchTermsResult.rows.length > 0) {
        return c.json({ terms: searchTermsResult.rows });
      }
    }
    
    // Retornar termos padrão se não houver tabela ou dados
    const terms = [
      { term: 'Decreto', count: 156 },
      { term: 'Portaria', count: 134 },
      { term: 'Edital', count: 98 },
      { term: 'Licitação', count: 87 },
      { term: 'Concurso', count: 76 },
      { term: 'Contrato', count: 65 },
      { term: 'Nomeação', count: 54 },
      { term: 'Exoneração', count: 43 }
    ];
    
    return c.json({ terms });
    
  } catch (error: any) {
    console.error('Error fetching most searched:', error);
    // Retornar termos fixos em caso de erro
    const terms = [
      { term: 'Decreto', count: 156 },
      { term: 'Portaria', count: 134 },
      { term: 'Edital', count: 98 }
    ];
    return c.json({ terms });
  }
});

// GET /api/portal/secretarias - Lista de secretarias ativas
portal.get('/secretarias', async (c) => {
  try {
    const result = await db.query(`
      SELECT id, name, acronym, email, phone, responsible
      FROM secretarias 
      WHERE active = true
      ORDER BY name
    `);
    
    return c.json({
      secretarias: result.rows || []
    });
    
  } catch (error: any) {
    console.error('Error fetching secretarias:', error);
    return c.json({ error: 'Erro ao buscar secretarias', details: error.message }, 500);
  }
});

// GET /api/portal/years - Anos com publicações
portal.get('/years', async (c) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT year 
      FROM editions 
      WHERE status = 'published'
      ORDER BY year DESC
    `);
    
    const years = result.rows.map(row => row.year);
    
    return c.json({
      years: years
    });
    
  } catch (error: any) {
    console.error('Error fetching years:', error);
    return c.json({ error: 'Erro ao buscar anos', details: error.message }, 500);
  }
});

export default portal;