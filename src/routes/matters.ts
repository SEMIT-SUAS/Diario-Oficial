import { Hono } from 'hono';
import { HonoContext } from '../types';
import { authMiddleware, requireRole } from '../middleware/auth';
import db from '../lib/db';
import jwt from 'jsonwebtoken';

const matters = new Hono<HonoContext>();

/**
 * GET /api/matters/attachments/:id/download
 * Download de um anexo específico - COM BYPASS PARA DESENVOLVIMENTO
 */
matters.get('/attachments/:id/download', async (c) => {
  console.log('\n========== 📥 DOWNLOAD DE ANEXO ==========');
  console.log(`📥 Rota de download chamada para anexo ID: ${c.req.param('id')}`);
  console.log(`📥 URL completa: ${c.req.url}`);
  console.log(`📥 Método: ${c.req.method}`);
  console.log(`📥 BYPASS MODE: ${process.env.BYPASS_DOWNLOAD_AUTH === 'true' ? 'ATIVADO 🚀' : 'DESATIVADO'}`);
  
  // 🔍 VER TODOS OS HEADERS
  const allHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(c.req.header())) {
    allHeaders[key] = value as string;
  }
  console.log('📋 TODOS OS HEADERS RECEBIDOS:', JSON.stringify(allHeaders, null, 2));
  
  try {
    // ================================================
    // 🚀🚀🚀 BYPASS COMPLETO DE AUTENTICAÇÃO 🚀🚀🚀
    // ================================================
    // Para testes em desenvolvimento - NÃO USAR EM PRODUÇÃO
    // Ative no .env: BYPASS_DOWNLOAD_AUTH=true
    // ================================================
    if (process.env.BYPASS_DOWNLOAD_AUTH === 'true') {
      console.log('🚀🚀🚀 BYPASS ATIVADO - PULANDO TODA VALIDAÇÃO DE TOKEN!');
      
      // Usuário MOCK - ALTERE PARA SEUS DADOS
      const user = {
        id: 7,
        name: 'Usuário Teste',
        email: 'cristian@gmail.com',
        role: 'secretaria',
        secretaria_id: 1
      };

      console.log('✅ Usuário mock autenticado com sucesso:');
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Nome: ${user.name}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Secretaria: ${user.secretaria_id || 'N/A'}`);

      const id = parseInt(c.req.param('id'));
      console.log(`🔍 Buscando anexo ID: ${id}...`);

      // Buscar anexo
      const result = await db.query(
        `SELECT a.*, m.secretaria_id, m.id as matter_id, m.title as matter_title
         FROM attachments a 
         JOIN matters m ON m.id = a.matter_id
         WHERE a.id = $1`,
        [id]
      );

      const attachment = result.rows[0];
      if (!attachment) {
        console.log(`❌ Anexo ID ${id} não encontrado`);
        return c.json({ error: 'Anexo não encontrado' }, 404);
      }

      console.log(`📊 Anexo encontrado:`);
      console.log(`   - ID: ${attachment.id}`);
      console.log(`   - Nome original: ${attachment.original_name}`);
      console.log(`   - Tamanho: ${attachment.file_size} bytes`);
      console.log(`   - MIME type: ${attachment.mime_type}`);
      console.log(`   - Matéria ID: ${attachment.matter_id}`);
      console.log(`   - Matéria título: ${attachment.matter_title}`);

      console.log('✅ Permissões verificadas, gerando conteúdo...');
      
      // SIMULAÇÃO: Em produção, você buscaria o arquivo real
      let content = '';
      let contentType = attachment.mime_type || 'application/octet-stream';
      let filename = attachment.original_name || `anexo-${id}.bin`;
      
      // Gerar conteúdo baseado no tipo
      if (attachment.mime_type?.includes('pdf')) {
        content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 720 Td
(Anexo: ${attachment.original_name}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
0000000176 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
242
%%EOF`;
      } else if (attachment.mime_type?.includes('image')) {
        content = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="200" fill="#3b82f6"/>
          <text x="200" y="100" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
            Imagem: ${attachment.original_name}
          </text>
          <text x="200" y="130" font-family="Arial" font-size="14" fill="white" text-anchor="middle">
            Tamanho: ${Math.round(attachment.file_size / 1024)} KB
          </text>
        </svg>`;
        contentType = 'image/svg+xml';
        filename = filename.replace(/\.[^/.]+$/, '') + '.svg';
      } else {
        content = `Conteúdo simulado para: ${attachment.original_name}
Tipo: ${attachment.mime_type}
Tamanho: ${attachment.file_size} bytes
Upload: ${attachment.uploaded_at}

Este é um arquivo de teste gerado pelo sistema.
Em produção, aqui estaria o conteúdo real do arquivo.

ID do anexo: ${attachment.id}
Matéria: ${attachment.matter_title} (ID: ${attachment.matter_id})`;
        contentType = 'text/plain; charset=utf-8';
      }
      
      console.log(`📤 Enviando resposta:`);
      console.log(`   - Content-Type: ${contentType}`);
      console.log(`   - Tamanho: ${content.length} bytes`);
      console.log(`   - Filename: ${filename}`);
      console.log('========== FIM DOWNLOAD (BYPASS) ==========\n');
      
      // Criar o encoder para UTF-8
      const encoder = new TextEncoder();
      const contentBuffer = encoder.encode(content);
      
      // Retornar como resposta de arquivo
      return new Response(contentBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
          'Content-Length': contentBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Filename': encodeURIComponent(filename),
          'X-File-Size': attachment.file_size.toString(),
          'X-File-Type': attachment.mime_type || 'unknown',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          'Access-Control-Expose-Headers': 'Content-Disposition, X-Filename, X-File-Size'
        }
      });
    }
    
    // ================================================
    // CÓDIGO NORMAL DE AUTENTICAÇÃO (QUANDO BYPASS ESTÁ DESATIVADO)
    // ================================================
    
    // 🔐 VERIFICAR TOKEN MANUALMENTE COM DEBUG
    const authHeader = c.req.header('Authorization');
    console.log('🔐 Authorization header BRUTO:', authHeader);
    
    if (!authHeader) {
      console.log('❌ Authorization header AUSENTE');
      console.log('📋 Headers disponíveis:', Object.keys(c.req.header()));
      return c.json({ error: 'Token não fornecido' }, 401);
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      console.log('❌ Authorization header não começa com Bearer');
      console.log(`📋 Header recebido: "${authHeader.substring(0, 20)}..."`);
      return c.json({ error: 'Formato de token inválido. Use: Bearer <token>' }, 401);
    }
    
    const token = authHeader.substring(7);
    console.log(`🔑 Token extraído: ${token.substring(0, 20)}... (${token.length} caracteres)`);
    
    // Verificar se o token não está vazio
    if (!token || token.length < 10) {
      console.log('❌ Token muito curto ou vazio');
      return c.json({ error: 'Token inválido' }, 401);
    }
    
    // Verificar token manualmente
    const JWT_SECRET = process.env.JWT_SECRET;
    console.log('🔐 JWT_SECRET configurado?', JWT_SECRET ? 'Sim' : 'Não');
    
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET não configurado no .env');
      return c.json({ error: 'Erro de configuração do servidor' }, 500);
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
      console.log('✅ Token JWT válido!');
      console.log('📦 Decoded token:', JSON.stringify(decoded, null, 2));
    } catch (err: any) {
      console.log('❌ Erro na verificação do JWT:');
      console.log('   - Nome:', err.name);
      console.log('   - Mensagem:', err.message);
      console.log('   - Stack:', err.stack);
      return c.json({ 
        error: 'Token inválido ou expirado',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      }, 401);
    }
    
    // Buscar usuário no banco
    const userId = (decoded as any).userId || (decoded as any).id;
    console.log(`🔍 Buscando usuário ID: ${userId} no banco...`);
    
    const userResult = await db.query(
      'SELECT id, name, email, role, secretaria_id FROM users WHERE id = $1 AND active = true',
      [userId]
    );
    
    const user = userResult.rows[0];
    if (!user) {
      console.log('❌ Usuário não encontrado ou inativo no banco');
      return c.json({ error: 'Usuário não encontrado' }, 401);
    }
    
    console.log('✅ Usuário autenticado com sucesso:');
    console.log(`   - ID: ${user.id}`);
    console.log(`   - Nome: ${user.name}`);
    console.log(`   - Role: ${user.role}`);
    console.log(`   - Secretaria: ${user.secretaria_id || 'N/A'}`);

    const id = parseInt(c.req.param('id'));
    console.log(`🔍 Buscando anexo ID: ${id}...`);

    // Buscar anexo
    const result = await db.query(
      `SELECT a.*, m.secretaria_id, m.id as matter_id, m.title as matter_title
       FROM attachments a 
       JOIN matters m ON m.id = a.matter_id
       WHERE a.id = $1`,
      [id]
    );

    const attachment = result.rows[0];
    if (!attachment) {
      console.log(`❌ Anexo ID ${id} não encontrado`);
      return c.json({ error: 'Anexo não encontrado' }, 404);
    }

    console.log(`📊 Anexo encontrado:`);
    console.log(`   - ID: ${attachment.id}`);
    console.log(`   - Nome original: ${attachment.original_name}`);
    console.log(`   - Tamanho: ${attachment.file_size} bytes`);
    console.log(`   - MIME type: ${attachment.mime_type}`);
    console.log(`   - Matéria ID: ${attachment.matter_id}`);
    console.log(`   - Matéria título: ${attachment.matter_title}`);

    // Verificar permissões
    if (user.role === 'secretaria' && attachment.secretaria_id !== user.secretaria_id) {
      console.log(`🚫 Acesso negado:`);
      console.log(`   - Secretaria do usuário: ${user.secretaria_id}`);
      console.log(`   - Secretaria do anexo: ${attachment.secretaria_id}`);
      return c.json({ error: 'Acesso negado' }, 403);
    }

    console.log('✅ Permissões verificadas, gerando conteúdo...');
    
    // SIMULAÇÃO: Em produção, você buscaria o arquivo real
    let content = '';
    let contentType = attachment.mime_type || 'application/octet-stream';
    let filename = attachment.original_name || `anexo-${id}.bin`;
    
    // Gerar conteúdo baseado no tipo
    if (attachment.mime_type?.includes('pdf')) {
      content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT
/F1 12 Tf
72 720 Td
(Anexo: ${attachment.original_name}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000053 00000 n
0000000102 00000 n
0000000176 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
242
%%EOF`;
    } else if (attachment.mime_type?.includes('image')) {
      content = `<svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="200" fill="#3b82f6"/>
        <text x="200" y="100" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
          Imagem: ${attachment.original_name}
        </text>
        <text x="200" y="130" font-family="Arial" font-size="14" fill="white" text-anchor="middle">
          Tamanho: ${Math.round(attachment.file_size / 1024)} KB
        </text>
      </svg>`;
      contentType = 'image/svg+xml';
      filename = filename.replace(/\.[^/.]+$/, '') + '.svg';
    } else {
      content = `Conteúdo simulado para: ${attachment.original_name}
Tipo: ${attachment.mime_type}
Tamanho: ${attachment.file_size} bytes
Upload: ${attachment.uploaded_at}

Este é um arquivo de teste gerado pelo sistema.
Em produção, aqui estaria o conteúdo real do arquivo.

ID do anexo: ${attachment.id}
Matéria: ${attachment.matter_title} (ID: ${attachment.matter_id})`;
      contentType = 'text/plain; charset=utf-8';
    }
    
    console.log(`📤 Enviando resposta:`);
    console.log(`   - Content-Type: ${contentType}`);
    console.log(`   - Tamanho: ${content.length} bytes`);
    console.log(`   - Filename: ${filename}`);
    console.log('========== FIM DOWNLOAD ==========\n');
    
    // Criar o encoder para UTF-8
    const encoder = new TextEncoder();
    const contentBuffer = encoder.encode(content);
    
    // Retornar como resposta de arquivo
    return new Response(contentBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': contentBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Filename': encodeURIComponent(filename),
        'X-File-Size': attachment.file_size.toString(),
        'X-File-Type': attachment.mime_type || 'unknown',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Disposition, X-Filename, X-File-Size'
      }
    });
    
  } catch (err: any) {
    console.error('❌ ERRO CRÍTICO NO DOWNLOAD:');
    console.error('   - Mensagem:', err.message);
    console.error('   - Stack:', err.stack);
    return c.json({ 
      error: 'Erro ao buscar anexo',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * DELETE /api/matters/attachments/:id
 * Remover um anexo - COM BYPASS PARA DESENVOLVIMENTO
 */
matters.delete('/attachments/:id', async (c) => {
  try {
    console.log(`🗑️ Rota de remoção de anexo chamada para ID: ${c.req.param('id')}`);
    console.log(`🗑️ BYPASS MODE: ${process.env.BYPASS_DOWNLOAD_AUTH === 'true' ? 'ATIVADO 🚀' : 'DESATIVADO'}`);
    
    // ================================================
    // 🚀🚀🚀 BYPASS COMPLETO DE AUTENTICAÇÃO 🚀🚀🚀
    // ================================================
    if (process.env.BYPASS_DOWNLOAD_AUTH === 'true') {
      console.log('🚀🚀🚀 BYPASS ATIVADO - PULANDO VALIDAÇÃO DE TOKEN NO DELETE!');
      
      // Usuário Mockado
      const user = {
        id: 7,
        name: 'Cristian',
        email: 'cristian@gmail.com',
        role: 'secretaria',
        secretaria_id: 1
      };

      console.log('✅ Usuário mock autenticado com sucesso:');
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Nome: ${user.name}`);
      console.log(`   - Role: ${user.role}`);
      console.log(`   - Secretaria: ${user.secretaria_id}`);

      const id = parseInt(c.req.param('id'));

      // Buscar anexo e verificar permissões
      const result = await db.query(
        `SELECT a.*, m.secretaria_id, m.status, m.id as matter_id
         FROM attachments a 
         JOIN matters m ON m.id = a.matter_id
         WHERE a.id = $1`,
        [id]
      );

      const attachment = result.rows[0];
      if (!attachment) {
        return c.json({ error: 'Anexo não encontrado' }, 404);
      }

      // Remover anexo
      await db.query('DELETE FROM attachments WHERE id = $1', [id]);

      // Verificar se ainda existem anexos
      const countResult = await db.query(
        'SELECT COUNT(*) FROM attachments WHERE matter_id = $1',
        [attachment.matter_id]
      );
      
      const hasAttachments = parseInt(countResult.rows[0].count) > 0;
      
      // Atualizar flag de anexos na matéria
      await db.query(
        'UPDATE matters SET has_attachments = $1, updated_at = NOW() WHERE id = $2',
        [hasAttachments, attachment.matter_id]
      );

      console.log(`✅ Anexo ${id} removido com sucesso da matéria ${attachment.matter_id} (BYPASS)`);

      return c.json({
        message: 'Anexo removido com sucesso'
      });
    }
    
    // ================================================
    // CÓDIGO NORMAL DE AUTENTICAÇÃO (QUANDO BYPASS ESTÁ DESATIVADO)
    // ================================================
    
    // 🔐 VERIFICAR TOKEN MANUALMENTE
    const authHeader = c.req.header('Authorization');
    console.log('🔐 Authorization header:', authHeader ? 'Presente' : 'Ausente');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('⚠️ Token não fornecido ou formato inválido');
      return c.json({ error: 'Token não fornecido' }, 401);
    }
    
    const token = authHeader.substring(7);
    
    // Verificar token manualmente
    const JWT_SECRET = process.env.JWT_SECRET;
    
    if (!JWT_SECRET) {
      console.error('❌ JWT_SECRET não configurado');
      return c.json({ error: 'Erro de configuração do servidor' }, 500);
    }
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
      console.log('✅ Token válido para usuário:', decoded.userId || decoded.id);
    } catch (err: any) {
      console.log('❌ Token inválido:', err.message);
      return c.json({ error: 'Token inválido' }, 401);
    }
    
    const userId = decoded.userId || decoded.id;
    
    // Buscar usuário no banco
    const userResult = await db.query(
      'SELECT id, name, email, role, secretaria_id FROM users WHERE id = $1 AND active = true',
      [userId]
    );
    
    const user = userResult.rows[0];
    if (!user) {
      console.log('❌ Usuário não encontrado ou inativo');
      return c.json({ error: 'Usuário não encontrado' }, 401);
    }

    const id = parseInt(c.req.param('id'));

    // Buscar anexo e verificar permissões
    const result = await db.query(
      `SELECT a.*, m.secretaria_id, m.status, m.id as matter_id
       FROM attachments a 
       JOIN matters m ON m.id = a.matter_id
       WHERE a.id = $1`,
      [id]
    );

    const attachment = result.rows[0];
    if (!attachment) {
      return c.json({ error: 'Anexo não encontrado' }, 404);
    }

    // Verificar permissões
    if (user.role === 'secretaria' && attachment.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Só permite remover anexos de matérias em draft ou submitted
    if (attachment.status !== 'draft' && attachment.status !== 'submitted') {
      return c.json({ 
        error: 'Só é possível remover anexos de matérias em rascunho ou enviadas para análise' 
      }, 400);
    }

    // Remover anexo
    await db.query('DELETE FROM attachments WHERE id = $1', [id]);

    // Verificar se ainda existem anexos
    const countResult = await db.query(
      'SELECT COUNT(*) FROM attachments WHERE matter_id = $1',
      [attachment.matter_id]
    );
    
    const hasAttachments = parseInt(countResult.rows[0].count) > 0;
    
    // Atualizar flag de anexos na matéria
    await db.query(
      'UPDATE matters SET has_attachments = $1, updated_at = NOW() WHERE id = $2',
      [hasAttachments, attachment.matter_id]
    );

    console.log(`✅ Anexo ${id} removido com sucesso da matéria ${attachment.matter_id}`);

    return c.json({
      message: 'Anexo removido com sucesso'
    });
  } catch (err: any) {
    console.error('❌ Erro ao remover anexo:', err);
    return c.json({ error: 'Erro ao remover anexo' }, 500);
  }
});

// ====================================
// AGORA SIM, APLICAR AUTENTICAÇÃO PARA TODAS AS OUTRAS ROTAS
// ====================================
matters.use('/*', authMiddleware);

/**
 * POST /api/matters/:id/submit
 * Submeter matéria para revisão - USANDO STATUS 'submitted'
 */
matters.post('/:id/submit', async (c) => {
  console.log('🔵 Rota /:id/submit chamada');
  
  try {
    const user = c.get('user');
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    console.log(`📝 Submetendo matéria ID: ${id} para revisão`);

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      console.log(`❌ Matéria ID: ${id} não encontrada`);
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    console.log(`📊 Matéria encontrada: ID ${matter.id}, Status: ${matter.status}, Secretaria: ${matter.secretaria_id}`);

    // Verificar permissões
    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      console.log(`🚫 Acesso negado: Usuário secretaria ${user.secretaria_id} tentando acessar matéria da secretaria ${matter.secretaria_id}`);
      return c.json({ error: 'Acesso negado' }, 403);
    }

    // Só pode submeter matérias em draft
    if (matter.status !== 'draft') {
      console.log(`⚠️ Status inválido para submit: ${matter.status}`);
      return c.json({ 
        error: `Só é possível submeter matérias em rascunho. Status atual: ${matter.status}` 
      }, 400);
    }

    // Atualizar status para 'submitted' e marcar data de submissão
    console.log(`🔄 Atualizando matéria ${id} para status 'submitted'`);
    const result = await db.query(
      `UPDATE matters SET status = 'submitted', submitted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );

    console.log(`✅ Matéria ${id} submetida com sucesso com status 'submitted'`);
    
    return c.json({
      message: 'Matéria submetida para revisão com sucesso',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Erro ao submeter matéria:', err);
    return c.json({ 
      error: 'Erro ao submeter matéria',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * POST /api/matters/:id/cancel
 * Cancelar envio de matéria - voltar para draft
 */
matters.post('/:id/cancel', async (c) => {
  console.log('🔵 Rota /:id/cancel chamada');
  
  try {
    const user = c.get('user');
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();
    const { cancelation_reason } = body;

    if (!cancelation_reason || cancelation_reason.trim() === '') {
      return c.json({ error: 'Motivo do cancelamento é obrigatório' }, 400);
    }

    console.log(`📝 Cancelando matéria ID: ${id}. Motivo: ${cancelation_reason}`);

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, status, author_id FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      console.log(`❌ Matéria ID: ${id} não encontrada`);
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    console.log(`📊 Matéria encontrada: ID ${matter.id}, Status: ${matter.status}, Secretaria: ${matter.secretaria_id}`);

    // Verificar permissões
    if (user.role === 'secretaria') {
      if (matter.secretaria_id !== user.secretaria_id) {
        console.log(`🚫 Acesso negado: Usuário secretaria ${user.secretaria_id} tentando cancelar matéria da secretaria ${matter.secretaria_id}`);
        return c.json({ error: 'Acesso negado' }, 403);
      }
      if (matter.author_id !== user.id) {
        console.log(`🚫 Usuário não é o autor da matéria`);
        return c.json({ error: 'Somente o autor pode cancelar o envio da matéria' }, 403);
      }
    }

    if (matter.status !== 'submitted') {
      console.log(`⚠️ Status inválido para cancelamento: ${matter.status}`);
      return c.json({ 
        error: `Só é possível cancelar matérias enviadas para análise. Status atual: ${matter.status}` 
      }, 400);
    }

    // Verificar quais colunas existem
    const tableInfo = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'matters'
    `);
    
    const columns = tableInfo.rows.map(row => row.column_name);
    console.log('📋 Colunas disponíveis na tabela matters:', columns);
    
    // Montar query dinamicamente com base nas colunas existentes
    let updateQuery = `UPDATE matters SET status = 'draft'`;
    const queryParams: any[] = [];
    let paramCount = 1;
    
    if (columns.includes('cancelation_reason')) {
      updateQuery += `, cancelation_reason = $${paramCount}`;
      queryParams.push(cancelation_reason);
      paramCount++;
    }
    
    if (columns.includes('canceled_at')) {
      updateQuery += `, canceled_at = NOW()`;
    }
    
    if (columns.includes('canceler_id')) {
      updateQuery += `, canceler_id = $${paramCount}`;
      queryParams.push(user.id);
      paramCount++;
    }
    
    updateQuery += `, updated_at = NOW() WHERE id = $${paramCount} RETURNING *`;
    queryParams.push(id);
    
    console.log('📝 Query de update:', updateQuery);
    console.log('🔢 Parâmetros:', queryParams);
    
    const result = await db.query(updateQuery, queryParams);

    console.log(`✅ Matéria ${id} cancelada com sucesso, status atualizado para 'draft'`);
    
    return c.json({
      message: 'Envio cancelado com sucesso. Matéria voltou para rascunho.',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Erro ao cancelar matéria:', err);
    return c.json({ 
      error: 'Erro ao cancelar envio',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * GET /api/matters/:id/attachments
 * Listar anexos de uma matéria
 */
matters.get('/:id/attachments', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));

    const checkResult = await db.query(
      'SELECT id, secretaria_id FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    const result = await db.query(
      `SELECT a.*, u.name AS uploaded_by_name 
       FROM attachments a 
       LEFT JOIN users u ON u.id = a.uploaded_by
       WHERE a.matter_id = $1 
       ORDER BY a.uploaded_at DESC`,
      [id]
    );

    return c.json({
      attachments: result.rows
    });
  } catch (err: any) {
    console.error('Erro ao listar anexos:', err);
    return c.json({ error: 'Erro ao listar anexos' }, 500);
  }
});


/**
 * POST /api/matters/:id/attachments
 * Upload de anexos para uma matéria - APENAS PDF
 */
matters.post('/:id/attachments', async (c) => {
  console.log('🔵 Rota POST /api/matters/:id/attachments chamada');
  
  try {
    const user = c.get('user');
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    console.log(`📎 Upload para matéria ID: ${id}`);

    const checkResult = await db.query(
      'SELECT id, secretaria_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      console.log(`❌ Matéria ID: ${id} não encontrada`);
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    console.log(`📊 Matéria encontrada: ID ${matter.id}, Status: ${matter.status}, Secretaria: ${matter.secretaria_id}`);

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      console.log(`🚫 Acesso negado: Usuário secretaria ${user.secretaria_id} tentando acessar matéria da secretaria ${matter.secretaria_id}`);
      return c.json({ error: 'Acesso negado' }, 403);
    }

    if (matter.status !== 'draft' && matter.status !== 'submitted') {
      console.log(`⚠️ Status inválido para upload: ${matter.status}`);
      return c.json({ 
        error: 'Só é possível adicionar anexos em matérias em rascunho ou enviadas para análise' 
      }, 400);
    }

    const formData = await c.req.formData();
    console.log('📦 FormData recebido, campos:', Array.from(formData.keys()));

    const files: File[] = [];
    
    for (const [key, value] of formData.entries()) {
      console.log(`🔍 Campo: ${key}, tipo: ${typeof value}`);
      
      if (value instanceof File) {
        console.log(`📁 Arquivo encontrado: ${value.name} (${value.size} bytes, Tipo: ${value.type})`);
        files.push(value);
      }
    }

    if (files.length === 0) {
      console.log('❌ Nenhum arquivo enviado');
      return c.json({ error: 'Nenhum arquivo enviado' }, 400);
    }

    console.log(`📊 Total de arquivos: ${files.length}`);
    
    // Limitar número de arquivos
    if (files.length > 10) {
      console.log(`❌ Excedeu o limite de arquivos: ${files.length} > 10`);
      return c.json({ error: 'Máximo de 10 arquivos por upload' }, 400);
    }

    // Tamanho máximo por arquivo: 10MB
    const MAX_SIZE = 10 * 1024 * 1024;
    
    for (const file of files) {
      // 1️⃣ VALIDAÇÃO DE TAMANHO
      if (file.size > MAX_SIZE) {
        console.log(`❌ Arquivo ${file.name} excede tamanho máximo: ${file.size} > ${MAX_SIZE}`);
        return c.json({ 
          error: `Arquivo ${file.name} excede o tamanho máximo de 10MB` 
        }, 400);
      }
      
      // 2️⃣ 🚨 VALIDAÇÃO APENAS PDF 🚨
      const isPDF = file.type === 'application/pdf' || 
                    file.name.toLowerCase().endsWith('.pdf');
      
      if (!isPDF) {
        console.log(`❌ Arquivo ${file.name} não é um PDF. Tipo: ${file.type || 'desconhecido'}`);
        return c.json({ 
          error: `Apenas arquivos PDF são permitidos. "${file.name}" não é um PDF.` 
        }, 400);
      }
      
      // Verificação adicional do magic number (opcional, mais seguro)
      try {
        const buffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(buffer.slice(0, 5));
        const pdfSignature = String.fromCharCode(...uint8Array);
        
        if (pdfSignature !== '%PDF-') {
          console.log(`❌ Arquivo ${file.name} não é um PDF válido (assinatura inválida)`);
          return c.json({ 
            error: `Arquivo "${file.name}" não é um PDF válido.` 
          }, 400);
        }
      } catch (sigErr) {
        console.log(`⚠️ Não foi possível verificar assinatura do PDF: ${file.name}`);
        // Continuar mesmo se não conseguir ler o buffer
      }
    }

    // Inserir anexos no banco de dados
    const insertedAttachments = [];
    
    for (const file of files) {
      try {
        console.log(`💾 Salvando arquivo PDF: ${file.name}`);
        
        const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2)}-${file.name}`;
        
        const result = await db.query(
          `INSERT INTO attachments (
            matter_id,
            filename,
            original_name,
            file_size,
            mime_type,
            uploaded_by,
            uploaded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING *`,
          [
            id,
            uniqueFilename,
            file.name,
            file.size,
            'application/pdf', // Forçar application/pdf
            user.id
          ]
        );
        
        console.log(`✅ PDF salvo no banco: ${file.name} (ID: ${result.rows[0].id})`);
        insertedAttachments.push(result.rows[0]);
      } catch (fileErr: any) {
        console.error(`❌ Erro ao salvar arquivo ${file.name}:`, fileErr);
      }
    }

    if (insertedAttachments.length === 0) {
      console.log('❌ Nenhum arquivo foi salvo com sucesso');
      return c.json({ 
        error: 'Não foi possível salvar nenhum arquivo' 
      }, 500);
    }

    await db.query(
      'UPDATE matters SET has_attachments = true, updated_at = NOW() WHERE id = $1',
      [id]
    );

    console.log(`✅ ${insertedAttachments.length} PDF(s) anexado(s) com sucesso à matéria ${id}`);
    
    return c.json({
      message: `${insertedAttachments.length} PDF(s) anexado(s) com sucesso`,
      attachments: insertedAttachments
    }, 201);
  } catch (err: any) {
    console.error('❌ Erro ao fazer upload de anexos:', err);
    console.error('❌ Stack trace:', err.stack);
    return c.json({ 
      error: 'Erro ao fazer upload de anexos',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});


/**
 * GET /api/matters - Listar matérias
 */
matters.get('/', async (c) => {
  try {
    console.log('📥 GET /api/matters chamado');
    
    const user = c.get('user');
    console.log('👤 Usuário:', user);
    
    if (!user) {
      console.log('❌ Usuário não autenticado');
      return c.json({ error: 'Não autenticado' }, 401);
    }
    
    const {
      status,
      secretaria_id,
      category_id,
      search,
      page = '1',
      limit = '20',
    } = c.req.query();

    console.log('📋 Parâmetros:', { status, secretaria_id, category_id, search, page, limit });

    let sql = `
      SELECT
        m.*,
        s.name AS secretaria_name,
        s.acronym AS secretaria_acronym,
        c.name AS category_name,
        u.name AS author_name,
        mt.name AS matter_type_name
      FROM matters m
      LEFT JOIN secretarias s ON s.id = m.secretaria_id
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN users u ON u.id = m.author_id
      LEFT JOIN matter_types mt ON mt.id = m.matter_type_id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (user.role === 'secretaria' && user.secretaria_id) {
      params.push(user.secretaria_id);
      sql += ` AND m.secretaria_id = $${paramCount}`;
      paramCount++;
      console.log(`🔒 Filtro por secretaria: ${user.secretaria_id}`);
    }

    if (status) {
      const allowedStatuses = ['draft', 'submitted', 'approved', 'rejected', 'published'];
      if (allowedStatuses.includes(status)) {
        params.push(status);
        sql += ` AND m.status = $${paramCount}`;
        paramCount++;
        console.log(`📌 Filtro por status: ${status}`);
      }
    }

    if (secretaria_id && (user.role === 'admin' || user.role === 'semad')) {
      params.push(secretaria_id);
      sql += ` AND m.secretaria_id = $${paramCount}`;
      paramCount++;
    }

    if (category_id) {
      params.push(category_id);
      sql += ` AND m.category_id = $${paramCount}`;
      paramCount++;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (m.title ILIKE $${paramCount} OR m.content ILIKE $${paramCount})`;
      paramCount++;
    }

    sql += ` ORDER BY m.created_at DESC`;

    params.push(Number(limit));
    sql += ` LIMIT $${paramCount}`;
    paramCount++;
    
    const offset = (Number(page) - 1) * Number(limit);
    params.push(offset);
    sql += ` OFFSET $${paramCount}`;

    console.log('📝 SQL:', sql);
    console.log('🔢 Parâmetros:', params);

    const result = await db.query(sql, params);
    console.log(`📊 Resultado: ${result.rows.length} matérias encontradas`);

    // Count query
    let countSql = `SELECT COUNT(*) FROM matters m WHERE 1=1`;
    const countParams: any[] = [];
    let countParamCount = 1;

    if (user.role === 'secretaria' && user.secretaria_id) {
      countParams.push(user.secretaria_id);
      countSql += ` AND m.secretaria_id = $${countParamCount}`;
      countParamCount++;
    }

    if (status && ['draft', 'submitted', 'approved', 'rejected', 'published'].includes(status)) {
      countParams.push(status);
      countSql += ` AND m.status = $${countParamCount}`;
      countParamCount++;
    }

    if (secretaria_id && (user.role === 'admin' || user.role === 'semad')) {
      countParams.push(secretaria_id);
      countSql += ` AND m.secretaria_id = $${countParamCount}`;
      countParamCount++;
    }

    if (category_id) {
      countParams.push(category_id);
      countSql += ` AND m.category_id = $${countParamCount}`;
      countParamCount++;
    }

    if (search) {
      countParams.push(`%${search}%`);
      countSql += ` AND (m.title ILIKE $${countParamCount} OR m.content ILIKE $${countParamCount})`;
      countParamCount++;
    }

    const countResult = await db.query(countSql, countParams);
    const total = Number(countResult.rows[0]?.count || 0);

    return c.json({
      matters: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err: any) {
    console.error('❌ Erro ao listar matérias:', err);
    return c.json({ 
      error: 'Erro ao listar matérias',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * GET /api/matters/:id
 */
matters.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }
    
    const id = parseInt(c.req.param('id'));

    const result = await db.query(
      `
      SELECT
        m.*,
        s.name AS secretaria_name,
        s.acronym AS secretaria_acronym,
        c.name AS category_name,
        u.name AS author_name,
        mt.name AS matter_type_name
      FROM matters m
      LEFT JOIN secretarias s ON s.id = m.secretaria_id
      LEFT JOIN categories c ON c.id = m.category_id
      LEFT JOIN users u ON u.id = m.author_id
      LEFT JOIN matter_types mt ON mt.id = m.matter_type_id
      WHERE m.id = $1
      `,
      [id]
    );

    const matter = result.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    const attachmentsResult = await db.query(
      'SELECT * FROM attachments WHERE matter_id = $1 ORDER BY uploaded_at DESC',
      [id]
    );

    return c.json({
      ...matter,
      attachments: attachmentsResult.rows || []
    });
  } catch (err: any) {
    console.error('Erro ao buscar matéria:', err);
    return c.json({ error: 'Erro ao buscar matéria' }, 500);
  }
});

/**
 * POST /api/matters - CORRIGIDO!
 */
matters.post('/', requireRole('secretaria', 'semad', 'admin'), async (c) => {
  try {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }
    
    const body = await c.req.json();

    const {
      title,
      content,
      summary,
      category_id,
      matter_type_id,
      priority = 'normal',
      scheduled_date,  // ← Data de publicação (agora sempre enviada pelo front)
      notes,
    } = body;

    if (!title || !content || !matter_type_id) {
      return c.json({ error: 'Título, conteúdo e tipo de matéria são obrigatórios' }, 400);
    }

    if ((user.role === 'secretaria' || user.role === 'semad') && !user.secretaria_id) {
      return c.json({ error: 'Usuário não associado a uma secretaria' }, 400);
    }

    // ✅ Se não veio data, usa a data atual
    const publicationDate = scheduled_date || new Date().toISOString().split('T')[0];

    const result = await db.query(
      `
      INSERT INTO matters (
        title,
        content,
        summary,
        category_id,
        matter_type_id,
        secretaria_id,
        author_id,
        status,
        priority,
        scheduled_date,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft', $8, $9, $10, NOW(), NOW())
      RETURNING id
      `,
      [
        title,
        content,
        summary || null,
        category_id || null,
        matter_type_id,
        user.secretaria_id,
        user.id,
        priority,
        publicationDate, // ← Agora sempre tem valor
        notes || null
      ]
    );

    return c.json(
      { 
        message: 'Matéria criada com sucesso', 
        matterId: result.rows[0].id 
      },
      201
    );
  } catch (err: any) {
    console.error('❌ Erro ao criar matéria:', err);
    return c.json({ 
      error: 'Erro ao criar matéria', 
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * PUT /api/matters/:id - CORRIGIDO!
 */
matters.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, author_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    if (matter.status === 'published' && user.role !== 'admin') {
      return c.json({ error: 'Não é possível editar uma matéria já publicada' }, 400);
    }

    const {
      title,
      content,
      summary,
      category_id,
      matter_type_id,
      priority,
      scheduled_date,
      notes
    } = body;

    const result = await db.query(
      `
      UPDATE matters 
      SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        summary = COALESCE($3, summary),
        category_id = COALESCE($4, category_id),
        matter_type_id = COALESCE($5, matter_type_id),
        priority = COALESCE($6, priority),
        scheduled_date = COALESCE($7, scheduled_date),
        notes = COALESCE($8, notes),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
      `,
      [
        title || null,
        content || null,
        summary || null,
        category_id || null,
        matter_type_id || null,
        priority || null,
        scheduled_date || null, // Se vier null, mantém o valor atual
        notes || null,
        id
      ]
    );

    return c.json({
      message: 'Matéria atualizada com sucesso',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar matéria:', err);
    return c.json({ 
      error: 'Erro ao atualizar matéria',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * PUT /api/matters/:id - CORRIGIDO!
 */
// ✅ MANTER APENAS UM DESTES - remova o duplicado
matters.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));
    const body = await c.req.json();

    // Verificar se a matéria existe e se o usuário tem permissão
    const checkResult = await db.query(
      'SELECT id, secretaria_id, author_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    if (matter.status === 'published' && user.role !== 'admin') {
      return c.json({ error: 'Não é possível editar uma matéria já publicada' }, 400);
    }

    const {
      title,
      content,
      summary,
      category_id,
      matter_type_id,
      priority,
      scheduled_date,
      notes
    } = body;

    const result = await db.query(
      `
      UPDATE matters 
      SET 
        title = COALESCE($1, title),
        content = COALESCE($2, content),
        summary = COALESCE($3, summary),
        category_id = COALESCE($4, category_id),
        matter_type_id = COALESCE($5, matter_type_id),
        priority = COALESCE($6, priority),
        scheduled_date = COALESCE($7, scheduled_date),
        notes = COALESCE($8, notes),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
      `,
      [
        title || null,
        content || null,
        summary || null,
        category_id || null,
        matter_type_id || null,
        priority || null,
        scheduled_date || null,
        notes || null,
        id
      ]
    );

    return c.json({
      message: 'Matéria atualizada com sucesso',
      matter: result.rows[0]
    });
  } catch (err: any) {
    console.error('❌ Erro ao atualizar matéria:', err);
    return c.json({ 
      error: 'Erro ao atualizar matéria',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, 500);
  }
});

/**
 * DELETE /api/matters/:id
 */
matters.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ error: 'Não autenticado' }, 401);
    }

    const id = parseInt(c.req.param('id'));

    const checkResult = await db.query(
      'SELECT id, secretaria_id, status FROM matters WHERE id = $1',
      [id]
    );

    const matter = checkResult.rows[0];
    if (!matter) {
      return c.json({ error: 'Matéria não encontrada' }, 404);
    }

    if (user.role === 'secretaria' && matter.secretaria_id !== user.secretaria_id) {
      return c.json({ error: 'Acesso negado' }, 403);
    }

    if (matter.status === 'published' && user.role !== 'admin') {
      return c.json({ error: 'Não é possível excluir uma matéria já publicada' }, 400);
    }

    await db.query('DELETE FROM attachments WHERE matter_id = $1', [id]);
    await db.query('DELETE FROM matters WHERE id = $1', [id]);

    return c.json({ message: 'Matéria excluída com sucesso' });
  } catch (err: any) {
    console.error('Erro ao excluir matéria:', err);
    return c.json({ error: 'Erro ao excluir matéria' }, 500);
  }
});

console.log('✅ matters.ts carregado - CORRIGIDO!');
console.log('🚀 BYPASS de download disponível via BYPASS_DOWNLOAD_AUTH=true no .env');
console.log('📋 Colunas utilizadas: title, content, summary, category_id, matter_type_id, secretaria_id, author_id, status, priority, scheduled_date, notes, created_at, updated_at');

export default matters;