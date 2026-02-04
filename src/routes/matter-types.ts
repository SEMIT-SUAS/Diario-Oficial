// ====================================
// DOM - Matter Types Routes
// ====================================

import { Hono } from 'hono';
import { HonoContext, MatterType } from '../types';
import db from '../lib/db'; // Importe a conexão PostgreSQL

const matterTypes = new Hono<HonoContext>();

/**
 * GET /api/matter-types
 * Lista tipos de matéria ativos
 */
matterTypes.get('/', async (c) => {
  try {
    const result = await db.query(
      'SELECT * FROM matter_types WHERE active = 1 ORDER BY order_position ASC'
    );
    
    return c.json({ matterTypes: result.rows });
    
  } catch (error: any) {
    console.error('List matter types error:', error);
    return c.json({ error: 'Erro ao listar tipos de matéria' }, 500);
  }
});

/**
 * GET /api/matter-types/all
 * Lista todos os tipos de matéria (incluindo inativos - admin)
 */
matterTypes.get('/all', async (c) => {
  try {
    const result = await db.query(
      'SELECT * FROM matter_types ORDER BY order_position ASC'
    );
    
    return c.json({ matterTypes: result.rows });
    
  } catch (error: any) {
    console.error('List all matter types error:', error);
    return c.json({ error: 'Erro ao listar tipos de matéria' }, 500);
  }
});

/**
 * GET /api/matter-types/:id
 * Busca um tipo de matéria específico
 */
matterTypes.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    const result = await db.query(
      'SELECT * FROM matter_types WHERE id = $1',
      [id]
    );
    
    const matterType = result.rows[0];
    
    if (!matterType) {
      return c.json({ error: 'Tipo de matéria não encontrado' }, 404);
    }
    
    return c.json({ matterType });
    
  } catch (error: any) {
    console.error('Get matter type error:', error);
    return c.json({ error: 'Erro ao buscar tipo de matéria' }, 500);
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
    
    const result = await db.query(`
      INSERT INTO matter_types (name, description, icon, color, order_position, active, created_at)
      VALUES ($1, $2, $3, $4, $5, true, NOW())
      RETURNING id
    `, [
      name, 
      description || null, 
      icon || null, 
      color || null, 
      order_position || 0
    ]);
    
    return c.json({
      message: 'Tipo de matéria criado com sucesso',
      id: result.rows[0].id
    }, 201);
    
  } catch (error: any) {
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
    const id = parseInt(c.req.param('id'));
    const { name, description, icon, color, order_position, active } = await c.req.json();
    
    // Verificar se tipo de matéria existe
    const existingResult = await db.query(
      'SELECT id FROM matter_types WHERE id = $1',
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      return c.json({ error: 'Tipo de matéria não encontrado' }, 404);
    }
    
    await db.query(`
      UPDATE matter_types 
      SET name = $1, 
          description = $2, 
          icon = $3, 
          color = $4, 
          order_position = $5, 
          active = $6,
          updated_at = NOW()
      WHERE id = $7
    `, [
      name, 
      description || null, 
      icon || null, 
      color || null, 
      order_position || 0,
      active !== undefined ? active : true,
      id
    ]);
    
    return c.json({ message: 'Tipo de matéria atualizado com sucesso' });
    
  } catch (error: any) {
    console.error('Update matter type error:', error);
    return c.json({ error: 'Erro ao atualizar tipo de matéria' }, 500);
  }
});

/**
 * DELETE /api/matter-types/:id
 * Remove tipo de matéria (admin)
 */
matterTypes.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    
    // Verificar se tipo de matéria existe
    const existingResult = await db.query(
      'SELECT id FROM matter_types WHERE id = $1',
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      return c.json({ error: 'Tipo de matéria não encontrado' }, 404);
    }
    
    // Verificar se existem matérias usando este tipo
    const mattersResult = await db.query(
      'SELECT COUNT(*) as count FROM matters WHERE matter_type_id = $1',
      [id]
    );
    
    const matterCount = parseInt(mattersResult.rows[0].count);
    
    if (matterCount > 0) {
      return c.json({ 
        error: 'Não é possível excluir este tipo de matéria pois existem matérias vinculadas',
        count: matterCount
      }, 400);
    }
    
    // Deletar tipo de matéria
    await db.query(
      'DELETE FROM matter_types WHERE id = $1',
      [id]
    );
    
    return c.json({ message: 'Tipo de matéria removido com sucesso' });
    
  } catch (error: any) {
    console.error('Delete matter type error:', error);
    return c.json({ error: 'Erro ao remover tipo de matéria' }, 500);
  }
});

/**
 * POST /api/matter-types/:id/reorder
 * Reordena tipos de matéria
 */
matterTypes.post('/:id/reorder', async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const { new_position } = await c.req.json();
    
    if (new_position === undefined || new_position < 0) {
      return c.json({ error: 'Nova posição é obrigatória' }, 400);
    }
    
    // Verificar se tipo de matéria existe
    const existingResult = await db.query(
      'SELECT id, order_position FROM matter_types WHERE id = $1',
      [id]
    );
    
    if (existingResult.rows.length === 0) {
      return c.json({ error: 'Tipo de matéria não encontrado' }, 404);
    }
    
    const currentPosition = existingResult.rows[0].order_position;
    
    if (new_position > currentPosition) {
      // Movendo para baixo: decrementar itens entre posições
      await db.query(`
        UPDATE matter_types 
        SET order_position = order_position - 1
        WHERE order_position > $1 AND order_position <= $2
      `, [currentPosition, new_position]);
    } else if (new_position < currentPosition) {
      // Movendo para cima: incrementar itens entre posições
      await db.query(`
        UPDATE matter_types 
        SET order_position = order_position + 1
        WHERE order_position >= $1 AND order_position < $2
      `, [new_position, currentPosition]);
    }
    
    // Atualizar a posição do item atual
    await db.query(
      'UPDATE matter_types SET order_position = $1 WHERE id = $2',
      [new_position, id]
    );
    
    return c.json({ message: 'Posição atualizada com sucesso' });
    
  } catch (error: any) {
    console.error('Reorder matter type error:', error);
    return c.json({ error: 'Erro ao reordenar tipo de matéria' }, 500);
  }
});

/**
 * POST /api/matter-types/bulk-reorder
 * Reordena múltiplos tipos de matéria de uma vez
 */
matterTypes.post('/bulk-reorder', async (c) => {
  try {
    const { items } = await c.req.json(); // [{id, order_position}, ...]
    
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ error: 'Lista de itens é obrigatória' }, 400);
    }
    
    // Atualizar cada item
    for (const item of items) {
      await db.query(
        'UPDATE matter_types SET order_position = $1 WHERE id = $2',
        [item.order_position, item.id]
      );
    }
    
    return c.json({ 
      message: `${items.length} tipos de matéria reordenados com sucesso` 
    });
    
  } catch (error: any) {
    console.error('Bulk reorder matter types error:', error);
    return c.json({ error: 'Erro ao reordenar tipos de matéria' }, 500);
  }
});

export default matterTypes;