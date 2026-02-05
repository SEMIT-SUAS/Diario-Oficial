// ====================================
// DOM - PDF Generator Utility
// Geração de PDFs do Diário Oficial - Versão PostgreSQL
// ====================================

import { generateHash } from './auth';

interface EditionData {
  edition: {
    id: number;
    edition_number: string;
    edition_date: string;
    year: number;
    is_supplemental?: number;
    parent_edition_id?: number;
    parent_edition_number?: string;
    status?: string;
  };
  matters: Array<{
    id: number;
    title: string;
    content: string;
    summary?: string;
    secretaria_name: string;
    secretaria_acronym: string;
    author_name: string;
    display_order: number;
    matter_type_id: number;
    layout_columns: number;
    signed_at?: string;
    signed_by?: number;
    signature_hash?: string;
    attachments?: Array<{
      id: number;
      filename: string;
      file_url: string;
      file_size?: number;
      mime_type?: string;
    }>;
  }>;
  publisher?: {
    name: string;
    secretaria_acronym: string;
  } | null;
}

interface PDFResult {
  url?: string;
  hash?: string;
  totalPages?: number;
  htmlContent: string;
}

/**
 * Gera um hash único para a edição (para validação de autenticidade)
 */
async function generateEditionHash(edition: any, matters: any[]): Promise<string> {
  const content = JSON.stringify({
    edition_number: edition.edition_number,
    edition_date: edition.edition_date,
    year: edition.year,
    matter_ids: matters.map(m => m.id).sort(),
    matter_count: matters.length
  });
  
  return await generateHash(content);
}

/**
 * Busca configurações do sistema do banco PostgreSQL
 */
async function fetchSystemSettings(db: any) {
  try {
    const result = await db.query(`
      SELECT key, value FROM settings 
      WHERE key IN ('logo_url', 'expediente', 'city_name', 'office_hours')
    `);
    
    const settings: Record<string, any> = {};
    result.rows.forEach((row: any) => {
      try {
        // Tentar fazer parse de JSON, senão usar o valor direto
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    
    return settings;
  } catch (error) {
    console.warn('⚠️  Erro ao buscar configurações:', error);
    return {};
  }
}

/**
 * Gera o HTML completo da edição do Diário Oficial
 */
function generateEditionHTML(
  data: EditionData, 
  validationHash: string, 
  settings: {
    logo_url?: string;
    expediente?: string;
    city_name?: string;
    office_hours?: string;
  } = {}
): string {
  const { edition, matters } = data;
  const cityName = settings.city_name || 'Município';
  const expedienteText = settings.expediente || '';
  const logoUrl = settings.logo_url || '';
  const officeHours = settings.office_hours || '08:00 às 17:00';
  
  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).toUpperCase();
  };
  
  const formattedDate = formatDate(edition.edition_date);
  
  // Gerar índice organizado por Secretaria
  const indexBySecretaria: Record<string, any[]> = {};
  let pageCounter = 1;
  
  matters.forEach((matter) => {
    const secAcronym = matter.secretaria_acronym || 'OUTROS';
    
    if (!indexBySecretaria[secAcronym]) {
      indexBySecretaria[secAcronym] = [];
    }
    
    indexBySecretaria[secAcronym].push({
      ...matter,
      page: pageCounter
    });
    
    pageCounter++;
  });
  
  // Ordenar secretarias
  const sortedSecretarias = Object.keys(indexBySecretaria).sort((a, b) => {
    if (a.includes('PREFEITURA')) return -1;
    if (b.includes('PREFEITURA')) return 1;
    return a.localeCompare(b);
  });
  
  // Gerar HTML do índice
  const indexHTML = sortedSecretarias.map(secAcronym => {
    const mattersList = indexBySecretaria[secAcronym];
    
    return `
      <div class="index-secretaria">
        <h3 class="index-secretaria-name">${secAcronym}</h3>
        ${mattersList.map(m => `
          <div class="index-item">
            <span class="index-item-title">${m.title.toUpperCase()}</span>
            <span class="index-item-dots">.................................</span>
            <span class="index-item-page">${m.page}</span>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
  
  // Gerar HTML de cada matéria
  const mattersHTML = matters.map((matter, index) => {
    const columns = matter.layout_columns === 2 ? 'columns-2' : 'columns-1';
    
    return `
      <article class="matter-item ${columns}" data-matter-id="${matter.id}">
        <div class="matter-header">
          <div class="matter-number">${index + 1}</div>
          <div class="matter-title-section">
            <h2 class="matter-title">${matter.title}</h2>
            <div class="matter-meta">
              <span class="secretaria">${matter.secretaria_acronym} - ${matter.secretaria_name}</span>
            </div>
          </div>
        </div>
        
        ${matter.summary ? `
          <div class="matter-summary">
            <strong>Resumo:</strong> ${matter.summary}
          </div>
        ` : ''}
        
        <div class="matter-content">
          ${matter.content}
        </div>
        
        ${matter.attachments && matter.attachments.length > 0 ? `
          <div class="matter-attachments">
            <h4 class="attachments-title">Anexos:</h4>
            <ul class="attachments-list">
              ${matter.attachments.map(att => `
                <li class="attachment-item">
                  <a href="${att.file_url}" target="_blank" class="attachment-link">
                    📎 ${att.filename}
                    ${att.file_size ? ` (${formatFileSize(att.file_size)})` : ''}
                  </a>
                </li>
              `).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="matter-footer">
          <div class="author-info">
            <strong>Autor:</strong> ${matter.author_name || 'Não informado'}
          </div>
          ${matter.signed_at ? `
            <div class="signature-info">
              <strong>Assinado em:</strong> ${formatDate(matter.signed_at)}
            </div>
          ` : ''}
        </div>
      </article>
      ${index < matters.length - 1 ? '<hr class="matter-divider">' : ''}
    `;
  }).join('\n');
  
  // HTML completo
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diário Oficial - Edição ${edition.edition_number}</title>
  <style>
    /* Reset e configurações base */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
      background: #fff;
      padding: 20mm;
    }
    
    @media print {
      body {
        padding: 0;
      }
      
      .page-break {
        page-break-before: always;
      }
    }
    
    /* Cabeçalho */
    .edition-header {
      text-align: center;
      margin-bottom: 20px;
      border-bottom: 3px solid #000;
      padding-bottom: 15px;
    }
    
    .logo {
      max-height: 80px;
      margin-bottom: 10px;
    }
    
    .main-title {
      font-size: 24pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 10px 0;
    }
    
    .subtitle {
      font-size: 14pt;
      margin-bottom: 10px;
    }
    
    .edition-info {
      font-size: 12pt;
      margin: 15px 0;
    }
    
    .edition-number {
      font-weight: bold;
      color: #000;
    }
    
    .edition-date {
      font-style: italic;
    }
    
    /* Índice */
    .index-section {
      margin: 30px 0;
      border: 1px solid #ccc;
      padding: 15px;
      background: #f9f9f9;
    }
    
    .index-title {
      font-size: 16pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 20px;
      color: #000;
    }
    
    .index-secretaria {
      margin-bottom: 15px;
    }
    
    .index-secretaria-name {
      font-size: 12pt;
      font-weight: bold;
      color: #333;
      margin-bottom: 8px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    
    .index-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 10pt;
    }
    
    .index-item-title {
      flex: 1;
    }
    
    .index-item-dots {
      flex-grow: 1;
      border-bottom: 1px dotted #999;
      margin: 0 10px;
      height: 12px;
    }
    
    .index-item-page {
      font-weight: bold;
    }
    
    /* Matérias */
    .matter-item {
      margin: 25px 0;
      border: 1px solid #ddd;
      padding: 20px;
      page-break-inside: avoid;
    }
    
    .matter-header {
      display: flex;
      margin-bottom: 15px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 10px;
    }
    
    .matter-number {
      font-size: 20pt;
      font-weight: bold;
      background: #000;
      color: #fff;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 15px;
      border-radius: 5px;
    }
    
    .matter-title-section {
      flex: 1;
    }
    
    .matter-title {
      font-size: 14pt;
      font-weight: bold;
      color: #000;
      margin-bottom: 5px;
    }
    
    .matter-meta {
      font-size: 10pt;
      color: #666;
    }
    
    .secretaria {
      font-weight: bold;
      color: #0066cc;
    }
    
    .matter-summary {
      background: #f5f5f5;
      padding: 10px;
      margin: 15px 0;
      border-left: 3px solid #0066cc;
      font-style: italic;
    }
    
    .matter-content {
      margin: 15px 0;
      text-align: justify;
    }
    
    .matter-content p {
      margin-bottom: 10px;
    }
    
    .matter-attachments {
      margin: 15px 0;
      padding: 10px;
      background: #f8f9fa;
      border-left: 3px solid #28a745;
    }
    
    .attachments-title {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 8px;
      color: #28a745;
    }
    
    .attachments-list {
      list-style: none;
      padding-left: 0;
    }
    
    .attachment-item {
      margin-bottom: 5px;
    }
    
    .attachment-link {
      color: #0066cc;
      text-decoration: none;
    }
    
    .attachment-link:hover {
      text-decoration: underline;
    }
    
    /* Layout de colunas */
    .columns-2 .matter-content {
      column-count: 2;
      column-gap: 20px;
    }
    
    .columns-1 .matter-content {
      column-count: 1;
    }
    
    /* Rodapé da matéria */
    .matter-footer {
      margin-top: 15px;
      padding-top: 10px;
      border-top: 1px dashed #ccc;
      font-size: 10pt;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
    
    .author-info, .signature-info {
      flex: 1;
    }
    
    .matter-divider {
      border: none;
      border-top: 2px dashed #ddd;
      margin: 30px 0;
    }
    
    /* Rodapé da edição */
    .edition-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #000;
      text-align: center;
      font-size: 10pt;
      color: #666;
    }
    
    .publisher-info {
      margin-bottom: 10px;
    }
    
    .validation-info {
      margin-top: 15px;
      padding: 10px;
      background: #f8f9fa;
      border: 1px solid #ddd;
      font-family: monospace;
      font-size: 9pt;
      word-break: break-all;
    }
    
    .validation-hash {
      color: #333;
    }
    
    .office-hours {
      margin-top: 10px;
      font-style: italic;
    }
    
    /* Suplementar */
    .supplemental-notice {
      background: #fff3cd;
      border: 1px solid #ffeaa7;
      padding: 15px;
      margin: 15px 0;
      text-align: center;
      font-weight: bold;
      color: #856404;
    }
    
    /* Expediente */
    .expediente-section {
      background: #f8f9fa;
      border: 1px solid #ddd;
      padding: 15px;
      margin: 15px 0;
    }
    
    .expediente-title {
      font-size: 12pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
      color: #000;
    }
    
    .expediente-content {
      font-size: 10pt;
      text-align: justify;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <header class="edition-header">
    ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : ''}
    
    <h1 class="main-title">DIÁRIO OFICIAL</h1>
    <h2 class="subtitle">${cityName.toUpperCase()}</h2>
    
    <div class="edition-info">
      <div class="edition-number">Edição: ${edition.edition_number}</div>
      <div class="edition-date">${formattedDate}</div>
      <div>Ano: ${edition.year}</div>
    </div>
  </header>
  
  ${edition.is_supplemental ? `
    <div class="supplemental-notice">
      ⚠️ EDIÇÃO SUPLEMENTAR
      ${edition.parent_edition_number ? `da Edição ${edition.parent_edition_number}` : ''}
    </div>
  ` : ''}
  
  ${expedienteText ? `
    <section class="expediente-section">
      <h3 class="expediente-title">EXPEDIENTE</h3>
      <div class="expediente-content">${expedienteText}</div>
    </section>
  ` : ''}
  
  ${indexHTML ? `
    <section class="index-section">
      <h2 class="index-title">ÍNDICE</h2>
      ${indexHTML}
    </section>
  ` : ''}
  
  <main class="edition-content">
    ${mattersHTML}
  </main>
  
  ${data.publisher ? `
    <div class="publisher-info">
      <strong>Publicado por:</strong> ${data.publisher.name} 
      ${data.publisher.secretaria_acronym ? `(${data.publisher.secretaria_acronym})` : ''}
      <br>
      <em>${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</em>
    </div>
  ` : ''}
  
  <div class="office-hours">
    <strong>Expediente:</strong> ${officeHours}
  </div>
  
  <footer class="edition-footer">
    <div class="validation-info">
      <strong>Código de Validação:</strong>
      <div class="validation-hash">${validationHash}</div>
      <small>Use este código para verificar a autenticidade do documento em https://diariooficial.saoluis.ma.gov.br/verificar</small>
    </div>
  </footer>
</body>
</html>`;
}

/**
 * Formata tamanho de arquivo
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gera o PDF/HTML da edição - Versão PostgreSQL
 */
export async function generateEditionPDF(
  c: any,
  data: EditionData,
  db: any
): Promise<PDFResult> {
  try {
    console.log('🎨 Gerando PDF/HTML para edição:', data.edition.edition_number);
    
    // Buscar configurações do sistema
    const settings = await fetchSystemSettings(db);
    
    // Gerar hash do conteúdo
    const contentHash = await generateEditionHash(data.edition, data.matters);
    
    // Gerar HTML da edição
    const htmlContent = generateEditionHTML(data, contentHash, settings);
    
    // Estimativa de páginas
    const estimatedPages = Math.ceil(data.matters.length * 0.8) + 1;
    
    return {
      htmlContent,
      hash: contentHash,
      totalPages: estimatedPages
    };
    
  } catch (error: any) {
    console.error('❌ Erro ao gerar PDF/HTML:', error);
    throw new Error(`Falha ao gerar PDF: ${error.message}`);
  }
}

/**
 * Valida se um hash de edição é autêntico
 */
export async function validateEditionHash(
  db: any,
  editionId: number,
  providedHash: string
): Promise<boolean> {
  try {
    // Buscar edição
    const editionResult = await db.query(
      'SELECT * FROM editions WHERE id = $1',
      [editionId]
    );
    
    const edition = editionResult.rows[0];
    
    if (!edition) {
      return false;
    }
    
    // Buscar matérias da edição
    const mattersResult = await db.query(`
      SELECT m.id
      FROM edition_matters em
      INNER JOIN matters m ON em.matter_id = m.id
      WHERE em.edition_id = $1
      ORDER BY em.display_order ASC
    `, [editionId]);
    
    const matters = mattersResult.rows;
    
    // Recalcular hash
    const calculatedHash = await generateEditionHash(edition, matters);
    
    return calculatedHash === providedHash;
    
  } catch (error) {
    console.error('❌ Erro ao validar hash:', error);
    return false;
  }
}