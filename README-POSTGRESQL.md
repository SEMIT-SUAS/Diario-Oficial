# 🐘 DOM - Sistema com PostgreSQL

Sistema DOM configurado para usar **PostgreSQL** como banco de dados.

---

## 🚀 **INSTALAÇÃO RÁPIDA**

### 1. **Pré-requisitos**
```bash
# PostgreSQL instalado e rodando
# Verifique com:
psql --version

# Se não tiver instalado:
# Ubuntu/Debian:
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS:
brew install postgresql
brew services start postgresql

# Verificar se está rodando:
sudo systemctl status postgresql  # Linux
brew services list                 # macOS
```

### 2. **Clonar e Instalar**
```bash
# Entrar no diretório
cd /home/user/dom

# Instalar dependências
npm install

# Configurar variáveis de ambiente (já configurado)
# Edite .env se necessário
```

### 3. **Inicializar Banco de Dados** (AUTOMÁTICO)
```bash
# Este comando cria o banco, aplica schema e insere dados
npm run db:init
```

**O script faz automaticamente:**
- ✅ Cria o banco `dom_database`
- ✅ Cria todas as 10 tabelas
- ✅ Cria todos os índices e foreign keys
- ✅ Insere dados iniciais (usuários, secretarias, tipos, etc)

### 4. **Iniciar o Sistema**
```bash
# Modo desenvolvimento (inicializa DB + inicia servidor)
npm run dev

# Ou apenas iniciar servidor (se DB já foi criado)
npm run dev:pg
```

### 5. **Acessar**
- **URL:** http://localhost:3000
- **Login:** admin@municipio.gov.br
- **Senha:** admin123

---

## 📊 **Estrutura do Banco de Dados**

### Tabelas Criadas:
1. ✅ **users** - Usuários do sistema
2. ✅ **secretarias** - Secretarias municipais
3. ✅ **matter_types** - Tipos de matéria (Decreto, Portaria, etc)
4. ✅ **matters** - Matérias para publicação
5. ✅ **editions** - Edições do diário oficial
6. ✅ **edition_matters** - Relação N:N (edições ↔ matérias)
7. ✅ **attachments** - Anexos de matérias
8. ✅ **audit_logs** - Logs de auditoria
9. ✅ **system_settings** - Configurações do sistema
10. ✅ **calendar_config** - Configuração de calendário

---

## ⚙️ **Configuração**

### Arquivo `.env`
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=dom_database

# Pool de Conexões
DB_POOL_MIN=2
DB_POOL_MAX=10

# Application
NODE_ENV=development
PORT=3000
JWT_SECRET=seu-secret-aqui
```

### Alterar Credenciais do PostgreSQL
Se seu PostgreSQL usa credenciais diferentes, edite o arquivo `.env`:
```bash
nano .env

# Altere:
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
```

---

## 🛠️ **Scripts Disponíveis**

### Banco de Dados
```bash
# Inicializar banco (cria banco + schema + dados)
npm run db:init

# Conectar ao PostgreSQL diretamente
psql -U postgres -d dom_database

# Verificar tabelas
psql -U postgres -d dom_database -c "\dt"

# Ver dados de uma tabela
psql -U postgres -d dom_database -c "SELECT * FROM users;"
```

### Desenvolvimento
```bash
# Desenvolvimento (init DB + servidor)
npm run dev

# Apenas servidor PostgreSQL
npm run dev:pg

# Build para produção
npm run build

# Limpar porta 3000
npm run clean-port
```

---

## 📝 **Comandos PostgreSQL Úteis**

### Conectar ao Banco
```bash
psql -U postgres -d dom_database
```

### Dentro do psql:
```sql
-- Listar tabelas
\dt

-- Descrever uma tabela
\d users

-- Ver todos os usuários
SELECT id, email, name, role FROM users;

-- Ver todas as secretarias
SELECT * FROM secretarias;

-- Ver matérias aprovadas
SELECT title, status FROM matters WHERE status = 'approved';

-- Sair
\q
```

### Recriar Banco (se necessário)
```bash
# Deletar banco existente
psql -U postgres -c "DROP DATABASE IF EXISTS dom_database;"

# Recriar
npm run db:init
```

---

## 🔧 **Troubleshooting**

### Erro: "connection refused"
```bash
# Verificar se PostgreSQL está rodando
sudo systemctl status postgresql  # Linux
brew services list                 # macOS

# Iniciar PostgreSQL
sudo systemctl start postgresql   # Linux
brew services start postgresql    # macOS
```

### Erro: "role 'postgres' does not exist"
```bash
# Criar role postgres
sudo -u postgres createuser --superuser $USER

# Ou alterar .env para usar seu usuário
```

### Erro: "database already exists"
**Normal!** O script detecta e não tenta recriar.

### Erro: "password authentication failed"
```bash
# Verifique as credenciais no .env
# Ou configure PostgreSQL para confiar localmente:
sudo nano /etc/postgresql/XX/main/pg_hba.conf

# Altere para:
local   all   postgres   trust

# Reinicie:
sudo systemctl restart postgresql
```

---

## 📦 **Estrutura de Arquivos**

```
dom/
├── database/
│   ├── schema.sql          # Schema completo (10 tabelas)
│   └── seed.sql            # Dados iniciais
├── scripts/
│   └── init-db.js          # Script de inicialização automática
├── src/
│   ├── config/
│   │   └── database.ts     # Configuração do pool PostgreSQL
│   ├── routes/             # Rotas da API
│   └── index.tsx           # App principal
├── .env                     # Configurações (PostgreSQL)
├── .env.example             # Exemplo de configurações
├── package.json             # Dependências
└── README-POSTGRESQL.md     # Este arquivo
```

---

## 🎯 **Diferenças vs CloudFlare D1**

| Aspecto | CloudFlare D1 (SQLite) | PostgreSQL |
|---------|------------------------|------------|
| **Tipo** | SQLite distribuído | PostgreSQL tradicional |
| **Hospedagem** | CloudFlare Edge | Servidor próprio |
| **Inicialização** | wrangler migrations | npm run db:init |
| **Conexão** | Workers binding | Pool de conexões |
| **Desenvolvimento** | --local flag | localhost:5432 |
| **Produção** | CloudFlare global | VPS/Cloud |

---

## ✅ **Checklist de Verificação**

Após instalação, verifique:

- [ ] PostgreSQL está rodando
- [ ] Banco `dom_database` foi criado
- [ ] 10 tabelas foram criadas
- [ ] Dados iniciais foram inseridos
- [ ] Servidor iniciou em http://localhost:3000
- [ ] Login funciona com admin@municipio.gov.br

---

## 🚀 **Deploy em Produção**

### Opções de Hospedagem PostgreSQL:

1. **VPS (Digital Ocean, Linode, etc)**
   - Instalar PostgreSQL
   - Configurar firewall
   - Usar .env de produção

2. **Serviços Gerenciados**
   - **Supabase** (PostgreSQL + Auth + Storage)
   - **Neon** (PostgreSQL serverless)
   - **Railway** (Deploy fácil)
   - **Render** (PostgreSQL managed)
   - **AWS RDS**
   - **Google Cloud SQL**

3. **Configurar para Produção**
```env
# .env (produção)
DB_HOST=seu-servidor-producao.com
DB_PORT=5432
DB_USER=dom_user
DB_PASSWORD=senha-forte-aqui
DB_NAME=dom_database
NODE_ENV=production
JWT_SECRET=secret-super-seguro-producao
```

---

## 📚 **Documentação Adicional**

- **PostgreSQL Docs:** https://www.postgresql.org/docs/
- **node-postgres (pg):** https://node-postgres.com/
- **Hono Framework:** https://hono.dev/

---

## 🆘 **Suporte**

**Problemas comuns:**
1. PostgreSQL não instalado → Instalar conforme OS
2. Credenciais incorretas → Verificar .env
3. Porta 5432 ocupada → Verificar outros processos
4. Permissões → Usar sudo/admin

---

**🎉 Sistema pronto para usar com PostgreSQL!**

**Desenvolvido com ❤️ para o Município**
