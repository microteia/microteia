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
  'domain/entities/Report.ts',
  'domain/schema/fieldRules.ts',
  'domain/schema/fieldRulePresets.ts',
  'domain/schema/lookupProviderSpec.ts',
  'domain/schema/clockGate.ts',
  'domain/schema/time/businessDays.ts',
  'domain/schema/time/businessDaysGate.ts',
  'domain/schema/time/extensionPoints.ts',
  'domain/schema/theme/themePoints.ts',
  'domain/schema/expressionSyntax.ts',
  'domain/schema/expressionEvaluation.ts',
  'domain/schema/fieldExpression.ts',
  'domain/schema/entityRegistry.ts',
  'domain/schema/lookupRegistry.ts',
  'domain/schema/screenEntity.ts',
  'domain/schema/pathResolver.ts',
  'domain/schema/expressionPaths.ts',
  'domain/schema/eventCatalog.ts',
  'domain/schema/hydrationPlan.ts',
  'domain/schema/materialize.ts',
  'domain/schema/storedReference.ts',
  'domain/schema/querySpec.ts',
  'domain/schema/mutationSpec.ts',
  'domain/schema/recordRules.ts',
  'domain/schema/recordKeys.ts',
  'domain/schema/recordSequence.ts',
  'domain/schema/editWindow.ts',
  'domain/schema/memberVisibility.ts',
  'domain/schema/ui/cardTemplate.ts',
  'domain/schema/portal.ts',
  'domain/schema/portalCollections.ts',
  'domain/schema/portalFieldInput.ts',
  'domain/schema/portalExtensionPoints.ts',
  'domain/schema/portalReprojection.ts',
  'domain/schema/portalIdentity.ts',
  'domain/schema/actionScope.ts',
  'domain/schema/plugin/codeTrust.ts',
  'domain/schema/aggregationSpec.ts',
  'domain/schema/aggregateBackfill.ts',
  'domain/schema/recordKeyAdoption.ts',
  'domain/schema/recordImport.ts',
  'domain/schema/recordImportReference.ts',
  'domain/schema/predicateMatch.ts',
  'domain/schema/recordOrder.ts',
  'domain/schema/parameterRules.ts',
  'domain/schema/validateSpec.ts',
  'domain/schema/mapSpec.ts',
  'domain/schema/workflowStepCatalog.ts',
  'domain/schema/workflowClock.ts',
  'domain/schema/workflowAuditTrigger.ts',
  'domain/schema/auditRetention.ts',
  'domain/schema/memberMfa.ts',
  'domain/schema/workflowReturn.ts',
  'domain/schema/dataExtensionPoints.ts',
  'domain/schema/settings.ts',
  'domain/schema/notifications.ts',
  'domain/schema/notificationContacts.ts',
  'domain/schema/recordLink.ts',
  'domain/schema/notificationTemplate.ts',
  'domain/schema/i18n/localeNegotiation.ts',
  'domain/schema/i18n/messages.ts',
  'domain/schema/i18n/localizedMessage.ts',
  'domain/errors/LocalizedError.ts',
  'domain/schema/i18n/messageRef.ts',
  'domain/schema/i18n/localeFormat.ts',
  'domain/schema/i18n/localeGate.ts',
  'domain/schema/i18n/timeZone.ts',
  'domain/schema/i18n/extensionPoints.ts',
  'domain/schema/i18n/index.ts',
  'domain/schema/plugin/artifactRef.ts',
  'domain/schema/plugin/artifactPrefix.ts',
  'domain/schema/plugin/semver.ts',
  'domain/schema/plugin/diagnostics.ts',
  'domain/schema/plugin/permission.ts',
  'domain/schema/plugin/capability.ts',
  'domain/schema/plugin/extensionPoint.ts',
  'domain/schema/plugin/contribution.ts',
  'domain/schema/plugin/backendRequirement.ts',
  'domain/schema/plugin/pluginManifest.ts',
  'domain/schema/plugin/kernelVersion.ts',
  'domain/schema/plugin/migration.ts',
  'domain/schema/plugin/index.ts',
  'domain/schema/contentFingerprint.ts',
  'domain/schema/access/permission.ts',
  'domain/schema/access/resolvePermissions.ts',
  'domain/schema/access/extensionPoints.ts',
  'domain/schema/access/kernelPermissions.ts',
  'domain/schema/access/catalogFingerprint.ts',
  'domain/schema/access/memberPermissions.ts',
  'domain/schema/access/permissionGate.ts',
  'domain/schema/access/permissionPattern.ts',
  'domain/schema/access/permissionSelection.ts',
  'domain/schema/access/index.ts',
  'domain/schema/tenantCollections.ts',
  'domain/schema/agent/agentBackend.ts',
  'domain/schema/agent/agentGrant.ts',
  'domain/schema/agent/agentOAuth.ts',
  'domain/schema/agent/agentOps.ts',
  'domain/schema/agent/agentInput.ts',
  'domain/schema/agent/agentWorkflow.ts',
  'domain/schema/agent/agentDocument.ts',
  'domain/schema/agent/index.ts',
  'domain/schema/report/reportSpec.ts',
  'domain/schema/report/reportCapabilities.ts',
  'domain/schema/report/reportBuckets.ts',
  'domain/schema/report/reportChartSplit.ts',
  'domain/schema/report/reportComputedMeasure.ts',
  'domain/schema/report/reportResult.ts',
  'domain/schema/report/reportRowFilter.ts',
  'domain/schema/report/aggregateRows.ts',
  'domain/schema/report/validateReportSpec.ts',
  'domain/schema/report/reportExtensionPoints.ts',
  'domain/schema/report/reportCsv.ts',
  'domain/schema/report/index.ts',
  'domain/schema/document/templateGrammar.ts',
  'domain/schema/document/documentTemplate.ts',
  'domain/schema/document/documentDownloads.ts',
  'domain/schema/document/templatePaths.ts',
  'domain/schema/document/starterTemplate.ts',
  'domain/schema/document/index.ts',
  'kernel/ExtensionPointRegistry.ts',
  'kernel/ContributionRegistry.ts',
  'kernel/ImplementationRegistry.ts',
  'kernel/CapabilityRegistry.ts',
  'kernel/PluginHost.ts',
  'kernel/index.ts',
  // Os catálogos do idioma-fonte que o BACKEND precisa resolver.
  //
  // Ele sempre emitiu referência (`@core.records/field.invalid-format`) e deixou a resolução para a
  // tela, que tem o catálogo de quem lê. O gateway de agente é o primeiro consumidor que NÃO é uma
  // tela: devolver a referência crua a um modelo é devolver nada.
  //
  // A lista é o conjunto de namespaces que `functions/src` de fato cita, e `agentMessages.test.ts`
  // reprova quando o backend passa a citar um que não está aqui — é o que a mantém derivada em vez
  // de mantida à mão.
  'plugins/messages/coreAccess.ts',
  'plugins/messages/coreAdmin.ts',
  'plugins/messages/coreAutomation.ts',
  'plugins/messages/coreData.ts',
  'plugins/messages/coreDocuments.ts',
  'plugins/messages/coreMarketplace.ts',
  'plugins/messages/coreRecords.ts',
  'plugins/messages/coreReports.ts',
  'plugins/messages/coreTenant.ts',
  'plugins/messages/coreUi.ts',
  'plugins/messages/coreWorkspace.ts',
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

/**
 * O que um arquivo sincronizado importa de RELATIVO, e que precisa EXISTIR do lado do backend.
 *
 * A cópia é literal, inclusive os `import`/`export ... from`. Um arquivo da lista que aponte para um
 * vizinho sem contraparte em `functions/src` gera, no backend, um módulo que referencia outro que
 * não existe — e isso o gate do root NÃO pega: `npm run typecheck` não entra no tsconfig das
 * functions. O defeito aparece só em `tsc -b functions`, no build ou no deploy.
 *
 * Foi o que aconteceu quando `access/index.ts` passou a reexportar `permissionSelection`: o
 * `--check` dizia que tudo estava sincronizado, porque todas as cópias batiam com as fontes. Batiam
 * mesmo — faltava uma.
 *
 * A contraparte NÃO precisa ser gerada. `domain/entities/{AuditLog,Workflow}.ts` são escritas à mão
 * em `functions/src` e sempre foram; exigi-las na lista seria inventar uma regra que o projeto não
 * tem, para resolver um problema que ele não tinha. O que se cobra é a existência.
 */
const RELATIVE_IMPORT = /\bfrom\s+'(\.[^']*)'/g;

const resolveIn = (base, specifier, root) => {
  const joined = path.posix.join(path.posix.dirname(base), specifier);
  for (const candidate of [`${joined}.ts`, `${joined}.tsx`, `${joined}/index.ts`]) {
    if (fs.existsSync(path.join(ROOT, root, 'src', candidate))) return candidate;
  }
  return null;
};

const missingCompanions = () => {
  const missing = [];

  for (const relativePath of SHARED_FILES) {
    const source = fs.readFileSync(path.join(ROOT, 'src', relativePath), 'utf8');
    for (const [, specifier] of source.matchAll(RELATIVE_IMPORT)) {
      // Não resolve dentro de `src/`: é import quebrado, e quem o reprova é o `tsc` — com o nome do
      // símbolo, que é informação melhor do que esta verificação teria para dar.
      const inSource = resolveIn(relativePath, specifier, '.');
      if (inSource === null) continue;
      if (resolveIn(relativePath, specifier, 'functions') !== null) continue;
      missing.push({ from: relativePath, needs: inSource });
    }
  }
  return missing;
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

const missing = missingCompanions();
if (missing.length > 0) {
  console.error('❌ Arquivo sincronizado importando um que não tem contraparte no backend:');
  for (const { from, needs } of missing) {
    console.error(`   - src/${from} importa src/${needs}, que não existe em functions/src`);
  }
  console.error('');
  console.error('   A cópia é literal: no backend, o import apontaria para um módulo inexistente.');
  console.error('   Acrescente o arquivo a SHARED_FILES, ou dê a ele uma contraparte em functions/src.');
  process.exit(1);
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
