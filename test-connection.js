// test-connection.js
require('dotenv/config');
const { Pool } = require('pg');

async function testConnection() {
  console.log('🔍 Testando conexão com PostgreSQL...\n');
  
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'dom_database',
  });

  try {
    console.log('📝 Configurações usadas:');
    console.log(`   Host: ${pool.options.host}`);
    console.log(`   Port: ${pool.options.port}`);
    console.log(`   Database: ${pool.options.database}`);
    console.log(`   User: ${pool.options.user}`);
    
    // Teste 1: Conexão básica
    console.log('\n🔌 Teste 1: Conectando ao PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Teste 2: Consulta simples
    console.log('\n📊 Teste 2: Consultando dados do sistema...');
    const timeResult = await client.query('SELECT NOW() as current_time, version() as version');
    console.log(`   Hora do servidor: ${timeResult.rows[0].current_time}`);
    console.log(`   Versão PostgreSQL: ${timeResult.rows[0].version.split(',')[0]}`);
    
    // Teste 3: Listar tabelas
    console.log('\n🗃️  Teste 3: Listando tabelas do banco...');
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log(`   Total de tabelas: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.table_name}`);
    });
    
    // Teste 4: Verificar tabela users
    console.log('\n👥 Teste 4: Verificando tabela users...');
    const usersResult = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN active = 1 THEN 1 END) as ativos
      FROM users
    `);
    console.log(`   Total de usuários: ${usersResult.rows[0].total}`);
    console.log(`   Usuários ativos: ${usersResult.rows[0].ativos}`);
    
    // Teste 5: Listar alguns usuários
    console.log('\n📋 Teste 5: Listando usuários de exemplo...');
    const sampleUsers = await client.query(`
      SELECT id, email, name, role, active 
      FROM users 
      ORDER BY id 
      LIMIT 5
    `);
    
    sampleUsers.rows.forEach(user => {
      console.log(`   ${user.id}. ${user.email} (${user.name}) - ${user.role} ${user.active ? '✅' : '❌'}`);
    });
    
    // Teste 6: Testar credenciais do admin
    console.log('\n🔑 Teste 6: Verificando usuário admin...');
    const adminResult = await client.query(
      'SELECT id, email, password_hash FROM users WHERE email = $1',
      ['admin@municipio.gov.br']
    );
    
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log(`   ✅ Admin encontrado: ${admin.email} (ID: ${admin.id})`);
      console.log(`   🔐 Hash de senha: ${admin.password_hash ? 'Presente' : 'Faltando'}`);
    } else {
      console.log('   ❌ Usuário admin não encontrado!');
    }
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Todos os testes passaram! PostgreSQL está configurado corretamente.');
    
  } catch (error) {
    console.error('\n❌ ERRO NA CONEXÃO:');
    console.error(`   Mensagem: ${error.message}`);
    console.error('\n💡 Soluções possíveis:');
    console.error('   1. PostgreSQL está rodando?');
    console.error('   2. Verifique as credenciais no .env');
    console.error('   3. Banco "dom_database" existe?');
    console.error('   4. Usuário tem permissão?');
    process.exit(1);
  }
}

testConnection();