-- ====================================
-- DOM - Dados Iniciais (Seed) - PostgreSQL
-- ====================================

-- Inserir Secretarias Padrão
INSERT INTO secretarias (id, name, acronym, email, active) VALUES
(1, 'Secretaria Municipal de Administração', 'SEMAD', 'semad@municipio.gov.br', 1),
(2, 'Secretaria Municipal de Educação', 'SEMED', 'semed@municipio.gov.br', 1),
(3, 'Secretaria Municipal de Saúde', 'SEMUS', 'semus@municipio.gov.br', 1),
(4, 'Secretaria Municipal de Obras', 'SEMOB', 'semob@municipio.gov.br', 1),
(5, 'Secretaria Municipal de Fazenda', 'SEMFAZ', 'semfaz@municipio.gov.br', 1)
ON CONFLICT (id) DO NOTHING;

-- Inserir Categorias Padrão
-- NOTA: Verifique se a tabela categories existe primeiro
INSERT INTO categories (id, name, description, color, icon, active) VALUES
(1, 'Decreto', 'Decretos municipais', '#dc2626', 'file-text', 1),
(2, 'Lei', 'Leis municipais', '#2563eb', 'scale', 1),
(3, 'Portaria', 'Portarias administrativas', '#16a34a', 'briefcase', 1),
(4, 'Edital', 'Editais de licitação e concurso', '#ea580c', 'megaphone', 1),
(5, 'Ato', 'Atos administrativos', '#9333ea', 'stamp', 1),
(6, 'Convocação', 'Convocações e chamamentos', '#0891b2', 'bell', 1),
(7, 'Extrato', 'Extratos de contratos', '#64748b', 'file-contract', 1),
(8, 'Aviso', 'Avisos diversos', '#eab308', 'info-circle', 1)
ON CONFLICT (id) DO NOTHING;

-- Inserir Usuário Administrador Padrão
-- Senha: admin123 (em produção, deve ser alterada imediatamente)
INSERT INTO users (id, name, email, password_hash, role, active) VALUES
(1, 'Administrador do Sistema', 'admin@municipio.gov.br', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin', 1)
ON CONFLICT (id) DO NOTHING;

-- Inserir Usuário SEMAD para testes
-- Senha: semad123
INSERT INTO users (id, name, email, password_hash, role, secretaria_id, active) VALUES
(2, 'Coordenador SEMAD', 'coordenador@semad.gov.br', '07a33b8e6ce426e853d20abd9625a13bb89ae67b60b85ea41acaef55d34250a7', 'semad', 1, 1)
ON CONFLICT (id) DO NOTHING;

-- Inserir Usuário Secretaria para testes
-- Senha: secretaria123
INSERT INTO users (id, name, email, password_hash, role, secretaria_id, active) VALUES
(3, 'João Silva - Secretário SEMED', 'joao.silva@semed.gov.br', 'b78847eb7959618ed22e43389ff68944a55a6a26893f9c74be4e7216bab6f4d5', 'secretaria', 2, 1)
ON CONFLICT (id) DO NOTHING;

-- Inserir Regras de Publicação Padrão (se a tabela existir)
INSERT INTO publication_rules (id, name, description, rule_type, publication_time, cutoff_time, allow_weekends, allow_holidays, require_review) VALUES
(1, 'Publicação Diária Normal', 'Publicação em dias úteis às 17h', 'schedule', '17:00:00', '15:00:00', false, false, true)
ON CONFLICT (id) DO NOTHING;

-- Inserir Configurações do Sistema
INSERT INTO system_settings (key, value, description) VALUES
('municipality_name', 'Município de Exemplo', 'Nome oficial do município'),
('municipality_state', 'EX', 'Sigla do estado'),
('municipality_logo', '/static/brasao.png', 'URL do brasão/logo do município'),
('publication_time_default', '17:00', 'Horário padrão de publicação'),
('cutoff_time_default', '15:00', 'Horário limite para envio de matérias'),
('allow_weekend_publication', 'false', 'Permitir publicações em finais de semana'),
('allow_holiday_publication', 'false', 'Permitir publicações em feriados'),
('require_semad_approval', 'true', 'Requer aprovação da SEMAD antes de publicar'),
('email_notifications_enabled', 'true', 'Habilitar notificações por e-mail'),
('signature_required', 'true', 'Exigir assinatura eletrônica nas publicações'),
('pdf_layout_default', '2', 'Layout padrão do PDF (1 ou 2 colunas)'),
('matters_per_page', '20', 'Número de matérias por página na pesquisa')
ON CONFLICT (key) DO NOTHING;

-- Inserir Feriados Nacionais de 2025 (exemplo)
INSERT INTO holidays (name, date, type, recurring, year) VALUES
('Confraternização Universal', '2025-01-01', 'nacional', true, 2025),
('Carnaval', '2025-03-04', 'nacional', false, 2025),
('Sexta-feira Santa', '2025-04-18', 'nacional', false, 2025),
('Tiradentes', '2025-04-21', 'nacional', true, 2025),
('Dia do Trabalho', '2025-05-01', 'nacional', true, 2025),
('Corpus Christi', '2025-06-19', 'nacional', false, 2025),
('Independência do Brasil', '2025-09-07', 'nacional', true, 2025),
('Nossa Senhora Aparecida', '2025-10-12', 'nacional', true, 2025),
('Finados', '2025-11-02', 'nacional', true, 2025),
('Proclamação da República', '2025-11-15', 'nacional', true, 2025),
('Dia da Consciência Negra', '2025-11-20', 'nacional', true, 2025),
('Natal', '2025-12-25', 'nacional', true, 2025)
ON CONFLICT DO NOTHING;