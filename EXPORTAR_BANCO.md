# 📊 GUIA DE EXPORTAÇÃO E BACKUP DO BANCO DE DADOS

## 🎯 OPÇÕES DE BACKUP

### Opção 1: Copiar Banco SQLite Local (Mais Simples)

O banco D1 local é armazenado em `.wrangler/state/v3/d1/`. Você pode simplesmente copiar esse diretório.

```bash
# Criar backup
tar -czf backup-banco-$(date +%Y%m%d).tar.gz .wrangler/state/v3/d1/

# Restaurar backup
tar -xzf backup-banco-20251018.tar.gz
```

---

### Opção 2: Export SQL Completo

```bash
# Exportar todas as tabelas para SQL
npx wrangler d1 export dom-production --local --output=backup.sql

# Ou exportar tabela específica
npx wrangler d1 execute dom-production --local \
  --command=".dump users" > users_backup.sql
```

---

### Opção 3: Export JSON (Dados)

Criar script de export para JSON:

```bash
# export-data.sh
#!/bin/bash

echo "Exportando dados para JSON..."

# Usuários
npx wrangler d1 execute dom-production --local \
  --command="SELECT * FROM users" \
  --json > users.json

# Secretarias
npx wrangler d1 execute dom-production --local \
  --command="SELECT * FROM secretarias" \
  --json > secretarias.json

# Matérias
npx wrangler d1 execute dom-production --local \
  --command="SELECT * FROM matters" \
  --json > matters.json

# Edições
npx wrangler d1 execute dom-production --local \
  --command="SELECT * FROM editions" \
  --json > editions.json

echo "Export concluído!"
```

---

## 📤 EXPORTAR BANCO COMPLETO (COM DADOS)

### Script Completo de Export:

```bash
#!/bin/bash
# export-full-database.sh

BACKUP_DIR="database-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo "🗄️  Exportando banco de dados completo..."

# 1. Copiar arquivo SQLite
echo "📁 Copiando arquivo SQLite..."
cp -r .wrangler/state/v3/d1/* "$BACKUP_DIR/"

# 2. Export SQL
echo "📄 Gerando dump SQL..."
npx wrangler d1 execute dom-production --local \
  --command=".schema" > "$BACKUP_DIR/schema.sql"

# 3. Export de cada tabela
TABLES=("users" "secretarias" "matter_types" "matters" "editions" 
        "edition_matters" "system_settings" "holidays" "audit_logs")

for table in "${TABLES[@]}"; do
    echo "📊 Exportando tabela: $table"
    npx wrangler d1 execute dom-production --local \
      --command="SELECT * FROM $table" \
      --json > "$BACKUP_DIR/${table}.json"
done

# 4. Criar arquivo de informações
cat > "$BACKUP_DIR/INFO.txt" << EOF
Backup do Banco de Dados - DOM
Data: $(date)
Versão: 1.0.0

Arquivos incluídos:
- schema.sql: Estrutura das tabelas
- *.json: Dados de cada tabela
- Diretório SQLite completo

Para restaurar:
1. Copie os arquivos SQLite de volta para .wrangler/state/v3/d1/
2. Ou reaplique as migrações e importe os dados JSON
EOF

# 5. Comprimir tudo
echo "🗜️  Comprimindo backup..."
tar -czf "${BACKUP_DIR}.tar.gz" "$BACKUP_DIR"
rm -rf "$BACKUP_DIR"

echo "✅ Backup concluído: ${BACKUP_DIR}.tar.gz"
```

Tornar executável e usar:

```bash
chmod +x export-full-database.sh
./export-full-database.sh
```

---

## 📥 IMPORTAR/RESTAURAR BANCO

### Opção 1: Restaurar SQLite Direto

```bash
# Extrair backup
tar -xzf database-backup-20251018.tar.gz

# Copiar para local correto
rm -rf .wrangler/state/v3/d1/*
cp -r database-backup-20251018/* .wrangler/state/v3/d1/
```

---

### Opção 2: Recriar com Migrações + Import JSON

```bash
# 1. Limpar banco atual
rm -rf .wrangler/state/v3/d1

# 2. Aplicar migrações (cria estrutura)
npm run db:migrate:local

# 3. Importar dados (precisa criar script)
# import-data.js
```

Criar `import-data.js`:

```javascript
// import-data.js
import fs from 'fs';
import { execSync } from 'child_process';

const tables = [
  'users', 'secretarias', 'matter_types', 
  'matters', 'editions', 'edition_matters',
  'system_settings', 'holidays', 'audit_logs'
];

for (const table of tables) {
  const data = JSON.parse(fs.readFileSync(`${table}.json`, 'utf8'));
  
  // Gerar INSERT statements
  for (const row of data) {
    const columns = Object.keys(row).join(', ');
    const values = Object.values(row)
      .map(v => typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v)
      .join(', ');
    
    const sql = `INSERT INTO ${table} (${columns}) VALUES (${values})`;
    
    execSync(`npx wrangler d1 execute dom-production --local --command="${sql}"`);
  }
  
  console.log(`✅ Importado: ${table}`);
}
```

Executar:

```bash
node import-data.js
```

---

## 🔄 SINCRONIZAR COM PRODUÇÃO

### Export de Produção:

```bash
# 1. Export de produção
npx wrangler d1 backup create dom-production

# 2. Download do backup
npx wrangler d1 backup download dom-production --output=prod-backup.sql

# 3. Aplicar no local
npx wrangler d1 execute dom-production --local --file=prod-backup.sql
```

### Upload para Produção:

```bash
# 1. Export local
./export-full-database.sh

# 2. Aplicar em produção
npx wrangler d1 migrations apply dom-production

# 3. Popular dados (cuidado - não sobrescreva dados!)
# Use SQL INSERT cuidadosamente
```

---

## 🚨 IMPORTANTE: ANTES DE EXPORTAR

### 1. Verificar Dados:

```bash
# Contar registros
npx wrangler d1 execute dom-production --local \
  --command="
    SELECT 'users' as table, COUNT(*) as count FROM users
    UNION ALL
    SELECT 'matters', COUNT(*) FROM matters
    UNION ALL
    SELECT 'editions', COUNT(*) FROM editions
  "
```

### 2. Testar Backup:

```bash
# Fazer backup
./export-full-database.sh

# Criar diretório de teste
mkdir test-restore
cd test-restore

# Extrair
tar -xzf ../database-backup-*.tar.gz

# Verificar conteúdo
ls -lah
```

---

## 📋 CHECKLIST DE BACKUP

Antes de mover para VM:

- [ ] Backup do SQLite (`.wrangler/state/v3/d1/`)
- [ ] Export SQL schema (`schema.sql`)
- [ ] Export JSON de cada tabela
- [ ] Arquivo INFO.txt com instruções
- [ ] Comprimir tudo em `.tar.gz`
- [ ] Testar extração e restauração
- [ ] Verificar integridade dos dados

---

## 🎁 PACOTE COMPLETO PARA VM

Ao transferir para sua VM, leve:

1. ✅ **Código do projeto** (tar.gz do projeto completo)
2. ✅ **Backup do banco** (database-backup-*.tar.gz)
3. ✅ **Documentação** (README.md, INSTALACAO_VM.md)
4. ✅ **Scripts** (install.sh, export-full-database.sh)

---

## 📦 COMANDO ÚNICO (EXPORT TUDO)

```bash
# Criar backup completo do projeto + banco
tar -czf dom-completo-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  .

# Isso inclui:
# - Código fonte (src/, public/)
# - Banco de dados (.wrangler/)
# - Migrações (migrations/)
# - Configurações (wrangler.jsonc, package.json)
# - Scripts (install.sh)
# - Documentação (*.md)
```

**Este arquivo tem tudo que você precisa para rodar em outra máquina!**

---

## ✅ RESUMO RÁPIDO

**Para exportar tudo:**

```bash
cd /home/user/dom

# Backup completo (código + banco)
tar -czf dom-export-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=dist \
  .
```

**Para importar na VM:**

```bash
# 1. Extrair
tar -xzf dom-export-20251018.tar.gz

# 2. Instalar
./install.sh

# 3. Pronto! O banco já vem junto.
```

**Simples assim!** 🎉
