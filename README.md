# 📰 DOM - Diário Oficial Municipal

Sistema completo de gestão e publicação do Diário Oficial Municipal de São Luís/MA.

## 🚀 INSTALAÇÃO RÁPIDA

### Opção 1: Script Automatizado (Recomendado)

```bash
# 1. Baixar projeto
wget https://page.gensparksite.com/project_backups/dom-diario-oficial-completo.tar.gz

# 2. Extrair
tar -xzf dom-diario-oficial-completo.tar.gz
cd home/user/dom

# 3. Executar instalador
./install.sh
```

### Opção 2: Manual

```bash
# 1. Instalar dependências
npm install

# 2. Configurar banco de dados
npm run db:migrate:local

# 3. Build
npm run build

# 4. Iniciar servidor
npx wrangler pages dev dist --d1=dom-production --local --port 3000
```

## 🌐 ACESSO

Após iniciar o servidor:

- **Login:** http://localhost:3000
- **Portal Público:** http://localhost:3000/portal
- **Verificação:** http://localhost:3000/verificar

## 🔑 CREDENCIAIS PADRÃO

| Email | Senha | Perfil |
|-------|-------|--------|
| admin@municipio.gov.br | admin123 | Administrador |
| coordenador@semad.gov.br | semad123 | SEMAD (Coordenador) |
| joao.silva@semed.gov.br | secretaria123 | Secretaria |

## ✨ FUNCIONALIDADES

### Área Restrita (Com Login)

- ✅ **Dashboard** com estatísticas em tempo real
- ✅ **Gestão de Matérias** (criar, editar, aprovar, rejeitar)
- ✅ **Edições do Diário** (montar, publicar, download PDF/HTML)
- ✅ **Portal Público** com WebGL, gráficos Chart.js, word cloud
- ✅ **Verificação de Autenticidade** (hash validation)
- ✅ **Gerenciamento** (usuários, secretarias, feriados)
- ✅ **Configurações** (EXPEDIENTE, parâmetros do sistema)
- ✅ **Auditoria** completa de todas as ações

### Portal Público (Sem Login)

- ✅ **Dashboard Interativo** com estatísticas
- ✅ **Gráficos Chart.js** (publicações por secretaria, tipos)
- ✅ **Word Cloud** de termos mais pesquisados
- ✅ **WebGL Background** animado (Three.js)
- ✅ **Download de Edições** publicadas
- ✅ **Verificação de Hash** para autenticidade

### Características Técnicas

- ✅ **Paginação** (20 itens por página)
- ✅ **Filtros Avançados** (status, data, tipo, secretaria)
- ✅ **Export** (CSV, XLS)
- ✅ **Numeração Automática** de edições (normal e suplementar)
- ✅ **Layout do PDF** conforme modelo oficial
- ✅ **Índice Organizado** por secretaria e tipo
- ✅ **QR Code** no rodapé
- ✅ **Responsive Design** (mobile-friendly)

## 📚 DOCUMENTAÇÃO

- **[INSTALACAO_VM.md](INSTALACAO_VM.md)** - Guia completo de instalação
- **[install.sh](install.sh)** - Script de instalação automatizada

## 🗄️ BANCO DE DADOS

### Estrutura:

```
users           → Usuários do sistema
secretarias     → Secretarias municipais  
matter_types    → Tipos de matéria (Decreto, Portaria, etc)
matters         → Matérias/documentos
editions        → Edições do diário
edition_matters → Relacionamento edições-matérias
system_settings → Configurações do sistema
holidays        → Feriados municipais
audit_logs      → Logs de auditoria
```

### Comandos úteis:

```bash
# Aplicar migrações (local)
npm run db:migrate:local

# Aplicar migrações (produção)
npm run db:migrate:prod

# Console do banco (local)
npm run db:console:local

# Resetar banco local
npm run db:reset
```

## 🔧 SCRIPTS DISPONÍVEIS

```bash
npm run dev          # Vite dev server
npm run build        # Build para produção
npm run deploy       # Deploy no Cloudflare Pages

# Banco de dados
npm run db:migrate:local     # Aplicar migrações (local)
npm run db:migrate:prod      # Aplicar migrações (produção)
npm run db:console:local     # Console SQL (local)
npm run db:reset             # Resetar banco local

# Utilitários
npm run clean-port   # Limpar porta 3000
npm run test         # Testar servidor
```

## 🏗️ STACK TECNOLÓGICA

### Backend:
- **Hono** - Framework web TypeScript
- **Cloudflare Workers** - Runtime edge
- **Cloudflare D1** - Database SQLite distribuído
- **Wrangler** - CLI Cloudflare

### Frontend:
- **Vanilla JavaScript** - SPA sem framework
- **Tailwind CSS** - Styling
- **Chart.js 4.4** - Gráficos interativos
- **Three.js** - WebGL background
- **Font Awesome** - Ícones

## 📦 ESTRUTURA DO PROJETO

```
dom/
├── src/
│   ├── index.tsx           # Entry point
│   ├── routes/             # API routes
│   │   ├── auth.ts
│   │   ├── matters.ts
│   │   ├── editions.ts
│   │   ├── portal.ts
│   │   └── ...
│   ├── middleware/         # Auth, CORS, etc
│   ├── utils/              # Helpers
│   └── types/              # TypeScript types
│
├── public/static/
│   ├── app.js             # Frontend JavaScript
│   ├── webgl-init.js      # WebGL background
│   └── styles.css
│
├── migrations/            # 8 SQL migrations
│
├── wrangler.jsonc        # Cloudflare config
├── package.json
├── install.sh            # Instalador automático
└── INSTALACAO_VM.md      # Guia completo
```

## 🚀 DEPLOY PARA PRODUÇÃO

### Cloudflare Pages:

```bash
# 1. Login
wrangler login

# 2. Criar banco D1
wrangler d1 create dom-production

# 3. Atualizar wrangler.jsonc com database_id

# 4. Aplicar migrações
wrangler d1 migrations apply dom-production

# 5. Deploy
npm run deploy
```

**URL:** https://dom.pages.dev (ou domínio customizado)

## 🐛 TROUBLESHOOTING

### Porta 3000 ocupada:
```bash
fuser -k 3000/tcp
```

### Banco vazio:
```bash
npm run db:reset
```

### Dependências:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📊 STATUS DO PROJETO

- ✅ Backend API completo
- ✅ Frontend SPA funcional
- ✅ Banco de dados com 8 migrações
- ✅ Portal público com gráficos
- ✅ Sistema de autenticação
- ✅ Geração de PDF/HTML
- ✅ Verificação de autenticidade
- ✅ Paginação e filtros
- ✅ Export CSV/XLS
- ✅ Responsive design
- ✅ Documentação completa

## 📄 LICENÇA

Sistema desenvolvido para a Prefeitura Municipal de São Luís - MA.

## 🤝 SUPORTE

Para dúvidas ou problemas:

1. Consulte [INSTALACAO_VM.md](INSTALACAO_VM.md)
2. Verifique logs do servidor
3. Inspecione console do navegador (F12)
4. Consulte banco: `npm run db:console:local`

---

**Versão:** 1.0.0  
**Última atualização:** Outubro 2025  
**Desenvolvido com:** ❤️ + ☕ + 💻
