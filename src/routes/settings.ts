// ====================================
// DOM - Settings Routes
// Configurações do Sistema
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';

const settings = new Hono<HonoContext>();

/**
 * GET /api/settings/logo
 * Retorna a logo atual (público - sem auth)
 * IMPORTANTE: Deve vir ANTES do middleware de autenticação
 */
settings.get('/logo', async (c) => {
  try {
    const logo = await db.query(
      "SELECT value FROM system_settings WHERE key = 'logo_url'"
    ).first();
    
    if (!logo || !logo.value) {
      // Retornar logo padrão (brasão fornecido)
      return c.json({ 
        logo_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHRleHQ+TE9HTzwvdGV4dD48L3N2Zz4='
      });
    }
    
    // O valor já está como data URL string, não precisa de JSON.parse
    return c.json({ logo_url: logo.value as string });
    
  } catch (error: any) {
    console.error('Error fetching logo:', error);
    return c.json({ error: 'Erro ao buscar logo', details: error.message }, 500);
  }
});

// Aplicar autenticação em TODAS as outras rotas de settings
settings.use('/*', authMiddleware);

/**
 * GET /api/settings
 * Lista todas as configurações
 */
settings.get('/', requireRole('admin'), async (c) => {
  try {
    const { results } = await db.query(`
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
    
    const setting = await db.query(
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
    const existing = await db.query(
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
    
    await db.query(`
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
    
    await db.query(`
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
    const { key, value, description } = await c.req.json();
    
    if (!key || value === undefined) {
      return c.json({ error: 'Chave e valor são obrigatórios' }, 400);
    }
    
    // Verificar se já existe
    const existing = await db.query(
      'SELECT id FROM system_settings WHERE key = ?'
    ).bind(key).first();
    
    if (existing) {
      return c.json({ error: 'Configuração já existe' }, 400);
    }
    
    await db.query(`
      INSERT INTO system_settings (
        key, value, description, updated_at, updated_by
      ) VALUES (?, ?, ?, datetime('now'), ?)
    `).bind(
      key,
      JSON.stringify(value),
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
    await db.query(`
      INSERT INTO system_settings (key, value, description, updated_at, updated_by)
      VALUES ('logo_url', ?, 'Logo da Prefeitura (Base64)', datetime('now'), ?)
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
 * POST /api/settings/bulk
 * Atualiza múltiplas configurações de uma vez
 */
settings.post('/bulk', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    const { settings: settingsToUpdate } = await c.req.json();
    
    if (!Array.isArray(settingsToUpdate) || settingsToUpdate.length === 0) {
      return c.json({ error: 'Array de configurações é obrigatório' }, 400);
    }
    
    // Atualizar cada configuração
    let updated = 0;
    let errors = [];
    
    for (const setting of settingsToUpdate) {
      const { key, value } = setting;
      
      if (!key || value === undefined) {
        errors.push({ key: key || 'unknown', error: 'Chave e valor são obrigatórios' });
        continue;
      }
      
      try {
        // Verificar se existe
        const existing = await db.query(
          'SELECT * FROM system_settings WHERE key = ?'
        ).bind(key).first();
        
        if (existing) {
          // Atualizar existente
          await db.query(`
            UPDATE system_settings 
            SET value = ?,
                updated_at = datetime('now'),
                updated_by = ?
            WHERE key = ?
          `).bind(
            JSON.stringify(value),
            user.id,
            key
          ).run();
          updated++;
        } else {
          // Criar novo se não existe
          await db.query(`
            INSERT INTO system_settings (key, value, updated_at, updated_by)
            VALUES (?, ?, datetime('now'), ?)
          `).bind(
            key,
            JSON.stringify(value),
            user.id
          ).run();
          updated++;
        }
      } catch (err: any) {
        errors.push({ key, error: err.message });
      }
    }
    
    return c.json({ 
      message: `${updated} configuração(ões) atualizada(s) com sucesso`,
      updated,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (error: any) {
    console.error('Error bulk updating settings:', error);
    return c.json({ error: 'Erro ao atualizar configurações', details: error.message }, 500);
  }
});

export default settings;
