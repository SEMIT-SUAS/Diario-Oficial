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
 */
function generateEditionHTML(data: EditionData): string {
  const { edition, matters } = data;
  
  // Formatar data para exibição
  const editionDate = new Date(edition.edition_date);
  const formattedDate = editionDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
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
    
    /* Cabeçalho da edição */
    .edition-header {
      text-align: center;
      border-bottom: 3px solid #1e40af;
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
      page-break-after: avoid;
    }
    
    .edition-header h1 {
      font-size: 24pt;
      font-weight: bold;
      color: #1e40af;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }
    
    .edition-info {
      font-size: 12pt;
      color: #666;
      margin-top: 0.5rem;
    }
    
    .edition-info strong {
      color: #333;
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
    
    /* Rodapé da edição */
    .edition-footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 3px solid #1e40af;
      text-align: center;
      font-size: 9pt;
      color: #666;
      page-break-inside: avoid;
    }
    
    .edition-footer p {
      margin-bottom: 0.3rem;
    }
    
    .validation-hash {
      font-family: 'Courier New', monospace;
      font-size: 8pt;
      color: #999;
      margin-top: 0.5rem;
      word-break: break-all;
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
    <h1>Diário Oficial Municipal</h1>
    <div class="edition-info">
      <p><strong>Edição Nº:</strong> ${edition.edition_number}</p>
      <p><strong>Ano:</strong> ${edition.year}</p>
      <p><strong>Data de Publicação:</strong> ${formattedDate}</p>
    </div>
  </header>
  
  <main class="edition-content">
    ${mattersHTML}
  </main>
  
  <footer class="edition-footer">
    <p><strong>Diário Oficial Municipal</strong></p>
    <p>Edição ${edition.edition_number} - ${edition.year}</p>
    <p>Publicado em: ${editionDate.toLocaleDateString('pt-BR')}</p>
    <p>Total de matérias publicadas: ${matters.length}</p>
    <p class="validation-hash">
      <strong>Hash de validação:</strong> ${generateEditionHash(edition, matters)}
    </p>
    <p style="margin-top: 1rem; font-size: 8pt;">
      Este documento foi gerado eletronicamente e possui validade legal.<br>
      Para verificar a autenticidade, acesse o portal oficial e informe o hash de validação acima.
    </p>
  </footer>
</body>
</html>
  `.trim();
}

/**
 * Gera um hash único para a edição (para validação de autenticidade)
 */
function generateEditionHash(edition: any, matters: any[]): string {
  const content = JSON.stringify({
    edition_number: edition.edition_number,
    edition_date: edition.edition_date,
    year: edition.year,
    matter_ids: matters.map(m => m.id).sort(),
    matter_count: matters.length
  });
  
  return generateHash(content);
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
  data: EditionData
): Promise<PDFResult> {
  try {
    // Gerar HTML da edição
    const htmlContent = generateEditionHTML(data);
    
    // Gerar hash do conteúdo
    const contentHash = generateEditionHash(data.edition, data.matters);
    
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
  const calculatedHash = generateEditionHash(edition, matters as any[]);
  
  return calculatedHash === providedHash;
}
