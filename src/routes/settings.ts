// ====================================
// DOM - Settings Routes
// Configurações do Sistema
// ====================================

import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db'; // Importe a conexão PostgreSQL

const settings = new Hono<HonoContext>();

/**
 * GET /api/settings/logo
 * Retorna a logo atual (público - sem auth)
 * IMPORTANTE: Deve vir ANTES do middleware de autenticação
 */
settings.get('/logo', async (c) => {
  try {
    const result = await db.query(
      "SELECT value FROM system_settings WHERE key = 'logo_url'"
    );
    
    const logo = result.rows[0];
    
    if (!logo || !logo.value) {
      // Retornar logo padrão (brasão fornecido)
      return c.json({ 
        logo_url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCI+PHRleHQ+TE9HTzwvdGV4dD48L3N2Zz4='
      });
    }
    
    // O valor já está como string, não precisa de JSON.parse
    return c.json({ logo_url: logo.value as string });
    
  } catch (error: any) {
    console.error('Error fetching logo:', error);
    return c.json({ error: 'Erro ao buscar logo', details: error.message }, 500);
  }
});

/**
 * GET /api/settings/favicon
 * Retorna o favicon atual (público - sem auth)
 */
settings.get('/favicon', async (c) => {
  try {
    const result = await db.query(
      "SELECT value FROM system_settings WHERE key = 'favicon_url'"
    );
    
    const favicon = result.rows[0];
    
    if (!favicon || !favicon.value) {
      // Retornar favicon padrão
      return c.json({ 
        favicon_url: null
      });
    }
    
    return c.json({ favicon_url: favicon.value as string });
    
  } catch (error: any) {
    console.error('Error fetching favicon:', error);
    return c.json({ error: 'Erro ao buscar favicon', details: error.message }, 500);
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
    const result = await db.query(`
      SELECT * FROM system_settings ORDER BY key
    `);
    
    // Converter valores de string JSON para objetos quando necessário
    const settings = result.rows.map(row => {
      try {
        // Tenta parsear JSON, se falhar retorna como string
        return {
          ...row,
          value: row.value ? (row.value.startsWith('{') || row.value.startsWith('[') ? JSON.parse(row.value) : row.value) : null
        };
      } catch (e) {
        return row;
      }
    });
    
    return c.json({ settings });
    
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
    
    const result = await db.query(
      'SELECT * FROM system_settings WHERE key = $1',
      [key]
    );
    
    const setting = result.rows[0];
    
    if (!setting) {
      return c.json({ error: 'Configuração não encontrada' }, 404);
    }
    
    // Converter valor de JSON se necessário
    try {
      setting.value = setting.value ? (setting.value.startsWith('{') || setting.value.startsWith('[') ? JSON.parse(setting.value) : setting.value) : null;
    } catch (e) {
      // Manter como string se não for JSON válido
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const key = c.req.param('key');
    const { value, description } = await c.req.json();
    
    // Verificar se existe
    const existingResult = await db.query(
      'SELECT * FROM system_settings WHERE key = $1',
      [key]
    );
    
    const existing = existingResult.rows[0];
    
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
    
    // Converter valor para string (JSON se for objeto/array)
    const valueToStore = typeof value === 'object' || Array.isArray(value) 
      ? JSON.stringify(value) 
      : String(value);
    
    await db.query(`
      UPDATE system_settings 
      SET value = $1,
          description = COALESCE($2, description),
          updated_at = NOW(),
          updated_by = $3
      WHERE key = $4
    `, [
      valueToStore,
      description,
      user.id,
      key
    ]);
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, new_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      user.id,
      'system_setting',
      key,
      'update',
      existing.value,
      valueToStore,
      ipAddress,
      userAgent
    ]);
    
    return c.json({ 
      message: 'Configuração atualizada com sucesso',
      value: value
    });
    
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { key, value, description, value_type = 'string' } = await c.req.json();
    
    if (!key || value === undefined) {
      return c.json({ error: 'Chave e valor são obrigatórios' }, 400);
    }
    
    // Validar value_type
    const validTypes = ['string', 'boolean', 'number', 'json'];
    if (!validTypes.includes(value_type)) {
      return c.json({ error: 'Tipo de valor inválido. Use: string, boolean, number, json' }, 400);
    }
    
    // Verificar se já existe
    const existingResult = await db.query(
      'SELECT id FROM system_settings WHERE key = $1',
      [key]
    );
    
    if (existingResult.rows.length > 0) {
      return c.json({ error: 'Configuração já existe' }, 400);
    }
    
    // Converter valor para string (JSON se for objeto/array)
    const valueToStore = typeof value === 'object' || Array.isArray(value) 
      ? JSON.stringify(value) 
      : String(value);
    
    await db.query(`
      INSERT INTO system_settings (
        key, value, value_type, description, updated_at, updated_by
      ) VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      key,
      valueToStore,
      value_type,
      description || null,
      user.id
    ]);
    
    return c.json({ 
      message: 'Configuração criada com sucesso',
      key: key
    }, 201);
    
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
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const formData = await c.req.formData();
    const logoFile = formData.get('logo') as File;
    
    if (!logoFile) {
      return c.json({ error: 'Arquivo de logo não fornecido' }, 400);
    }
    
    // Validar tipo de arquivo
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/gif'];
    if (!allowedTypes.includes(logoFile.type)) {
      return c.json({ error: 'Tipo de arquivo inválido. Use PNG, JPG, GIF ou SVG' }, 400);
    }
    
    // Validar tamanho (máximo 2MB)
    if (logoFile.size > 2 * 1024 * 1024) {
      return c.json({ error: 'Arquivo muito grande. Tamanho máximo: 2MB' }, 400);
    }
    
    // Converter para base64
    const arrayBuffer = await logoFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${logoFile.type};base64,${base64}`;
    
    // Salvar nas configurações usando UPSERT
    await db.query(`
      INSERT INTO system_settings (key, value, value_type, description, updated_at, updated_by)
      VALUES ($1, $2, 'string', 'Logo da Prefeitura (Base64)', NOW(), $3)
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `, ['logo_url', dataUrl, user.id]);
    
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
 * POST /api/settings/favicon/upload
 * Upload do favicon da prefeitura
 */
settings.post('/favicon/upload', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const formData = await c.req.formData();
    const faviconFile = formData.get('favicon') as File;
    
    if (!faviconFile) {
      return c.json({ error: 'Arquivo de favicon não fornecido' }, 400);
    }
    
    // Validar tipo de arquivo (favicon geralmente é .ico, mas pode ser PNG)
    const allowedTypes = ['image/x-icon', 'image/vnd.microsoft.icon', 'image/png', 'image/svg+xml'];
    if (!allowedTypes.includes(faviconFile.type)) {
      return c.json({ error: 'Tipo de arquivo inválido. Use ICO, PNG ou SVG' }, 400);
    }
    
    // Validar tamanho (máximo 100KB para favicon)
    if (faviconFile.size > 100 * 1024) {
      return c.json({ error: 'Arquivo muito grande. Tamanho máximo: 100KB' }, 400);
    }
    
    // Converter para base64
    const arrayBuffer = await faviconFile.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl = `data:${faviconFile.type};base64,${base64}`;
    
    // Salvar nas configurações usando UPSERT
    await db.query(`
      INSERT INTO system_settings (key, value, value_type, description, updated_at, updated_by)
      VALUES ($1, $2, 'string', 'Favicon da Prefeitura (Base64)', NOW(), $3)
      ON CONFLICT(key) DO UPDATE SET
        value = EXCLUDED.value,
        updated_at = NOW(),
        updated_by = EXCLUDED.updated_by
    `, ['favicon_url', dataUrl, user.id]);
    
    return c.json({ 
      message: 'Favicon enviado com sucesso',
      favicon_url: dataUrl.substring(0, 100) + '...'
    });
    
  } catch (error: any) {
    console.error('Error uploading favicon:', error);
    return c.json({ error: 'Erro ao enviar favicon', details: error.message }, 500);
  }
});

/**
 * POST /api/settings/bulk
 * Atualiza múltiplas configurações de uma vez
 */
settings.post('/bulk', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const { settings: settingsToUpdate } = await c.req.json();
    
    if (!Array.isArray(settingsToUpdate) || settingsToUpdate.length === 0) {
      return c.json({ error: 'Array de configurações é obrigatório' }, 400);
    }
    
    // Atualizar cada configuração
    let updated = 0;
    let errors: { key: string; error: string }[] = [];
    
    for (const setting of settingsToUpdate) {
      const { key, value } = setting;
      
      if (!key || value === undefined) {
        errors.push({ key: key || 'unknown', error: 'Chave e valor são obrigatórios' });
        continue;
      }
      
      try {
        // Converter valor para string (JSON se for objeto/array)
        const valueToStore = typeof value === 'object' || Array.isArray(value) 
          ? JSON.stringify(value) 
          : String(value);
        
        // Usar UPSERT (INSERT ... ON CONFLICT ...)
        await db.query(`
          INSERT INTO system_settings (key, value, updated_at, updated_by)
          VALUES ($1, $2, NOW(), $3)
          ON CONFLICT(key) DO UPDATE SET
            value = EXCLUDED.value,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        `, [key, valueToStore, user.id]);
        
        updated++;
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

/**
 * DELETE /api/settings/:key
 * Remove uma configuração
 */
settings.delete('/:key', requireRole('admin'), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Usuário não autenticado' }, 401);
    }
    
    const key = c.req.param('key');
    
    // Verificar se existe
    const existingResult = await db.query(
      'SELECT * FROM system_settings WHERE key = $1',
      [key]
    );
    
    const existing = existingResult.rows[0];
    
    if (!existing) {
      return c.json({ error: 'Configuração não encontrada' }, 404);
    }
    
    // Verificar se é uma configuração protegida
    const protectedSettings = ['logo_url', 'favicon_url', 'system_name', 'system_version'];
    if (protectedSettings.includes(key)) {
      return c.json({ error: 'Esta configuração não pode ser removida' }, 400);
    }
    
    await db.query('DELETE FROM system_settings WHERE key = $1', [key]);
    
    // Audit log
    const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    
    await db.query(`
      INSERT INTO audit_logs (
        user_id, entity_type, entity_id, action,
        old_values, ip_address, user_agent, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    `, [
      user.id,
      'system_setting',
      key,
      'delete',
      existing.value,
      ipAddress,
      userAgent
    ]);
    
    return c.json({ message: 'Configuração removida com sucesso' });
    
  } catch (error: any) {
    console.error('Error deleting setting:', error);
    return c.json({ error: 'Erro ao remover configuração', details: error.message }, 500);
  }
});

export default settings;