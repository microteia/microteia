#!/usr/bin/env node

/**
 * Gera as cópias backend dos arquivos de schema compartilhados.
 *
 * Fonte única (editável):   src/<caminho>
 * Cópia gerada (não edite): functions/src/<caminho>
 *
 * Uso:
 *   node scripts/sync-schemas.cjs           # gera/atualiza as cópias
 *   node scripts/sync-schemas.cjs --check   # falha se alguma cópia estiver desatualizada
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const SHARED_FILES = [
  'domain/entities/entitySchemas.ts',
];

const buildHeader = (relativePath) =>
  [
    '// ═══════════════════════════════════════════════════════════════════════════',
    '// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.',
    `// Fonte única: src/${relativePath}`,
    '// Para alterar, edite a fonte e rode: npm run sync-schemas',
    '// ═══════════════════════════════════════════════════════════════════════════',
    '',
    '',
  ].join('\n');

const expectedTargetContent = (relativePath) => {
  const sourcePath = path.join(ROOT, 'src', relativePath);
  const source = fs.readFileSync(sourcePath, 'utf8');
  return buildHeader(relativePath) + source;
};

const checkMode = process.argv.includes('--check');
let divergent = [];

for (const relativePath of SHARED_FILES) {
  const targetPath = path.join(ROOT, 'functions', 'src', relativePath);
  const expected = expectedTargetContent(relativePath);
  const actual = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;

  if (actual === expected) continue;

  if (checkMode) {
    divergent.push(relativePath);
  } else {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, expected, 'utf8');
    console.log(`✏️  gerado: functions/src/${relativePath}`);
  }
}

if (checkMode) {
  if (divergent.length > 0) {
    console.error('❌ Cópias de schema desatualizadas em functions/src:');
    for (const relativePath of divergent) {
      console.error(`   - functions/src/${relativePath}`);
    }
    console.error('');
    console.error('   Rode: npm run sync-schemas (e nunca edite as cópias geradas)');
    process.exit(1);
  }
  console.log('✅ Schemas compartilhados sincronizados (fonte: src/, cópias geradas em functions/src/)');
} else {
  console.log('✅ sync-schemas concluído');
}
