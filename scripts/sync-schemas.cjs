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
  'domain/entities/Action.ts',
  'domain/schema/fieldRules.ts',
  'domain/schema/fieldExpression.ts',
  'domain/schema/entityRegistry.ts',
  'domain/schema/lookupRegistry.ts',
  'domain/schema/pathResolver.ts',
  'domain/schema/expressionPaths.ts',
  'domain/schema/eventCatalog.ts',
  'domain/schema/hydrationPlan.ts',
  'domain/schema/materialize.ts',
  'domain/schema/querySpec.ts',
  'domain/schema/mutationSpec.ts',
  'domain/schema/recordRules.ts',
  'domain/schema/aggregationSpec.ts',
  'domain/schema/parameterRules.ts',
  'domain/schema/validateSpec.ts',
  'domain/schema/mapSpec.ts',
  'domain/schema/dataExtensionPoints.ts',
  'domain/schema/plugin/semver.ts',
  'domain/schema/plugin/diagnostics.ts',
  'domain/schema/plugin/permission.ts',
  'domain/schema/plugin/capability.ts',
  'domain/schema/plugin/extensionPoint.ts',
  'domain/schema/plugin/contribution.ts',
  'domain/schema/plugin/pluginManifest.ts',
  'domain/schema/plugin/kernelVersion.ts',
  'domain/schema/plugin/index.ts',
  'kernel/ExtensionPointRegistry.ts',
  'kernel/ContributionRegistry.ts',
  'kernel/ImplementationRegistry.ts',
  'kernel/CapabilityRegistry.ts',
  'kernel/PluginHost.ts',
  'kernel/index.ts',
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
