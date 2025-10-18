// ====================================
// DOM - Settings Routes
// Configurações do Sistema
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';

const settings = new Hono<HonoContext>();

// Aplicar autenticação em todas as rotas de settings (exceto logo público)
settings.use('/*', async (c, next) => {
  // Logo é público - não requer autenticação
  if (c.req.path.endsWith('/logo')) {
    return await next();
  }
  return await authMiddleware(c, next);
});

/**
 * GET /api/settings
 * Lista todas as configurações
 */
settings.get('/', requireRole('admin'), async (c) => {
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT * FROM system_settings ORDER BY key
    `).all();
    
    return c.json({ settings: results });
    
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return c.json({ error: 'Erro ao buscar configurações', details: error.message }, 500);
  }
});

/**
 * GET /api/settings/:key
 * Busca uma configuração específica
 */
settings.get('/:key', requireRole('admin'), async (c) => {
  try {
    const key = c.req.param('key');
    
    const setting = await c.env.DB.prepare(
      'SELECT * FROM system_settings WHERE key = ?'
    ).bind(key).first();
    
    if (!setting) {
      return c.json({ error: 'Configuração não encontrada' }, 404);
    }
    
    return c.json({ setting });
    
  } catch (error: any) {
    console.error('Error fetching setting:', error);
    return c.json({ error: 'Erro ao buscar configuração', details: error.message }, 500);
  }
});

/**
 * PUT /api/settings/:key
 * Atualiza uma configuração
 */
settings.put('/:key', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const key = c.req.param('key');
    const { value, description } = await c.req.json();
    
    // Verificar se existe
    const existing = await c.env.DB.prepare(
      'SELECT * FROM system_settings WHERE key = ?'
    ).bind(key).first();
    
    if (!existing) {
      return c.json({ error: 'Configuração não encontrada' }, 404);
    }
    
    // Validar tipo do valor
    if (existing.value_type === 'boolean' && typeof value !== 'boolean') {
      return c.json({ error: 'Valor deve ser booleano (true/false)' }, 400);
    }
    
    if (existing.value_type === 'number' && typeof value !== 'number') {
      return c.json({ error: 'Valor deve ser numérico' }, 400);
    }
    
    await c.env.DB.prepare(`
      UPDATE system_settings 
      SET value = ?,
          description = ?,
          updated_at = datetime('now'),
          updated_by = ?
      WHERE key = ?
    `).bind(
      JSON.stringify(value),
      description || existing.description,
      user.id,
      key
    ).run();
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await c.env.DB.prepare(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      user.id,
      'system_setting',
      key,
      'update',
      existing.value,
      JSON.stringify(value),
      ipAddress,
      userAgent
    ).run();
    
    return c.json({ message: 'Configuração atualizada com sucesso' });
    
  } catch (error: any) {
    console.error('Error updating setting:', error);
    return c.json({ error: 'Erro ao atualizar configuração', details: error.message }, 500);
  }
});

/**
 * POST /api/settings
 * Cria nova configuração (apenas admin)
 */
settings.post('/', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const { category, key, value, value_type, description } = await c.req.json();
    
    if (!category || !key || value === undefined) {
      return c.json({ error: 'Categoria, chave e valor são obrigatórios' }, 400);
    }
    
    // Verificar se já existe
    const existing = await c.env.DB.prepare(
      'SELECT id FROM system_settings WHERE key = ?'
    ).bind(key).first();
    
    if (existing) {
      return c.json({ error: 'Configuração já existe' }, 400);
    }
    
    await c.env.DB.prepare(`
      INSERT INTO system_settings (
        category, key, value, value_type, description,
        created_at, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `).bind(
      category,
      key,
      JSON.stringify(value),
      value_type || 'string',
      description || null,
      user.id
    ).run();
    
    return c.json({ message: 'Configuração criada com sucesso' }, 201);
    
  } catch (error: any) {
    console.error('Error creating setting:', error);
    return c.json({ error: 'Erro ao criar configuração', details: error.message }, 500);
  }
});

/**
 * POST /api/settings/logo/upload
 * Upload da logo da prefeitura
 */
settings.post('/logo/upload', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const formData = await c.req.formData();
    const logoFile = formData.get('logo') as File;
    
    if (!logoFile) {
      return c.json({ error: 'Arquivo de logo não fornecido' }, 400);
    }
    
    // Validar tipo de arquivo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
    if (!allowedTypes.includes(logoFile.type)) {
      return c.json({ error: 'Tipo de arquivo inválido. Use PNG, JPG ou SVG' }, 400);
    }
    
    // Converter para base64
    const arrayBuffer = await logoFile.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const dataUrl = `data:${logoFile.type};base64,${base64}`;
    
    // Salvar nas configurações
    await c.env.DB.prepare(`
      INSERT INTO system_settings (category, key, value, value_type, description, created_at, updated_at, updated_by)
      VALUES ('branding', 'logo_url', ?, 'string', 'Logo da Prefeitura (Base64)', datetime('now'), datetime('now'), ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now'),
        updated_by = excluded.updated_by
    `).bind(dataUrl, user.id).run();
    
    return c.json({ 
      message: 'Logo enviada com sucesso',
      logo_url: dataUrl.substring(0, 100) + '...' // Retornar só início para feedback
    });
    
  } catch (error: any) {
    console.error('Error uploading logo:', error);
    return c.json({ error: 'Erro ao enviar logo', details: error.message }, 500);
  }
});

/**
 * GET /api/settings/logo
 * Retorna a logo atual (público - sem auth)
 */
settings.get('/logo', async (c) => {
  try {
    const logo = await c.env.DB.prepare(
      "SELECT value FROM system_settings WHERE key = 'logo_url'"
    ).first();
    
    if (!logo || !logo.value) {
      // Retornar logo padrão (brasão fornecido)
      return c.json({ 
        logo_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHRleHQ+TE9HTzwvdGV4dD48L3N2Zz4='
      });
    }
    
    const logoUrl = JSON.parse(logo.value as string);
    return c.json({ logo_url: logoUrl });
    
  } catch (error: any) {
    console.error('Error fetching logo:', error);
    return c.json({ error: 'Erro ao buscar logo', details: error.message }, 500);
  }
});

export default settings;
