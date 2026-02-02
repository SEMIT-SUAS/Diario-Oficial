#!/usr/bin/env node

/**
 * Script de Inicialização Automática do Banco PostgreSQL
 * Cria o banco de dados, aplica o schema e insere dados iniciais
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configurações do PostgreSQL
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'root',
  database: 'postgres' // Conecta ao banco padrão primeiro
};

const DB_NAME = process.env.DB_NAME || 'dom_database';

// Cores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createDatabase() {
  const pool = new Pool(DB_CONFIG);
  
  try {
    log('\n🔍 Verificando se o banco de dados existe...', 'blue');
    
    // Verifica se o banco existe
    const result = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [DB_NAME]
    );
    
    if (result.rows.length > 0) {
      log(`✅ Banco de dados '${DB_NAME}' já existe`, 'green');
    } else {
      log(`📦 Criando banco de dados '${DB_NAME}'...`, 'yellow');
      await pool.query(`CREATE DATABASE ${DB_NAME}`);
      log(`✅ Banco de dados '${DB_NAME}' criado com sucesso!`, 'green');
    }
  } catch (error) {
    log(`❌ Erro ao criar banco de dados: ${error.message}`, 'red');
    throw error;
  } finally {
    await pool.end();
  }
}

async function executeSQL(pool, sqlFile, description) {
  try {
    log(`\n📄 ${description}...`, 'blue');
    
    const sqlPath = path.join(__dirname, '..', 'database', sqlFile);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sql);
    
    log(`✅ ${description} - Concluído!`, 'green');
  } catch (error) {
    log(`❌ Erro em ${description}: ${error.message}`, 'red');
    throw error;
  }
}

async function initializeDatabase() {
  // Conecta ao banco de dados específico
  const pool = new Pool({
    ...DB_CONFIG,
    database: DB_NAME
  });
  
  try {
    log('\n🗄️  Inicializando schema do banco de dados...', 'blue');
    await executeSQL(pool, 'schema.sql', 'Aplicando schema (tabelas e índices)');
    
    log('\n🌱 Inserindo dados iniciais...', 'blue');
    await executeSQL(pool, 'seed.sql', 'Inserindo dados de exemplo');
    
    log('\n✨ Banco de dados inicializado com sucesso!', 'green');
    
    // Mostra resumo
    const counts = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM secretarias) as secretarias,
        (SELECT COUNT(*) FROM matter_types) as matter_types,
        (SELECT COUNT(*) FROM matters) as matters,
        (SELECT COUNT(*) FROM system_settings) as settings
    `);
    
    log('\n📊 Resumo dos dados:', 'blue');
    log(`   👥 Usuários: ${counts.rows[0].users}`);
    log(`   🏢 Secretarias: ${counts.rows[0].secretarias}`);
    log(`   📋 Tipos de Matéria: ${counts.rows[0].matter_types}`);
    log(`   📄 Matérias: ${counts.rows[0].matters}`);
    log(`   ⚙️  Configurações: ${counts.rows[0].settings}`);
    
  } catch (error) {
    log(`\n❌ Erro ao inicializar banco de dados: ${error.message}`, 'red');
    throw error;
  } finally {
    await pool.end();
  }
}

async function main() {
  log('='.repeat(60), 'blue');
  log('  🚀 DOM - Inicialização do Banco de Dados PostgreSQL', 'blue');
  log('='.repeat(60), 'blue');
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise((resolve) => {
    readline.question('\n⚠️  ATENÇÃO: Isso vai RECRIAR todo o banco de dados!\n   Deseja continuar? (s/N): ', resolve);
  });
  
  readline.close();
  
  if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
    log('\n❌ Operação cancelada pelo usuário.', 'yellow');
    log('📋 Para iniciar o servidor sem recriar o banco:', 'yellow');
    log('   npm run server');
    process.exit(0);
  }
  
  try {
    // 1. Criar banco de dados
    await createDatabase();
    
    // 2. Inicializar schema e dados
    await initializeDatabase();
    
    log('\n' + '='.repeat(60), 'green');
    log('  ✅ BANCO DE DADOS PRONTO PARA USO!', 'green');
    log('='.repeat(60), 'green');
    
    log('\n📋 Próximos passos:', 'yellow');
    log('   1. Configure as variáveis de ambiente (.env)');
    log('   2. Execute: npm run dev');
    log('   3. Acesse: http://localhost:3000');
    log('   4. Login: admin@municipio.gov.br / admin123\n');
    
    process.exit(0);
  } catch (error) {
    log('\n❌ Falha na inicialização do banco de dados', 'red');
    process.exit(1);
  }
}

// Executar
main();
