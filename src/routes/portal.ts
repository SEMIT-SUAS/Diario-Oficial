// ====================================
// Portal Routes - Public API endpoints
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';

const portal = new Hono<HonoContext>();

// GET /api/portal/stats - Estatísticas gerais do portal
portal.get('/stats', async (c) => {
  try {
    const { DB } = c.env;
    
    // Total de edições publicadas
    const totalEditionsResult = await DB.prepare(`
      SELECT COUNT(*) as count FROM editions 
      WHERE status = 'published'
    `).first();
    
    // Total de matérias publicadas
    const totalMattersResult = await DB.prepare(`
      SELECT COUNT(*) as count FROM matters 
      WHERE status = 'published'
    `).first();
    
    // Publicações deste mês
    const thisMonthResult = await DB.prepare(`
      SELECT COUNT(*) as count FROM editions 
      WHERE status = 'published' 
      AND strftime('%Y-%m', edition_date) = strftime('%Y-%m', 'now')
    `).first();
    
    return c.json({
      total_editions: totalEditionsResult?.count || 0,
      total_matters: totalMattersResult?.count || 0,
      this_month: thisMonthResult?.count || 0
    });
    
  } catch (error) {
    console.error('Error fetching portal stats:', error);
    return c.json({ error: 'Erro ao buscar estatísticas' }, 500);
  }
});

// GET /api/portal/editions - Últimas edições publicadas
portal.get('/editions', async (c) => {
  try {
    const { DB } = c.env;
    const limit = parseInt(c.req.query('limit') || '10');
    
    // Buscar últimas edições publicadas com contagem de matérias
    const editions = await DB.prepare(`
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
      LIMIT ?
    `).bind(limit).all();
    
    return c.json({
      editions: editions.results || []
    });
    
  } catch (error) {
    console.error('Error fetching portal editions:', error);
    return c.json({ error: 'Erro ao buscar edições' }, 500);
  }
});

// GET /api/portal/search - Pesquisa pública de publicações
portal.get('/search', async (c) => {
  try {
    const { DB } = c.env;
    const query = c.req.query('q') || '';
    const limit = parseInt(c.req.query('limit') || '20');
    
    if (!query || query.trim().length < 3) {
      return c.json({ 
        results: [],
        message: 'Digite pelo menos 3 caracteres para pesquisar'
      });
    }
    
    // Pesquisar em matérias publicadas
    const searchPattern = `%${query.trim()}%`;
    const results = await DB.prepare(`
      SELECT 
        m.id,
        m.title,
        m.content,
        m.created_at,
        s.name as secretaria_name,
        mt.name as matter_type_name,
        e.edition_number,
        e.year as edition_year
      FROM matters m
      INNER JOIN secretarias s ON m.secretaria_id = s.id
      INNER JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN edition_matters em ON m.id = em.matter_id
      LEFT JOIN editions e ON em.edition_id = e.id
      WHERE m.status = 'published'
      AND (m.title LIKE ? OR m.content LIKE ?)
      ORDER BY m.created_at DESC
      LIMIT ?
    `).bind(searchPattern, searchPattern, limit).all();
    
    return c.json({
      results: results.results || [],
      count: results.results?.length || 0,
      query: query
    });
    
  } catch (error) {
    console.error('Error searching portal:', error);
    return c.json({ error: 'Erro ao pesquisar publicações' }, 500);
  }
});

// GET /api/portal/analytics - Estatísticas avançadas
portal.get('/analytics', async (c) => {
  try {
    const { DB } = c.env;
    
    // Matérias por secretaria
    const mattersBySecretaria = await DB.prepare(`
      SELECT 
        s.acronym,
        s.name,
        COUNT(m.id) as count
      FROM secretarias s
      LEFT JOIN matters m ON s.id = m.secretaria_id AND m.status = 'published'
      GROUP BY s.id
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    // Tipos de matéria mais publicados
    const mattersByType = await DB.prepare(`
      SELECT 
        mt.name,
        COUNT(m.id) as count
      FROM matter_types mt
      LEFT JOIN matters m ON mt.id = m.matter_type_id AND m.status = 'published'
      GROUP BY mt.id
      ORDER BY count DESC
      LIMIT 10
    `).all();
    
    // Tendência de publicações (últimos 6 meses)
    const publicationTrend = await DB.prepare(`
      SELECT 
        strftime('%Y-%m', e.edition_date) as month,
        COUNT(DISTINCT e.id) as editions,
        COUNT(m.id) as matters
      FROM editions e
      LEFT JOIN edition_matters em ON e.id = em.edition_id
      LEFT JOIN matters m ON em.matter_id = m.id
      WHERE e.status = 'published'
      AND e.edition_date >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month ASC
    `).all();
    
    return c.json({
      by_secretaria: mattersBySecretaria.results || [],
      by_type: mattersByType.results || [],
      trend: publicationTrend.results || []
    });
    
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return c.json({ error: 'Erro ao buscar análises' }, 500);
  }
});

// GET /api/portal/most-searched - Palavras mais pesquisadas (simulado)
portal.get('/most-searched', async (c) => {
  // Por enquanto, retornar termos fixos
  // Em produção, você pode rastrear pesquisas em uma tabela search_logs
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
});

export default portal;
