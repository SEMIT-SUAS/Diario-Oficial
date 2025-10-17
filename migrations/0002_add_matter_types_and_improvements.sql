-- ====================================
-- DOM - Melhorias e Novos Campos
-- Migração 0002
-- ====================================

-- Tabela de Tipos de Matéria
CREATE TABLE IF NOT EXISTS matter_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  color TEXT,
  active INTEGER DEFAULT 1,
  order_position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Adicionar novos campos à tabela matters
ALTER TABLE matters ADD COLUMN matter_type_id INTEGER REFERENCES matter_types(id);
ALTER TABLE matters ADD COLUMN priority TEXT DEFAULT 'normal' CHECK(priority IN ('urgent', 'high', 'normal', 'low'));
ALTER TABLE matters ADD COLUMN publication_date DATE;
ALTER TABLE matters ADD COLUMN observations TEXT;
ALTER TABLE matters ADD COLUMN submitted_by INTEGER REFERENCES users(id);
ALTER TABLE matters ADD COLUMN canceled_at DATETIME;
ALTER TABLE matters ADD COLUMN canceled_by INTEGER REFERENCES users(id);
ALTER TABLE matters ADD COLUMN cancelation_reason TEXT;

-- Adicionar timestamp do servidor
ALTER TABLE matters ADD COLUMN server_timestamp DATETIME;

-- Índices
CREATE INDEX IF NOT EXISTS idx_matters_matter_type ON matters(matter_type_id);
CREATE INDEX IF NOT EXISTS idx_matters_priority ON matters(priority);
CREATE INDEX IF NOT EXISTS idx_matters_publication_date ON matters(publication_date);

-- Inserir tipos de matéria padrão
INSERT INTO matter_types (name, description, icon, color, order_position) VALUES
('Decreto', 'Decretos municipais', 'gavel', '#dc2626', 1),
('Lei', 'Leis municipais', 'balance-scale', '#2563eb', 2),
('Portaria', 'Portarias administrativas', 'file-signature', '#16a34a', 3),
('Edital', 'Editais de licitação e concurso', 'bullhorn', '#ea580c', 4),
('Ato', 'Atos administrativos', 'stamp', '#9333ea', 5),
('Resolução', 'Resoluções', 'check-circle', '#0891b2', 6),
('Convocação', 'Convocações e chamamentos', 'bell', '#0891b2', 7),
('Extrato', 'Extratos de contratos', 'file-contract', '#64748b', 8),
('Aviso', 'Avisos diversos', 'info-circle', '#eab308', 9),
('Comunicado', 'Comunicados oficiais', 'newspaper', '#6366f1', 10),
('Instrução Normativa', 'Instruções normativas', 'book', '#8b5cf6', 11),
('Despacho', 'Despachos administrativos', 'paper-plane', '#ec4899', 12);
