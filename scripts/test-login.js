// scripts/test-login.js
import bcrypt from 'bcryptjs';

// Testar os hashes do seu seed.sql
async function testHashes() {
  console.log('🔐 Testando hashes do seed.sql...\n');
  
  // Hash do seed.sql (todos iguais?)
  const seedHash = '$2a$10$rN0qJKEZqQqZ5Z5Z5Z5Z5uOYvZ5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5Z5O';
  
  const testPasswords = [
    { password: 'admin123', user: 'admin' },
    { password: 'semad123', user: 'semad' },
    { password: 'publisher123', user: 'publisher' },
    { password: 'author123', user: 'author' }
  ];
  
  for (const test of testPasswords) {
    const isValid = await bcrypt.compare(test.password, seedHash);
    console.log(`${test.user} (${test.password}): ${isValid ? '✅ VÁLIDO' : '❌ INVÁLIDO'}`);
  }
  
  // Gerar novos hashes
  console.log('\n🔄 Gerando novos hashes...');
  for (const test of testPasswords) {
    const newHash = await bcrypt.hash(test.password, 10);
    console.log(`${test.password}: ${newHash}`);
  }
}

testHashes();