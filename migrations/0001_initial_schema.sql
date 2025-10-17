-- ====================================
-- DOM - Diário Oficial Municipal
-- Migração Inicial - Estrutura Completa
-- ====================================

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  cpf TEXT UNIQUE,
  role TEXT NOT NULL CHECK(role IN ('admin', 'semad', 'secretaria', 'publico')),
  secretaria_id INTEGER,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME,
  FOREIGN KEY (secretaria_id) REFERENCES secretarias(id)
);

-- Tabela de Secretarias
CREATE TABLE IF NOT EXISTS secretarias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  acronym TEXT NOT NULL UNIQUE,
  email TEXT,
  phone TEXT,
  responsible TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Categorias de Matérias
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT,
  icon TEXT,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Matérias (Publicações)
CREATE TABLE IF NOT EXISTS matters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  matter_type TEXT NOT NULL,
  category_id INTEGER,
  secretaria_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  
  -- Status do fluxo
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'published', 'scheduled', 'archived')),
  
  -- Controle de versão
  version INTEGER DEFAULT 1,
  parent_matter_id INTEGER,
  
  -- Datas de controle
  submitted_at DATETIME,
  reviewed_at DATETIME,
  approved_at DATETIME,
  published_at DATETIME,
  scheduled_date DATETIME,
  
  -- Revisão SEMAD
  reviewer_id INTEGER,
  review_notes TEXT,
  rejection_reason TEXT,
  
  -- Assinatura eletrônica
  signature_hash TEXT,
  signature_type TEXT CHECK(signature_type IN ('eletronica', 'digital', 'none')),
  signed_by INTEGER,
  signed_at DATETIME,
  
  -- Publicação
  edition_number TEXT,
  page_number INTEGER,
  pdf_url TEXT,
  pdf_hash TEXT,
  
  -- Layout
  layout_columns INTEGER DEFAULT 1 CHECK(layout_columns IN (1, 2)),
  
  -- Auditoria
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (secretaria_id) REFERENCES secretarias(id),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  FOREIGN KEY (signed_by) REFERENCES users(id),
  FOREIGN KEY (parent_matter_id) REFERENCES matters(id)
);

-- Tabela de Histórico de Versões
CREATE TABLE IF NOT EXISTS matter_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matter_id INTEGER NOT NULL,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  changed_by INTEGER NOT NULL,
  change_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

-- Tabela de Anexos
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matter_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  uploaded_by INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- Tabela de Edições do Diário
CREATE TABLE IF NOT EXISTS editions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_number TEXT NOT NULL UNIQUE,
  edition_date DATE NOT NULL,
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
  
  -- PDF final da edição
  pdf_url TEXT,
  pdf_hash TEXT,
  total_pages INTEGER,
  
  -- Controle de publicação
  published_at DATETIME,
  published_by INTEGER,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (published_by) REFERENCES users(id)
);

-- Tabela de Feriados
CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('nacional', 'estadual', 'municipal', 'ponto_facultativo')),
  recurring INTEGER DEFAULT 0,
  year INTEGER,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER,
  
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabela de Regras de Publicação
CREATE TABLE IF NOT EXISTS publication_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('schedule', 'deadline', 'approval', 'format')),
  
  -- Configurações de horário
  publication_time TIME,
  cutoff_time TIME,
  
  -- Dias permitidos
  allow_weekends INTEGER DEFAULT 0,
  allow_holidays INTEGER DEFAULT 0,
  
  -- Outras regras
  min_approval_time_hours INTEGER,
  require_review INTEGER DEFAULT 1,
  
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  matter_id INTEGER,
  
  type TEXT NOT NULL CHECK(type IN ('matter_submitted', 'matter_approved', 'matter_rejected', 'matter_published', 'comment_added', 'deadline_alert')),
  
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  
  read INTEGER DEFAULT 0,
  sent_via_email INTEGER DEFAULT 0,
  
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME,
  
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (matter_id) REFERENCES matters(id)
);

-- Tabela de Comentários/Observações
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matter_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  comment TEXT NOT NULL,
  is_internal INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (matter_id) REFERENCES matters(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de Logs de Auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  
  FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- ====================================
-- ÍNDICES PARA PERFORMANCE
-- ====================================

-- Usuários
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_secretaria ON users(secretaria_id);

-- Matérias
CREATE INDEX IF NOT EXISTS idx_matters_status ON matters(status);
CREATE INDEX IF NOT EXISTS idx_matters_secretaria ON matters(secretaria_id);
CREATE INDEX IF NOT EXISTS idx_matters_author ON matters(author_id);
CREATE INDEX IF NOT EXISTS idx_matters_published_date ON matters(published_at);
CREATE INDEX IF NOT EXISTS idx_matters_scheduled_date ON matters(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_matters_category ON matters(category_id);
CREATE INDEX IF NOT EXISTS idx_matters_edition ON matters(edition_number);

-- Versões
CREATE INDEX IF NOT EXISTS idx_versions_matter ON matter_versions(matter_id);

-- Edições
CREATE INDEX IF NOT EXISTS idx_editions_date ON editions(edition_date);
CREATE INDEX IF NOT EXISTS idx_editions_number ON editions(edition_number);
CREATE INDEX IF NOT EXISTS idx_editions_year ON editions(year);

-- Feriados
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- Notificações
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

-- Comentários
CREATE INDEX IF NOT EXISTS idx_comments_matter ON comments(matter_id);

-- Auditoria
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
