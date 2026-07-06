#!/usr/bin/env node

/**
 * Verifica se entitySchemas.ts está sincronizado entre frontend e backend.
 * Este script garante que os schemas duplicados mantenham conteúdo idêntico.
 */

const fs = require('fs');
const path = require('path');

const FRONTEND_PATH = path.join(__dirname, '..', 'src', 'domain', 'entities', 'entitySchemas.ts');
const BACKEND_PATH = path.join(__dirname, '..', 'functions', 'src', 'domain', 'entities', 'entitySchemas.ts');

function readAndNormalize(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Remove comentários e normaliza whitespace para comparação
    return content
      .replace(/\/\/.*$/gm, '') // remove comentários de linha
      .replace(/\/\*[\s\S]*?\*\//g, '') // remove comentários de bloco
      .replace(/\s+/g, ' ') // normaliza whitespace
      .trim();
  } catch (error) {
    console.error(`❌ ERRO ao ler ${filePath}:`, error.message);
    process.exit(1);
  }
}

function main() {
  console.log('🔍 Verificando sincronização de entitySchemas.ts...\n');

  const frontend = readAndNormalize(FRONTEND_PATH);
  const backend = readAndNormalize(BACKEND_PATH);

  if (frontend !== backend) {
    console.error('╔═══════════════════════════════════════════════════════════════════════════╗');
    console.error('║                                                                           ║');
    console.error('║  ❌ FALHA: entitySchemas.ts DIVERGENTE entre frontend e backend!         ║');
    console.error('║                                                                           ║');
    console.error('╚═══════════════════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(`   Frontend: ${path.relative(process.cwd(), FRONTEND_PATH)}`);
    console.error(`   Backend:  ${path.relative(process.cwd(), BACKEND_PATH)}`);
    console.error('');
    console.error('   ⚠️  Os arquivos devem ter conteúdo IDÊNTICO.');
    console.error('');
    console.error('   Ação necessária:');
    console.error('   1. Compare os dois arquivos e identifique as diferenças');
    console.error('   2. Copie o conteúdo EXATO de um para o outro');
    console.error('   3. Execute novamente: npm run verify-schemas');
    console.error('');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                           ║');
  console.log('║  ✅ entitySchemas.ts sincronizado entre frontend e backend                ║');
  console.log('║                                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  process.exit(0);
}

main();
