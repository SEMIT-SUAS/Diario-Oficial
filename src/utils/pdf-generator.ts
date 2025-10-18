// ====================================
// DOM - PDF Generator Utility
// Geração de PDFs do Diário Oficial
// ====================================

/**
 * IMPORTANTE: Cloudflare Workers não suporta bibliotecas Node.js tradicionais de PDF
 * como PDFKit ou jsPDF (que usam Buffer e outras APIs Node.js).
 * 
 * Estratégia para geração de PDF em Cloudflare Workers:
 * 1. Gerar HTML bem formatado com CSS print-friendly
 * 2. Usar serviço externo de conversão HTML→PDF (ex: Gotenberg, Puppeteer Cloud)
 * 3. OU usar API do Cloudflare Browser Rendering (quando disponível)
 * 4. Por ora, vamos gerar um HTML estruturado que pode ser convertido posteriormente
 */

import { generateHash } from './auth';

interface EditionData {
  edition: {
    id: number;
    edition_number: string;
    edition_date: string;
    year: number;
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
  }>;
}

interface PDFResult {
  url: string;
  hash: string;
  totalPages: number;
  htmlContent?: string;
}

/**
 * Gera o HTML completo da edição do Diário Oficial
 * Seguindo o layout do PDF real de São Luís
 */
function generateEditionHTML(data: EditionData, validationHash: string, logoUrl: string = ''): string {
  const { edition, matters } = data;
  
  // Formatar data para exibição (ex: QUINTA * 16 DE OUTUBRO DE 2025)
  const editionDate = new Date(edition.edition_date);
  const dayOfWeek = editionDate.toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
  const day = editionDate.getDate();
  const month = editionDate.toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase();
  const year = editionDate.getFullYear();
  const formattedDate = `${dayOfWeek} * ${day} DE ${month} DE ${year}`;
  
  // Calcular ANO (romano ou numérico - vou usar numérico)
  const foundationYear = 1980; // Assumindo fundação do diário
  const yearsSinceFoundation = year - foundationYear;
  
  // Gerar índice organizado por Secretaria e Tipo
  const indexBySecretaria: Record<string, Record<string, any[]>> = {};
  let pageCounter = 1;
  
  matters.forEach((matter) => {
    const secName = matter.secretaria_acronym 
      ? `${matter.secretaria_acronym.toUpperCase()}` 
      : 'OUTROS';
    const fullSecName = matter.secretaria_name || 'Outros';
    const matterType = (matter as any).matter_type_name || 'Outros';
    
    if (!indexBySecretaria[secName]) {
      indexBySecretaria[secName] = { fullName: fullSecName, types: {} };
    }
    
    if (!indexBySecretaria[secName].types[matterType]) {
      indexBySecretaria[secName].types[matterType] = [];
    }
    
    indexBySecretaria[secName].types[matterType].push({
      ...matter,
      page: pageCounter
    });
    pageCounter++;
  });
  
  // Ordenar secretarias: primeiro PREFEITURA, depois alfabeticamente
  const sortedSecretarias = Object.keys(indexBySecretaria).sort((a, b) => {
    if (a.includes('PREFEITURA')) return -1;
    if (b.includes('PREFEITURA')) return 1;
    return a.localeCompare(b);
  });
  
  // Gerar HTML do índice (formato do PDF real)
  const indexHTML = `
    <div class="index-section">
      <h2 class="index-title">ÍNDICE - PREFEITURA MUNICIPAL DE SÃO LUÍS</h2>
      ${sortedSecretarias.map(secAcronym => {
        const secData = indexBySecretaria[secAcronym];
        const types = secData.types;
        const sortedTypes = Object.keys(types).sort();
        
        return `
          <div class="index-secretaria">
            <h3 class="index-secretaria-name">${secData.fullName.toUpperCase()}</h3>
            ${sortedTypes.map(typeName => {
              const mattersList = types[typeName];
              
              return mattersList.map(m => `
                <div class="index-item">
                  <span class="index-item-title">${m.title.toUpperCase()}</span>
                  <span class="index-item-dots">.................................................................</span>
                  <span class="index-item-page">${m.page}</span>
                </div>
              `).join('');
            }).join('')}
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  // Gerar HTML de cada matéria
  const mattersHTML = matters.map((matter, index) => {
    const columns = matter.layout_columns === 2 ? 'columns-2' : 'columns-1';
    
    return `
      <article class="matter-item ${columns}" data-matter-id="${matter.id}">
        <div class="matter-header">
          <h2 class="matter-title">${matter.title}</h2>
          <div class="matter-meta">
            <span class="secretaria">${matter.secretaria_acronym} - ${matter.secretaria_name}</span>
            ${matter.summary ? `<p class="matter-summary">${matter.summary}</p>` : ''}
          </div>
        </div>
        
        <div class="matter-content">
          ${matter.content}
        </div>
        
        <div class="matter-footer">
          <div class="signature-info">
            ${matter.signed_at ? `
              <p><strong>Assinado digitalmente em:</strong> ${new Date(matter.signed_at).toLocaleString('pt-BR')}</p>
              ${matter.signature_hash ? `<p class="signature-hash"><strong>Hash:</strong> ${matter.signature_hash.substring(0, 16)}...</p>` : ''}
            ` : ''}
          </div>
          <div class="author-info">
            <p><strong>Responsável:</strong> ${matter.author_name}</p>
          </div>
        </div>
      </article>
      ${index < matters.length - 1 ? '<hr class="matter-divider">' : ''}
    `;
  }).join('\n');
  
  // HTML completo com estilos para impressão
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diário Oficial Municipal - Edição ${edition.edition_number}</title>
  <style>
    /* Reset e configurações base */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    @page {
      size: A4;
      margin: 2cm 1.5cm;
      
      @top-center {
        content: "Diário Oficial Municipal";
        font-family: 'Georgia', serif;
        font-size: 10pt;
        color: #666;
      }
      
      @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font-family: 'Georgia', serif;
        font-size: 9pt;
        color: #666;
      }
    }
    
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.6;
      color: #333;
      background: white;
    }
    
    /* Cabeçalho da edição - Estilo do PDF real */
    .edition-header {
      border: 3px solid #0066cc;
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 2rem;
      page-break-after: avoid;
      background: linear-gradient(to bottom, #f0f9ff 0%, white 100%);
    }
    
    .header-top {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 1rem;
    }
    
    .header-left, .header-right {
      font-size: 9pt;
      font-weight: bold;
      color: #333;
    }
    
    .header-right {
      text-align: right;
    }
    
    .header-center {
      text-align: center;
    }
    
    .edition-header .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 0.5rem;
      display: block;
    }
    
    .logo-placeholder {
      font-size: 60px;
      margin: 0 auto 0.5rem;
    }
    
    .edition-header h1 {
      font-size: 36pt;
      font-weight: bold;
      color: #1e40af;
      margin: 0;
      letter-spacing: 2px;
    }
    
    .edition-header .highlight {
      color: #0066cc;
    }
    
    .edition-header .subtitle {
      font-size: 11pt;
      color: #666;
      margin-top: 0.3rem;
    }
    
    /* Índice - Estilo do PDF real */
    .index-section {
      margin: 1rem 0;
      padding: 0;
      background-color: #f8fafc;
      page-break-after: always;
    }
    
    .index-title {
      font-size: 14pt;
      font-weight: bold;
      color: #000;
      text-align: center;
      margin-bottom: 1rem;
      text-transform: uppercase;
      background-color: #e0e0e0;
      padding: 0.5rem;
      border-top: 2px solid #000;
      border-bottom: 2px solid #000;
    }
    
    .index-secretaria {
      margin-bottom: 1rem;
      page-break-inside: avoid;
    }
    
    .index-secretaria-name {
      font-size: 11pt;
      font-weight: bold;
      color: #000;
      margin-bottom: 0.3rem;
      text-transform: uppercase;
      padding: 0.2rem 0;
    }
    
    .index-item {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 0.5rem;
      padding: 0.15rem 0;
      font-size: 9pt;
      line-height: 1.3;
      align-items: center;
    }
    
    .index-item-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .index-item-dots {
      color: #ccc;
      overflow: hidden;
      white-space: nowrap;
    }
    
    .index-item-page {
      font-weight: bold;
      min-width: 30px;
      text-align: right;
    }
    
    .index-matter-title {
      flex: 1;
      color: #333;
    }
    
    .index-matter-page {
      margin-left: 1rem;
      color: #666;
      font-weight: bold;
      white-space: nowrap;
    }
    
    /* Matérias */
    .matter-item {
      margin-bottom: 2rem;
      page-break-inside: avoid;
    }
    
    .matter-header {
      margin-bottom: 1rem;
      page-break-after: avoid;
    }
    
    .matter-title {
      font-size: 14pt;
      font-weight: bold;
      color: #1e40af;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
    }
    
    .matter-meta {
      font-size: 10pt;
      color: #666;
      margin-bottom: 0.5rem;
    }
    
    .secretaria {
      font-weight: bold;
      color: #059669;
    }
    
    .matter-summary {
      font-style: italic;
      margin-top: 0.5rem;
      color: #555;
    }
    
    .matter-content {
      text-align: justify;
      margin-bottom: 1rem;
      hyphens: auto;
    }
    
    .matter-content p {
      margin-bottom: 0.8rem;
    }
    
    .matter-content h1,
    .matter-content h2,
    .matter-content h3 {
      margin-top: 1rem;
      margin-bottom: 0.5rem;
      color: #1e40af;
    }
    
    .matter-content ul,
    .matter-content ol {
      margin-left: 2rem;
      margin-bottom: 0.8rem;
    }
    
    .matter-content table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    
    .matter-content table th,
    .matter-content table td {
      border: 1px solid #ccc;
      padding: 0.5rem;
      text-align: left;
    }
    
    .matter-content table th {
      background-color: #f3f4f6;
      font-weight: bold;
    }
    
    /* Layout de colunas */
    .columns-2 .matter-content {
      column-count: 2;
      column-gap: 1.5rem;
      column-rule: 1px solid #ddd;
    }
    
    .columns-1 .matter-content {
      column-count: 1;
    }
    
    .matter-footer {
      font-size: 9pt;
      color: #666;
      border-top: 1px solid #e5e7eb;
      padding-top: 0.5rem;
      margin-top: 1rem;
      page-break-inside: avoid;
    }
    
    .signature-info {
      margin-bottom: 0.5rem;
    }
    
    .signature-hash {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
      color: #999;
      word-break: break-all;
    }
    
    .author-info {
      font-style: italic;
    }
    
    .matter-divider {
      border: none;
      border-top: 2px dashed #d1d5db;
      margin: 2rem 0;
    }
    
    /* Rodapé da edição - Estilo do PDF real */
    .edition-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #f8fafc;
      border-top: 2px solid #0066cc;
      padding: 0.5rem 1rem;
      font-size: 7pt;
      color: #333;
      page-break-inside: avoid;
    }
    
    .footer-content {
      display: grid;
      grid-template-columns: 2fr auto 2fr;
      gap: 1rem;
      align-items: center;
      margin-bottom: 0.3rem;
    }
    
    .footer-left {
      text-align: left;
    }
    
    .footer-center {
      text-align: center;
    }
    
    .footer-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    
    .footer-text {
      margin: 0;
      line-height: 1.3;
    }
    
    .footer-url {
      margin: 0;
      font-weight: bold;
      color: #0066cc;
    }
    
    .footer-page {
      font-weight: bold;
      font-size: 8pt;
      margin: 0;
    }
    
    .qr-code-placeholder {
      margin-top: 0.2rem;
    }
    
    .validation-info {
      text-align: center;
      padding-top: 0.3rem;
      border-top: 1px solid #ddd;
    }
    
    .validation-hash {
      font-family: 'Courier New', monospace;
      font-size: 7pt;
      color: #666;
      margin: 0;
    }
    
    /* Estilos para impressão */
    @media print {
      body {
        background: white;
      }
      
      .matter-item {
        page-break-inside: avoid;
      }
      
      .matter-header {
        page-break-after: avoid;
      }
      
      .matter-footer {
        page-break-inside: avoid;
      }
      
      a {
        text-decoration: none;
        color: inherit;
      }
      
      /* Evitar quebra de página em elementos importantes */
      h1, h2, h3, h4, h5, h6 {
        page-break-after: avoid;
      }
      
      img {
        max-width: 100%;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <header class="edition-header">
    <div class="header-top">
      <div class="header-left">SÃO LUÍS/MA * ${formattedDate}</div>
      <div class="header-center">
        ${logoUrl ? `<img src="${logoUrl}" alt="Brasão" class="logo">` : `<div class="logo-placeholder">🏛️</div>`}
        <h1>Diário <span class="highlight">🗃️</span> Oficial</h1>
        <p class="subtitle">Município de São Luís</p>
      </div>
      <div class="header-right">ANO XLV * N.º ${edition.edition_number} * ISSN 2764-8958</div>
    </div>
  </header>
  
  ${indexHTML}
  
  <main class="edition-content">
    ${mattersHTML}
  </main>
  
  <footer class="edition-footer">
    <div class="footer-content">
      <div class="footer-left">
        <p class="footer-text">Este documento pode ser verificado no endereço eletrônico</p>
        <p class="footer-url">https://diariooficial.saoluis.ma.gov.br</p>
      </div>
      <div class="footer-center">
        <p class="footer-page"><strong>1 / ${matters.length + 1}</strong></p>
      </div>
      <div class="footer-right">
        <p class="footer-text">Documento assinado com certificado digital e carimbo de tempo,</p>
        <p class="footer-text">conforme Instrução Normativa N.º 70/2021 do TCE/MA.</p>
        <div class="qr-code-placeholder" title="QR Code para verificação">
          <svg viewBox="0 0 100 100" width="60" height="60">
            <rect width="100" height="100" fill="#fff"/>
            <path d="M10,10 h20 v20 h-20 z M70,10 h20 v20 h-20 z M10,70 h20 v20 h-20 z" fill="#000"/>
            <text x="50" y="55" font-size="12" text-anchor="middle">QR</text>
          </svg>
        </div>
      </div>
    </div>
    <div class="validation-info">
      <p class="validation-hash">
        <strong>Código Identificador:</strong> ${validationHash.substring(0, 36)}
      </p>
    </div>
  </footer>
</body>
</html>
  `.trim();
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
 * Gera o PDF da edição (ou HTML por enquanto)
 * 
 * NOTA: Esta implementação retorna o HTML gerado.
 * Em produção, você precisará integrar com um serviço de conversão HTML→PDF
 * como:
 * - Gotenberg (self-hosted)
 * - PDFShift API
 * - HTML2PDF API
 * - Cloudflare Browser Rendering (quando disponível)
 */
export async function generateEditionPDF(
  r2Bucket: R2Bucket,
  data: EditionData,
  db: D1Database
): Promise<PDFResult> {
  try {
    // Buscar logo da prefeitura do sistema de configurações
    let logoUrl = '';
    try {
      const logoSetting = await db.prepare(
        "SELECT value FROM system_settings WHERE key = 'logo_url'"
      ).first();
      
      if (logoSetting && logoSetting.value) {
        // O value está em JSON, precisa fazer parse
        logoUrl = JSON.parse(logoSetting.value as string);
      }
    } catch (logoError) {
      console.warn('Logo não encontrado nas configurações:', logoError);
      // Continua sem logo se não encontrar
    }
    
    // Gerar hash do conteúdo PRIMEIRO
    const contentHash = await generateEditionHash(data.edition, data.matters);
    
    // Gerar HTML da edição com o hash já calculado e o logo
    const htmlContent = generateEditionHTML(data, contentHash, logoUrl);
    
    // Nome do arquivo
    const filename = `diario-oficial-${data.edition.edition_number.replace(/\//g, '-')}-${data.edition.year}.html`;
    
    // Por enquanto, salvar o HTML no R2
    // Em produção, aqui você converteria HTML → PDF usando um serviço externo
    await r2Bucket.put(filename, htmlContent, {
      httpMetadata: {
        contentType: 'text/html; charset=utf-8',
      },
      customMetadata: {
        editionNumber: data.edition.edition_number,
        editionDate: data.edition.edition_date,
        year: data.edition.year.toString(),
        matterCount: data.matters.length.toString(),
        hash: contentHash
      }
    });
    
    // URL pública do arquivo (R2 bucket deve estar configurado com domínio público)
    const publicUrl = `https://dom-pdfs.your-domain.com/${filename}`;
    
    // Estimativa de páginas (aproximadamente 1 página por matéria + cabeçalho/rodapé)
    const estimatedPages = Math.ceil(data.matters.length * 0.8) + 1;
    
    return {
      url: publicUrl,
      hash: contentHash,
      totalPages: estimatedPages,
      htmlContent // Retornar HTML também para debug/preview
    };
    
  } catch (error) {
    console.error('Error generating edition PDF:', error);
    throw new Error(`Falha ao gerar PDF: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * IMPLEMENTAÇÃO FUTURA: Converter HTML para PDF usando serviço externo
 * 
 * Exemplo com Gotenberg:
 * 
 * const response = await fetch('https://gotenberg.your-domain.com/forms/chromium/convert/html', {
 *   method: 'POST',
 *   body: formData,
 *   headers: { ... }
 * });
 * 
 * const pdfBlob = await response.arrayBuffer();
 * await r2Bucket.put(pdfFilename, pdfBlob, { ... });
 */

/**
 * Valida se um hash de edição é autêntico
 */
export async function validateEditionHash(
  db: D1Database,
  editionId: number,
  providedHash: string
): Promise<boolean> {
  // Buscar edição e suas matérias
  const edition = await db.prepare('SELECT * FROM editions WHERE id = ?').bind(editionId).first();
  
  if (!edition) {
    return false;
  }
  
  const { results: matters } = await db.prepare(`
    SELECT m.id
    FROM edition_matters em
    INNER JOIN matters m ON em.matter_id = m.id
    WHERE em.edition_id = ?
    ORDER BY em.display_order ASC
  `).bind(editionId).all();
  
  // Recalcular hash
  const calculatedHash = await generateEditionHash(edition, matters as any[]);
  
  return calculatedHash === providedHash;
}
