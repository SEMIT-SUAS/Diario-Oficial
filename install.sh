#!/bin/bash

# ==================================================================
# SCRIPT DE INSTALAÇÃO AUTOMÁTICA - DOM (Diário Oficial Municipal)
# ==================================================================

set -e  # Parar em caso de erro

echo "======================================"
echo "🚀 INSTALANDO DOM - DIÁRIO OFICIAL"
echo "======================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Função para imprimir com cor
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# ==================================================================
# 1. VERIFICAR PRÉ-REQUISITOS
# ==================================================================

print_info "Verificando pré-requisitos..."

# Verificar Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js encontrado: $NODE_VERSION"
else
    print_error "Node.js não encontrado!"
    print_info "Instale com: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    exit 1
fi

# Verificar npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_success "npm encontrado: $NPM_VERSION"
else
    print_error "npm não encontrado!"
    exit 1
fi

echo ""

# ==================================================================
# 2. INSTALAR DEPENDÊNCIAS
# ==================================================================

print_info "Instalando dependências do projeto..."

if [ -f "package.json" ]; then
    npm install
    print_success "Dependências instaladas!"
else
    print_error "package.json não encontrado!"
    exit 1
fi

echo ""

# ==================================================================
# 3. INSTALAR WRANGLER (se não estiver instalado)
# ==================================================================

print_info "Verificando Wrangler CLI..."

if command -v wrangler &> /dev/null; then
    WRANGLER_VERSION=$(wrangler --version)
    print_success "Wrangler encontrado: $WRANGLER_VERSION"
else
    print_warning "Wrangler não encontrado. Instalando globalmente..."
    npm install -g wrangler
    print_success "Wrangler instalado!"
fi

echo ""

# ==================================================================
# 4. CONFIGURAR BANCO DE DADOS LOCAL
# ==================================================================

print_info "Configurando banco de dados local..."

# Criar diretório do banco se não existir
mkdir -p .wrangler/state/v3/d1

# Aplicar migrações
print_info "Aplicando migrações..."
npm run db:migrate:local

print_success "Banco de dados configurado!"

echo ""

# ==================================================================
# 5. VERIFICAR BANCO DE DADOS
# ==================================================================

print_info "Verificando banco de dados..."

# Contar usuários
USER_COUNT=$(npx wrangler d1 execute dom-production --local --command="SELECT COUNT(*) as count FROM users" 2>/dev/null | grep -oP '\d+' | head -1 || echo "0")

if [ "$USER_COUNT" -gt 0 ]; then
    print_success "Banco de dados OK! $USER_COUNT usuários encontrados."
else
    print_warning "Banco pode estar vazio. Verifique as migrações."
fi

echo ""

# ==================================================================
# 6. BUILD DO PROJETO
# ==================================================================

print_info "Fazendo build do projeto..."

npm run build

print_success "Build concluído!"

echo ""

# ==================================================================
# 7. CRIAR ARQUIVO .dev.vars (se não existir)
# ==================================================================

if [ ! -f ".dev.vars" ]; then
    print_info "Criando arquivo .dev.vars..."
    
    cat > .dev.vars << EOF
# Variáveis de ambiente para desenvolvimento local
JWT_SECRET=$(openssl rand -hex 32)
CLOUDFLARE_API_TOKEN=
EOF
    
    print_success "Arquivo .dev.vars criado!"
    print_warning "Configure CLOUDFLARE_API_TOKEN em .dev.vars para deploy"
else
    print_info ".dev.vars já existe. Mantendo configuração atual."
fi

echo ""

# ==================================================================
# 8. INSTRUÇÕES FINAIS
# ==================================================================

echo "======================================"
echo "✅ INSTALAÇÃO CONCLUÍDA!"
echo "======================================"
echo ""
echo "📋 CREDENCIAIS PADRÃO:"
echo "   Admin: admin@municipio.gov.br / admin123"
echo "   SEMAD: coordenador@semad.gov.br / semad123"
echo "   Secretaria: joao.silva@semed.gov.br / secretaria123"
echo ""
echo "🚀 PARA INICIAR O SERVIDOR:"
echo "   npm run build"
echo "   npx wrangler pages dev dist --d1=dom-production --local --ip 0.0.0.0 --port 3000"
echo ""
echo "🌐 ACESSE:"
echo "   http://localhost:3000 - Login"
echo "   http://localhost:3000/portal - Portal Público"
echo "   http://localhost:3000/verificar - Verificação"
echo ""
echo "📚 DOCUMENTAÇÃO COMPLETA: INSTALACAO_VM.md"
echo ""

# Perguntar se deseja iniciar o servidor
read -p "Deseja iniciar o servidor agora? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    print_info "Iniciando servidor..."
    echo ""
    npx wrangler pages dev dist --d1=dom-production --local --ip 0.0.0.0 --port 3000
else
    print_info "OK! Execute manualmente quando quiser:"
    echo "   npm run build && npx wrangler pages dev dist --d1=dom-production --local --port 3000"
fi
