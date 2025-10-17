-- ====================================
-- Migration 0004: Edition Matters Relationship
-- Relacionamento entre Edições e Matérias
-- ====================================

-- Tabela de relacionamento entre edições e matérias
CREATE TABLE IF NOT EXISTS edition_matters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_id INTEGER NOT NULL,
  matter_id INTEGER NOT NULL,
  
  -- Ordem das matérias na edição (para montar o PDF)
  display_order INTEGER NOT NULL,
  
  -- Paginação no PDF
  page_start INTEGER,
  page_end INTEGER,
  
  -- Quando a matéria foi adicionada à edição
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  added_by INTEGER NOT NULL,
  
  FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE,
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (added_by) REFERENCES users(id),
  
  -- Uma matéria só pode aparecer uma vez em cada edição
  UNIQUE(edition_id, matter_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_edition_matters_edition ON edition_matters(edition_id);
CREATE INDEX IF NOT EXISTS idx_edition_matters_matter ON edition_matters(matter_id);
CREATE INDEX IF NOT EXISTS idx_edition_matters_order ON edition_matters(edition_id, display_order);

-- Adicionar campo edition_id nas matérias (se ainda não existir)
-- Isso permite consulta rápida de qual edição uma matéria pertence
ALTER TABLE matters ADD COLUMN edition_id INTEGER REFERENCES editions(id);
CREATE INDEX IF NOT EXISTS idx_matters_edition_id ON matters(edition_id);
