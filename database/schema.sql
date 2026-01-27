-- =====================================================
-- DOM - Diário Oficial Municipal
-- PostgreSQL Database Schema
-- =====================================================

-- Drop tables if exist (para recriar)
DROP TABLE IF EXISTS calendar_config CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS edition_matters CASCADE;
DROP TABLE IF EXISTS editions CASCADE;
DROP TABLE IF EXISTS matters CASCADE;
DROP TABLE IF EXISTS matter_types CASCADE;
DROP TABLE IF EXISTS secretarias CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =====================================================
-- 1. TABELA: users (Usuários do Sistema)
-- =====================================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK(role IN ('admin', 'semad', 'publisher', 'author')),
  secretaria_id INTEGER,
  active INTEGER DEFAULT 1,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_secretaria_id ON users(secretaria_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(active);

-- =====================================================
-- 2. TABELA: secretarias (Secretarias Municipais)
-- =====================================================
CREATE TABLE secretarias (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  acronym VARCHAR(50) UNIQUE NOT NULL,
  display_order INTEGER DEFAULT 999,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para secretarias
CREATE INDEX idx_secretarias_acronym ON secretarias(acronym);
CREATE INDEX idx_secretarias_active ON secretarias(active);
CREATE INDEX idx_secretarias_display_order ON secretarias(display_order);

-- =====================================================
-- 3. TABELA: matter_types (Tipos de Matéria)
-- =====================================================
CREATE TABLE matter_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  display_order INTEGER DEFAULT 999,
  active INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para matter_types
CREATE INDEX idx_matter_types_active ON matter_types(active);
CREATE INDEX idx_matter_types_display_order ON matter_types(display_order);

-- =====================================================
-- 4. TABELA: matters (Matérias)
-- =====================================================
CREATE TABLE matters (
  id SERIAL PRIMARY KEY,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'submitted', 'approved', 'rejected', 'published')),
  author_id INTEGER NOT NULL,
  secretaria_id INTEGER NOT NULL,
  matter_type_id INTEGER NOT NULL,
  process_number VARCHAR(100),
  tags TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  submitted_at TIMESTAMP,
  published_at TIMESTAMP,
  pdf_url TEXT,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (secretaria_id) REFERENCES secretarias(id) ON DELETE RESTRICT,
  FOREIGN KEY (matter_type_id) REFERENCES matter_types(id) ON DELETE RESTRICT
);

-- Índices para matters
CREATE INDEX idx_matters_status ON matters(status);
CREATE INDEX idx_matters_author_id ON matters(author_id);
CREATE INDEX idx_matters_secretaria_id ON matters(secretaria_id);
CREATE INDEX idx_matters_matter_type_id ON matters(matter_type_id);
CREATE INDEX idx_matters_created_at ON matters(created_at);
CREATE INDEX idx_matters_published_at ON matters(published_at);

-- =====================================================
-- 5. TABELA: editions (Edições do Diário Oficial)
-- =====================================================
CREATE TABLE editions (
  id SERIAL PRIMARY KEY,
  edition_number VARCHAR(50) UNIQUE NOT NULL,
  edition_date DATE NOT NULL,
  year INTEGER NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  is_supplemental INTEGER DEFAULT 0,
  supplemental_number INTEGER,
  parent_edition_id INTEGER,
  pdf_url TEXT,
  pdf_hash VARCHAR(255),
  total_pages INTEGER DEFAULT 0,
  published_at TIMESTAMP,
  published_by INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_edition_id) REFERENCES editions(id) ON DELETE CASCADE
);

-- Índices para editions
CREATE INDEX idx_editions_status ON editions(status);
CREATE INDEX idx_editions_edition_date ON editions(edition_date);
CREATE INDEX idx_editions_year ON editions(year);
CREATE INDEX idx_editions_published_by ON editions(published_by);
CREATE INDEX idx_editions_parent_edition_id ON editions(parent_edition_id);
CREATE INDEX idx_editions_is_supplemental ON editions(is_supplemental);

-- =====================================================
-- 6. TABELA: edition_matters (Relação N:N)
-- =====================================================
CREATE TABLE edition_matters (
  id SERIAL PRIMARY KEY,
  edition_id INTEGER NOT NULL,
  matter_id INTEGER NOT NULL,
  display_order INTEGER DEFAULT 0,
  added_by INTEGER,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (edition_id) REFERENCES editions(id) ON DELETE CASCADE,
  FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(edition_id, matter_id)
);

-- Índices para edition_matters
CREATE INDEX idx_edition_matters_edition_id ON edition_matters(edition_id);
CREATE INDEX idx_edition_matters_matter_id ON edition_matters(matter_id);
CREATE INDEX idx_edition_matters_display_order ON edition_matters(display_order);

-- =====================================================
-- 7. TABELA: attachments (Anexos)
-- =====================================================
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  matter_id INTEGER NOT NULL,
  filename VARCHAR(500) NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by INTEGER,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (matter_id) REFERENCES matters(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para attachments
CREATE INDEX idx_attachments_matter_id ON attachments(matter_id);
CREATE INDEX idx_attachments_uploaded_at ON attachments(uploaded_at);

-- =====================================================
-- 8. TABELA: audit_logs (Logs de Auditoria)
-- =====================================================
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id INTEGER,
  action VARCHAR(100) NOT NULL,
  old_values TEXT,
  new_values TEXT,
  ip_address VARCHAR(100),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Índices para audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- =====================================================
-- 9. TABELA: system_settings (Configurações)
-- =====================================================
CREATE TABLE system_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by INTEGER,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Índices para system_settings
CREATE INDEX idx_system_settings_key ON system_settings(key);

-- =====================================================
-- 10. TABELA: calendar_config (Calendário)
-- =====================================================
CREATE TABLE calendar_config (
  id SERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  is_business_day INTEGER DEFAULT 1,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para calendar_config
CREATE INDEX idx_calendar_config_date ON calendar_config(date);
CREATE INDEX idx_calendar_config_is_business_day ON calendar_config(is_business_day);

-- =====================================================
-- ADICIONAR FOREIGN KEY: users -> secretarias
-- =====================================================
ALTER TABLE users 
ADD CONSTRAINT fk_users_secretaria 
FOREIGN KEY (secretaria_id) REFERENCES secretarias(id) ON DELETE SET NULL;

-- =====================================================
-- FIM DO SCHEMA
-- =====================================================
