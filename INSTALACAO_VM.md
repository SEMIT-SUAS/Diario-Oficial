# 📦 GUIA DE INSTALAÇÃO NA VM - DOM (Diário Oficial Municipal)

## 📥 DOWNLOAD DO PROJETO

**URL do Backup:** https://page.gensparksite.com/project_backups/dom-diario-oficial-completo.tar.gz

```bash
# Baixar o arquivo
wget https://page.gensparksite.com/project_backups/dom-diario-oficial-completo.tar.gz

# Ou usar curl
curl -O https://page.gensparksite.com/project_backups/dom-diario-oficial-completo.tar.gz
```

---

## 🔧 PRÉ-REQUISITOS

Sua VM precisa ter instalado:

### 1. **Node.js 18+**
```bash
# Verificar versão
node --version
npm --version

# Se não tiver, instalar:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 2. **Wrangler CLI (Cloudflare)**
```bash
npm install -g wrangler

# Verificar instalação
wrangler --version
```

### 3. **Git (opcional, mas recomendado)**
```bash
sudo apt-get install git
```

---

## 📂 INSTALAÇÃO DO PROJETO

### Passo 1: Extrair o Projeto

```bash
# Criar diretório de trabalho
mkdir -p ~/projetos
cd ~/projetos

# Extrair o arquivo
tar -xzf dom-diario-oficial-completo.tar.gz

# Entrar no diretório
cd home/user/dom
```

### Passo 2: Instalar Dependências

```bash
# Instalar todas as dependências do Node.js
npm install

# Isso irá instalar:
# - hono (framework backend)
# - wrangler (CLI Cloudflare)
# - vite (build tool)
# - typescript
# - @cloudflare/workers-types
```

---

## 🗄️ CONFIGURAÇÃO DO BANCO DE DADOS

### Opção 1: Usar D1 Local (Desenvolvimento)

O Cloudflare D1 funciona automaticamente em modo local:

```bash
# Aplicar migrações
npm run db:migrate:local

# Isso criará o banco SQLite em:
# .wrangler/state/v3/d1/miniflare-D1DatabaseObject/

# Verificar banco criado
ls -la .wrangler/state/v3/d1/
```

### Opção 2: Criar Banco D1 na Cloudflare (Produção)

```bash
# 1. Fazer login no Cloudflare
wrangler login

# 2. Criar banco D1
wrangler d1 create dom-production

# 3. Copiar o database_id que aparecerá
# Exemplo de output:
# [[d1_databases]]
# binding = "DB"
# database_name = "dom-production"
# database_id = "xxxxx-xxxx-xxxx-xxxx-xxxxxxxx"

# 4. Editar wrangler.jsonc e adicionar o database_id:
nano wrangler.jsonc

# Adicionar:
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "dom-production",
      "database_id": "COLE_O_ID_AQUI"
    }
  ]
}

# 5. Aplicar migrações no banco remoto
npm run db:migrate:prod
```

---

## 🎨 ESTRUTURA DO BANCO DE DADOS

O sistema possui 8 migrações que criam:

### Tabelas Principais:
```sql
✅ users                -- Usuários do sistema
✅ secretarias          -- Secretarias municipais
✅ matter_types         -- Tipos de matéria (Decreto, Portaria, etc)
✅ matters              -- Matérias/documentos
✅ editions             -- Edições do diário
✅ edition_matters      -- Relacionamento edições-matérias
✅ system_settings      -- Configurações do sistema
✅ holidays             -- Feriados municipais
✅ audit_logs           -- Logs de auditoria
```

### Dados Iniciais (Seed):

O sistema já vem com dados de exemplo criados nas migrações:

**Usuários padrão:**
- Admin: `admin@municipio.gov.br` / senha: `admin123`
- SEMAD: `coordenador@semad.gov.br` / senha: `semad123`
- Secretaria: `joao.silva@semed.gov.br` / senha: `secretaria123`

**Secretarias:**
- SEMAD, SEMED, SEMUS, SEMFAZ, SEMOB (5 secretarias)

**Tipos de Matéria:**
- Decreto, Portaria, Edital, Resolução, Lei, Ato, etc (10 tipos)

---

## 🚀 EXECUTAR O PROJETO

### Modo Desenvolvimento (Local)

```bash
# Opção 1: Build + Wrangler Pages Dev (RECOMENDADO)
npm run build
npx wrangler pages dev dist --d1=dom-production --local --ip 0.0.0.0 --port 3000

# Opção 2: Usar o script dev (mais rápido)
npm run dev

# Opção 3: Vite dev server (apenas frontend)
npm run dev:local
```

**Acessar:** http://localhost:3000

---

## 🌐 DEPLOY PARA PRODUÇÃO (CLOUDFLARE PAGES)

### Passo 1: Configurar API Key

```bash
# 1. Obter API key da Cloudflare:
# - Acesse: https://dash.cloudflare.com/profile/api-tokens
# - Criar token com permissões: Cloudflare Pages (Edit)

# 2. Configurar localmente
export CLOUDFLARE_API_TOKEN="seu-token-aqui"
```

### Passo 2: Criar Projeto no Cloudflare Pages

```bash
# 1. Fazer build
npm run build

# 2. Criar projeto (primeira vez)
wrangler pages project create dom --production-branch main

# 3. Deploy
npm run deploy

# Ou diretamente:
wrangler pages deploy dist --project-name dom
```

### Passo 3: Configurar Banco D1 (Produção)

```bash
# 1. Já criamos o banco antes
# Agora aplicar migrações:
wrangler d1 migrations apply dom-production

# 2. Vincular banco ao projeto Pages
# (Cloudflare faz automaticamente via wrangler.jsonc)
```

**URL de produção:** `https://dom.pages.dev`

---

## 📋 SCRIPTS DISPONÍVEIS

```json
{
  "dev": "vite",                                    // Dev server Vite
  "dev:sandbox": "wrangler pages dev dist ...",     // Dev com Wrangler
  "build": "vite build",                            // Build para produção
  "deploy": "npm run build && wrangler pages deploy dist",
  
  "db:migrate:local": "wrangler d1 migrations apply dom-production --local",
  "db:migrate:prod": "wrangler d1 migrations apply dom-production",
  "db:console:local": "wrangler d1 execute dom-production --local",
  "db:console:prod": "wrangler d1 execute dom-production"
}
```

---

## 🔍 VERIFICAÇÃO DA INSTALAÇÃO

### 1. Testar Backend

```bash
# Servidor deve estar rodando
curl http://localhost:3000/api/health

# Resposta esperada:
# {"status":"ok","timestamp":"...","service":"DOM - Diário Oficial Municipal"}
```

### 2. Testar Banco de Dados

```bash
# Consultar usuários
npm run db:console:local -- --command="SELECT * FROM users"

# Consultar secretarias
npm run db:console:local -- --command="SELECT * FROM secretarias"
```

### 3. Testar Login

Acesse: http://localhost:3000

**Credenciais:**
- Email: `admin@municipio.gov.br`
- Senha: `admin123`

---

## 🐛 RESOLUÇÃO DE PROBLEMAS

### Erro: "Command not found: wrangler"

```bash
# Instalar globalmente
npm install -g wrangler

# Ou usar npx
npx wrangler --version
```

### Erro: "Database not found"

```bash
# Aplicar migrações
npm run db:migrate:local

# Se persistir, deletar e recriar:
rm -rf .wrangler/state/v3/d1
npm run db:migrate:local
```

### Erro: "Port 3000 already in use"

```bash
# Matar processo na porta 3000
fuser -k 3000/tcp

# Ou usar outra porta
npx wrangler pages dev dist --port 3001
```

### Banco vazio / Sem dados

```bash
# As migrações já incluem dados iniciais
# Mas se precisar popular novamente:

# 1. Resetar banco
rm -rf .wrangler/state/v3/d1

# 2. Aplicar migrações (cria tudo + dados)
npm run db:migrate:local
```

---

## 📁 ESTRUTURA DO PROJETO

```
dom/
├── src/
│   ├── index.tsx              # Entry point (Hono app)
│   ├── routes/                # API routes
│   │   ├── auth.ts           # Autenticação
│   │   ├── matters.ts        # Matérias
│   │   ├── editions.ts       # Edições
│   │   ├── portal.ts         # Portal público
│   │   └── ...
│   ├── middleware/            # Middlewares
│   ├── utils/                 # Utilitários
│   │   ├── pdf-generator.ts  # Gerador de PDF/HTML
│   │   └── ...
│   └── types/                 # TypeScript types
│
├── public/
│   └── static/
│       ├── app.js            # Frontend JavaScript
│       ├── webgl-init.js     # WebGL background
│       └── styles.css        # CSS customizado
│
├── migrations/               # Migrações SQL (8 arquivos)
│   ├── 0001_initial_schema.sql
│   ├── 0002_matter_types.sql
│   ├── ...
│   └── 0008_fix_users.sql
│
├── wrangler.jsonc           # Config Cloudflare
├── package.json             # Dependências
├── vite.config.ts          # Config Vite
└── tsconfig.json           # Config TypeScript
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

### Desenvolvimento (.dev.vars)

Crie um arquivo `.dev.vars` na raiz:

```bash
# .dev.vars
JWT_SECRET=seu-secret-super-seguro-aqui-min-32-chars
CLOUDFLARE_API_TOKEN=seu-token-cloudflare
```

### Produção (Cloudflare Secrets)

```bash
# Adicionar secrets no Cloudflare
wrangler pages secret put JWT_SECRET --project-name dom
# Digite o valor quando solicitado
```

---

## 📊 DADOS INICIAIS DO SISTEMA

### Usuários:

| Email | Senha | Role | Secretaria |
|-------|-------|------|------------|
| admin@municipio.gov.br | admin123 | admin | - |
| coordenador@semad.gov.br | semad123 | semad | SEMAD |
| joao.silva@semed.gov.br | secretaria123 | secretaria | SEMED |

### Secretarias:

1. SEMAD - Secretaria Municipal de Administração
2. SEMED - Secretaria Municipal de Educação
3. SEMUS - Secretaria Municipal de Saúde
4. SEMFAZ - Secretaria Municipal de Fazenda
5. SEMOB - Secretaria Municipal de Obras

### Tipos de Matéria:

Decreto, Portaria, Edital, Resolução, Lei, Ato, Extrato, Convocação, Aviso, Comunicado

---

## 🎯 FUNCIONALIDADES PRINCIPAIS

### ✅ Área Restrita (Com Login)

- **Dashboard** com estatísticas
- **Minhas Matérias** (criar, editar, enviar)
- **Aprovação SEMAD** (revisar, aprovar/rejeitar)
- **Edições do Diário** (criar, publicar, download)
- **Gerenciamento** (usuários, secretarias, feriados)
- **Configurações** (EXPEDIENTE, sistema)

### ✅ Portal Público (Sem Login)

- `/portal` - Dashboard com gráficos Chart.js
- `/verificar` - Verificação de autenticidade
- Listagem de edições publicadas
- Download de PDFs/HTML
- Word cloud de termos mais buscados

---

## 🔄 ATUALIZAÇÃO DO SISTEMA

### Aplicar novas migrações:

```bash
# Local
npm run db:migrate:local

# Produção
npm run db:migrate:prod
```

### Deploy de nova versão:

```bash
# 1. Build
npm run build

# 2. Deploy
npm run deploy
```

---

## 📞 SUPORTE

**Problemas comuns já documentados acima.**

Se tiver dúvidas específicas, verifique:
1. Logs do servidor: `wrangler pages dev` mostra logs em tempo real
2. Console do navegador (F12) para erros de frontend
3. Banco de dados: `npm run db:console:local`

---

## 🎉 PRONTO!

Seu sistema DOM (Diário Oficial Municipal) está instalado e funcionando!

**URLs principais:**
- Login: http://localhost:3000
- Portal: http://localhost:3000/portal
- Verificar: http://localhost:3000/verificar
- API Health: http://localhost:3000/api/health

**Próximos passos:**
1. Personalizar logo da prefeitura (configurações)
2. Ajustar dados do EXPEDIENTE
3. Criar usuários reais
4. Publicar primeira edição oficial!
