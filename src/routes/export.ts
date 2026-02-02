// ====================================
// DOM - Export Routes
// Exportação de Dados (CSV/XLS)
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware } from '../middleware/auth';

const exportRoutes = new Hono<HonoContext>();

/**
 * Converte array de objetos para CSV
 */
function convertToCSV(data: any[], headers: string[]): string {
  const headerRow = headers.join(',');
  const rows = data.map(row => {
    return headers.map(header => {
      const value = row[header];
      // Escapar vírgulas e quebras de linha
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });
  
  return [headerRow, ...rows].join('\n');
}

/**
 * Converte array de objetos para HTML tabela (para XLS)
 */
function convertToHTMLTable(data: any[], headers: string[]): string {
  const headerRow = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const rows = data.map(row => {
    return `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`;
  }).join('');
  
  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
    <head>
      <meta charset="utf-8">
      <style>
        table { border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
      </style>
    </head>
    <body>
      <table>
        <thead>${headerRow}</thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `;
}

/**
 * GET /api/export/matters/csv
 * Exporta matérias em CSV
 */
exportRoutes.get('/matters/csv', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    // Secretarias veem apenas suas matérias, admin/semad veem todas
    let query = `
      SELECT 
        m.id,
        m.title,
        m.summary,
        mt.name as tipo,
        s.name as secretaria,
        m.status,
        m.priority,
        u.name as autor,
        m.submission_date as data_envio,
        m.scheduled_date as data_publicacao,
        m.created_at as criado_em
      FROM matters m
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
    `;
    
    if (user.role === 'secretaria') {
      query += ` WHERE m.secretaria_id = ?`;
    }
    
    query += ` ORDER BY m.created_at DESC`;
    
    const { results } = user.role === 'secretaria'
      ? await db.query(query).bind(user.secretaria_id).all()
      : await db.query(query).all();
    
    const csv = convertToCSV(results as any[], [
      'id', 'title', 'summary', 'tipo', 'secretaria', 'status', 
      'priority', 'autor', 'data_envio', 'data_publicacao', 'criado_em'
    ]);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="materias_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    
  } catch (error: any) {
    console.error('Error exporting matters to CSV:', error);
    return c.json({ error: 'Erro ao exportar CSV', details: error.message }, 500);
  }
});

/**
 * GET /api/export/matters/xls
 * Exporta matérias em XLS (HTML table)
 */
exportRoutes.get('/matters/xls', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    
    let query = `
      SELECT 
        m.id,
        m.title,
        m.summary,
        mt.name as tipo,
        s.name as secretaria,
        m.status,
        m.priority,
        u.name as autor,
        m.submission_date as data_envio,
        m.scheduled_date as data_publicacao,
        m.created_at as criado_em
      FROM matters m
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
    `;
    
    if (user.role === 'secretaria') {
      query += ` WHERE m.secretaria_id = ?`;
    }
    
    query += ` ORDER BY m.created_at DESC`;
    
    const { results } = user.role === 'secretaria'
      ? await db.query(query).bind(user.secretaria_id).all()
      : await db.query(query).all();
    
    const html = convertToHTMLTable(results as any[], [
      'id', 'title', 'summary', 'tipo', 'secretaria', 'status', 
      'priority', 'autor', 'data_envio', 'data_publicacao', 'criado_em'
    ]);
    
    return new Response(html, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="materias_${new Date().toISOString().split('T')[0]}.xls"`
      }
    });
    
  } catch (error: any) {
    console.error('Error exporting matters to XLS:', error);
    return c.json({ error: 'Erro ao exportar XLS', details: error.message }, 500);
  }
});

/**
 * GET /api/export/editions/csv
 * Exporta edições em CSV
 */
exportRoutes.get('/editions/csv', authMiddleware, async (c) => {
  try {
    const { results } = await db.query(`
      SELECT 
        e.id,
        e.edition_number as numero,
        e.edition_date as data,
        e.year as ano,
        e.status,
        e.total_pages as paginas,
        COUNT(em.id) as total_materias,
        u.name as publicado_por,
        e.published_at as publicado_em,
        e.created_at as criado_em
      FROM editions e
      LEFT JOIN edition_matters em ON e.id = em.edition_id
      LEFT JOIN users u ON e.published_by = u.id
      GROUP BY e.id
      ORDER BY e.year DESC, e.edition_number DESC
    `).all();
    
    const csv = convertToCSV(results as any[], [
      'id', 'numero', 'data', 'ano', 'status', 'paginas', 
      'total_materias', 'publicado_por', 'publicado_em', 'criado_em'
    ]);
    
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="edicoes_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    
  } catch (error: any) {
    console.error('Error exporting editions to CSV:', error);
    return c.json({ error: 'Erro ao exportar CSV', details: error.message }, 500);
  }
});

/**
 * GET /api/export/editions/xls
 * Exporta edições em XLS
 */
exportRoutes.get('/editions/xls', authMiddleware, async (c) => {
  try {
    const { results } = await db.query(`
      SELECT 
        e.id,
        e.edition_number as numero,
        e.edition_date as data,
        e.year as ano,
        e.status,
        e.total_pages as paginas,
        COUNT(em.id) as total_materias,
        u.name as publicado_por,
        e.published_at as publicado_em,
        e.created_at as criado_em
      FROM editions e
      LEFT JOIN edition_matters em ON e.id = em.edition_id
      LEFT JOIN users u ON e.published_by = u.id
      GROUP BY e.id
      ORDER BY e.year DESC, e.edition_number DESC
    `).all();
    
    const html = convertToHTMLTable(results as any[], [
      'id', 'numero', 'data', 'ano', 'status', 'paginas', 
      'total_materias', 'publicado_por', 'publicado_em', 'criado_em'
    ]);
    
    return new Response(html, {
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': `attachment; filename="edicoes_${new Date().toISOString().split('T')[0]}.xls"`
      }
    });
    
  } catch (error: any) {
    console.error('Error exporting editions to XLS:', error);
    return c.json({ error: 'Erro ao exportar XLS', details: error.message }, 500);
  }
});

export default exportRoutes;
