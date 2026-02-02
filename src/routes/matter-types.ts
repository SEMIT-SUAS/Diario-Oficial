// ====================================
// DOM - Matter Types Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext, MatterType } from '../types';

const matterTypes = new Hono<HonoContext>();

/**
 * GET /api/matter-types
 * Lista tipos de matéria ativos
 */
matterTypes.get('/', async (c) => {
  try {
    const result = await db.query
      .prepare('SELECT * FROM matter_types WHERE active = 1 ORDER BY order_position ASC')
      .all<MatterType>();
    
    return c.json({ matterTypes: result.results });
    
  } catch (error) {
    console.error('List matter types error:', error);
    return c.json({ error: 'Erro ao listar tipos de matéria' }, 500);
  }
});

/**
 * POST /api/matter-types
 * Cria novo tipo de matéria (admin)
 */
matterTypes.post('/', async (c) => {
  try {
    const { name, description, icon, color, order_position } = await c.req.json();
    
    if (!name) {
      return c.json({ error: 'Nome é obrigatório' }, 400);
    }
    
    const result = await db.query
      .prepare(`
        INSERT INTO matter_types (name, description, icon, color, order_position, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(name, description || null, icon || null, color || null, order_position || 0)
      .run();
    
    return c.json({
      message: 'Tipo de matéria criado com sucesso',
      id: result.meta.last_row_id
    }, 201);
    
  } catch (error) {
    console.error('Create matter type error:', error);
    return c.json({ error: 'Erro ao criar tipo de matéria' }, 500);
  }
});

/**
 * PUT /api/matter-types/:id
 * Atualiza tipo de matéria (admin)
 */
matterTypes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, description, icon, color, order_position, active } = await c.req.json();
    
    await db.query
      .prepare(`
        UPDATE matter_types 
        SET name = ?, description = ?, icon = ?, color = ?, order_position = ?, active = ?
        WHERE id = ?
      `)
      .bind(name, description || null, icon || null, color || null, order_position, active, id)
      .run();
    
    return c.json({ message: 'Tipo de matéria atualizado com sucesso' });
    
  } catch (error) {
    console.error('Update matter type error:', error);
    return c.json({ error: 'Erro ao atualizar tipo de matéria' }, 500);
  }
});

export default matterTypes;
