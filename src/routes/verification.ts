// ====================================
// DOM - Verification Routes
// Verificação de Autenticidade
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { validateEditionHash } from '../utils/pdf-generator';
import { hashPassword } from '../utils/auth';

const verification = new Hono<HonoContext>();

/**
 * POST /api/verification/edition
 * Verifica autenticidade de uma edição pelo hash
 */
verification.post('/edition', async (c) => {
  try {
    const { edition_number, year, hash } = await c.req.json();
    
    if (!edition_number || !year || !hash) {
      return c.json({ 
        error: 'Parâmetros obrigatórios: edition_number, year, hash' 
      }, 400);
    }
    
    // Buscar edição pelo número e ano
    const edition = await c.env.DB.prepare(`
      SELECT * FROM editions 
      WHERE edition_number = ? AND year = ? AND status = 'published'
    `).bind(edition_number, parseInt(year)).first();
    
    if (!edition) {
      return c.json({ 
        valid: false,
        message: 'Edição não encontrada ou não publicada'
      });
    }
    
    // Verificar se o hash bate
    const isValid = edition.pdf_hash === hash;
    
    // Buscar matérias da edição
    const { results: matters } = await c.env.DB.prepare(`
      SELECT 
        m.id, m.title, m.matter_type_id,
        mt.name as matter_type_name,
        s.acronym as secretaria_acronym,
        u.name as author_name,
        m.published_at
      FROM edition_matters em
      INNER JOIN matters m ON em.matter_id = m.id
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
      WHERE em.edition_id = ?
      ORDER BY em.display_order ASC
    `).bind(edition.id).all();
    
    return c.json({
      valid: isValid,
      message: isValid 
        ? 'Documento autêntico e íntegro' 
        : 'Hash não corresponde - documento pode ter sido adulterado',
      edition: {
        edition_number: edition.edition_number,
        year: edition.year,
        edition_date: edition.edition_date,
        published_at: edition.published_at,
        total_pages: edition.total_pages,
        matter_count: matters.length,
        pdf_url: edition.pdf_url
      },
      matters: isValid ? matters : undefined
    });
    
  } catch (error: any) {
    console.error('Error verifying edition:', error);
    return c.json({ 
      error: 'Erro ao verificar edição', 
      details: error.message 
    }, 500);
  }
});

/**
 * POST /api/verification/matter-signature
 * Verifica assinatura eletrônica de uma matéria
 */
verification.post('/matter-signature', async (c) => {
  try {
    const { matter_id, signature_hash } = await c.req.json();
    
    if (!matter_id || !signature_hash) {
      return c.json({ 
        error: 'Parâmetros obrigatórios: matter_id, signature_hash' 
      }, 400);
    }
    
    // Buscar matéria
    const matter = await c.env.DB.prepare(`
      SELECT 
        m.*,
        mt.name as matter_type_name,
        s.name as secretaria_name,
        s.acronym as secretaria_acronym,
        u.name as author_name,
        signer.name as signer_name
      FROM matters m
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      LEFT JOIN users u ON m.author_id = u.id
      LEFT JOIN users signer ON m.signed_by = signer.id
      WHERE m.id = ?
    `).bind(parseInt(matter_id)).first();
    
    if (!matter) {
      return c.json({ 
        valid: false,
        message: 'Matéria não encontrada'
      });
    }
    
    // Verificar se foi assinada
    if (!matter.signed_at || !matter.signature_hash) {
      return c.json({ 
        valid: false,
        message: 'Matéria não possui assinatura eletrônica'
      });
    }
    
    // Verificar se o hash bate
    const isValid = matter.signature_hash === signature_hash;
    
    return c.json({
      valid: isValid,
      message: isValid 
        ? 'Assinatura válida e autêntica' 
        : 'Assinatura inválida - documento pode ter sido modificado',
      matter: {
        id: matter.id,
        title: matter.title,
        matter_type: matter.matter_type_name,
        secretaria: matter.secretaria_name,
        author: matter.author_name,
        signed_by: matter.signer_name,
        signed_at: matter.signed_at,
        status: matter.status
      }
    });
    
  } catch (error: any) {
    console.error('Error verifying matter signature:', error);
    return c.json({ 
      error: 'Erro ao verificar assinatura', 
      details: error.message 
    }, 500);
  }
});

/**
 * GET /api/verification/edition/:edition_number/:year
 * Busca informações de uma edição para verificação
 */
verification.get('/edition/:edition_number/:year', async (c) => {
  try {
    const edition_number = c.req.param('edition_number');
    const year = parseInt(c.req.param('year'));
    
    const edition = await c.env.DB.prepare(`
      SELECT 
        e.*,
        publisher.name as published_by_name
      FROM editions e
      LEFT JOIN users publisher ON e.published_by = publisher.id
      WHERE e.edition_number = ? AND e.year = ? AND e.status = 'published'
    `).bind(edition_number, year).first();
    
    if (!edition) {
      return c.json({ error: 'Edição não encontrada' }, 404);
    }
    
    // Buscar matérias
    const { results: matters } = await c.env.DB.prepare(`
      SELECT 
        m.id, m.title, m.signature_hash, m.signed_at,
        mt.name as matter_type_name,
        s.acronym as secretaria_acronym
      FROM edition_matters em
      INNER JOIN matters m ON em.matter_id = m.id
      LEFT JOIN matter_types mt ON m.matter_type_id = mt.id
      LEFT JOIN secretarias s ON m.secretaria_id = s.id
      WHERE em.edition_id = ?
      ORDER BY em.display_order ASC
    `).bind(edition.id).all();
    
    return c.json({
      edition: {
        edition_number: edition.edition_number,
        year: edition.year,
        edition_date: edition.edition_date,
        published_at: edition.published_at,
        published_by: edition.published_by_name,
        total_pages: edition.total_pages,
        pdf_hash: edition.pdf_hash,
        pdf_url: edition.pdf_url
      },
      matters
    });
    
  } catch (error: any) {
    console.error('Error fetching edition for verification:', error);
    return c.json({ 
      error: 'Erro ao buscar edição', 
      details: error.message 
    }, 500);
  }
});

export default verification;
