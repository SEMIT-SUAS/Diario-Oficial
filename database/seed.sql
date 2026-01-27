-- =====================================================
-- DOM - Dados Iniciais (Seed Data)
-- PostgreSQL
-- =====================================================

-- =====================================================
-- 1. SECRETARIAS
-- =====================================================
INSERT INTO secretarias (name, acronym, display_order, active) VALUES
('Prefeitura Municipal', 'PREFEITURA', 1, 1),
('Secretaria Municipal de Administração', 'SEMAD', 2, 1),
('Secretaria Municipal de Educação', 'SEMED', 3, 1),
('Secretaria Municipal de Saúde', 'SEMUS', 4, 1),
('Secretaria Municipal de Finanças', 'SEMFAZ', 5, 1),
('Secretaria Municipal de Obras', 'SEMOB', 6, 1),
('Secretaria Municipal de Meio Ambiente', 'SEMMA', 7, 1);

-- =====================================================
-- 2. TIPOS DE MATÉRIA
-- =====================================================
INSERT INTO matter_types (name, description, display_order, active) VALUES
('Decreto', 'Atos administrativos do poder executivo', 1, 1),
('Portaria', 'Atos administrativos de caráter interno', 2, 1),
('Lei', 'Normas jurídicas aprovadas pelo legislativo', 3, 1),
('Edital', 'Comunicações oficiais e chamadas públicas', 4, 1),
('Resolução', 'Decisões administrativas', 5, 1),
('Ato', 'Atos administrativos diversos', 6, 1),
('Extrato', 'Resumos de atos e contratos', 7, 1);

-- =====================================================
-- 3. USUÁRIOS (Senhas: admin123, semad123, etc)
-- =====================================================
-- Senha: admin123 (bcrypt hash)
INSERT INTO users (email, password_hash, name, role, secretaria_id, active) VALUES
('admin@municipio.gov.br', '$2a$10$rN0qJKEZqQqZ5Z5Z5Z5Z5uOYvZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5O', 'Administrador do Sistema', 'admin', NULL, 1);

-- Senha: semad123
INSERT INTO users (email, password_hash, name, role, secretaria_id, active) VALUES
('coordenador@semad.gov.br', '$2a$10$rN0qJKEZqQqZ5Z5Z5Z5Z5uOYvZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5O', 'Coordenador SEMAD', 'semad', 2, 1);

-- Senha: publisher123
INSERT INTO users (email, password_hash, name, role, secretaria_id, active) VALUES
('publicador@semed.gov.br', '$2a$10$rN0qJKEZqQqZ5Z5Z5Z5Z5uOYvZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5O', 'Publicador SEMED', 'publisher', 3, 1);

-- Senha: author123
INSERT INTO users (email, password_hash, name, role, secretaria_id, active) VALUES
('autor@semus.gov.br', '$2a$10$rN0qJKEZqQqZ5Z5Z5Z5Z5uOYvZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5O', 'Autor SEMUS', 'author', 4, 1);

-- =====================================================
-- 4. CONFIGURAÇÕES DO SISTEMA
-- =====================================================
INSERT INTO system_settings (key, value, description) VALUES
('logo_url', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzNjZmZiIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkRPTTwvdGV4dD48L3N2Zz4=', 'Logo do sistema em base64'),
('expediente', 'EXPEDIENTE

PREFEITO MUNICIPAL
João da Silva

VICE-PREFEITO
Maria Santos

SECRETÁRIO MUNICIPAL DE ADMINISTRAÇÃO
Carlos Oliveira

Rua Principal, 100 - Centro
CEP: 65000-000 - São Luís/MA
Tel: (98) 3214-5000
Email: gabinete@saoluis.ma.gov.br
www.saoluis.ma.gov.br', 'Expediente do Diário Oficial Municipal');

-- =====================================================
-- 5. MATÉRIAS DE EXEMPLO
-- =====================================================
INSERT INTO matters (title, content, summary, status, author_id, secretaria_id, matter_type_id, created_at) VALUES
('Convocação para Reunião', '<p>Convoca-se todos os servidores para reunião administrativa no dia 10/12/2024 às 14h.</p>', 'Convocação de reunião administrativa', 'approved', 2, 2, 2, CURRENT_TIMESTAMP),
('Edital de Licitação Nº 001/2024', '<p>A Prefeitura Municipal torna público o Edital de Licitação Nº 001/2024 para contratação de serviços de manutenção predial.</p>', 'Edital de licitação para manutenção', 'approved', 2, 1, 4, CURRENT_TIMESTAMP),
('Nomeação de Servidores', '<p>O Prefeito Municipal, no uso de suas atribuições legais, resolve nomear os servidores aprovados no concurso público.</p>', 'Nomeação de servidores concursados', 'approved', 2, 2, 2, CURRENT_TIMESTAMP);

-- =====================================================
-- FIM DOS DADOS INICIAIS
-- =====================================================
