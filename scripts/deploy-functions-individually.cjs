#!/usr/bin/env node

/**
 * Script de deploy individual das Firebase Functions
 *
 * Resolve o problema de limite de CPU ao fazer deploy de todas as functions de uma vez.
 * Faz deploy de cada function isoladamente com delay configurável entre elas.
 *
 * Uso:
 *   node scripts/deploy-functions-individually.cjs
 *   node scripts/deploy-functions-individually.cjs --delay 60
 *   node scripts/deploy-functions-individually.cjs --only callAIProxy,getUserInfo
 *   node scripts/deploy-functions-individually.cjs --skip auditFlatEntityChange
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Lista completa de functions exportadas (ordem de index.ts)
const ALL_FUNCTIONS = [
  'agentMcp',
  'createAgentGrant',
  'revokeAgentGrant',
  'agentOAuth',
  'getAgentAuthRequest',
  'consentAgentAuthRequest',
  'callAIProxy',
  'detectWorkflows',
  'runWorkflow',
  'getUserInfo',
  'checkNicknameAvailability',
  'claimNickname',
  'addTenantMember',
  'removeTenantMember',
  'onUserCreated',
  'auditFlatEntityChange',
  'auditNestedEntityChange',
  'auditTenantDeleted',
  'backupDeletedAuditLog',
  'logClientError',
  'manageNotificationEmail',
  'getWebPushPublicKey',
  'onWorkflowEventCreated',
  'syncWorkflowClock',
  'runWorkflowClock',
  'getWorkflowStepCatalog',
  'publishWorkflowEventOnEntityChange',
  'recomputeAggregatesOnEntityChange',
  'reconcileAggregatesOnScreenChange',
  'runAggregateBackfill',
  'reconcileAggregates',
  'reconcileRecordKeysOnScreenChange',
  'runRecordKeyAdoption',
  'recheckRecordKeysOnEntityChange',
  'reconcileRecordKeys',
  'onNoteChange',
  'onDocumentChange',
  'getExpressionFunctions',
  'runScript',
  'runAction',
  'runReport',
  'renderDocument',
  'materializePermissionsOnMemberChange',
  'materializePermissionsOnRoleChange',
  'materializePermissionsOnScreenChange',
  'materializePermissionsOnExtensionChange',
  'countExtensionInstalls',
  'aggregateExtensionRatings',
  'syncTenantPermissions',
];

// Mesmo seletor dos demais scripts de deploy: `dev` por padrão, produção só se pedida. Este script
// já apontou para produção FIXO, ignorando o TARGET — um comando digitado sem pensar publicava no
// ambiente real.
const TARGET = process.env.TARGET || 'dev';

// Parse argumentos
const args = process.argv.slice(2);
let delaySeconds = 1; // delay padrão entre deploys
let targetFunctions = ALL_FUNCTIONS;
let skipFunctions = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--delay' && args[i + 1]) {
    delaySeconds = parseInt(args[i + 1], 10);
    i++;
  } else if (args[i] === '--only' && args[i + 1]) {
    targetFunctions = args[i + 1].split(',').map(f => f.trim());
    i++;
  } else if (args[i] === '--skip' && args[i + 1]) {
    skipFunctions = args[i + 1].split(',').map(f => f.trim());
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
Uso: node scripts/deploy-functions-individually.cjs [opções]

Opções:
  --delay N        Aguardar N segundos entre cada deploy (padrão: 1)
  --only fn1,fn2   Fazer deploy apenas das functions especificadas
  --skip fn1,fn2   Pular as functions especificadas
  --help, -h       Mostrar esta mensagem

Exemplos:
  node scripts/deploy-functions-individually.cjs
  node scripts/deploy-functions-individually.cjs --delay 60
  node scripts/deploy-functions-individually.cjs --only callAIProxy,getUserInfo
  node scripts/deploy-functions-individually.cjs --skip auditFlatEntityChange,auditNestedEntityChange
    `);
    process.exit(0);
  }
}

// Filtrar functions
const functionsToDeplay = targetFunctions.filter(fn => !skipFunctions.includes(fn));

console.log('═══════════════════════════════════════════════════════════');
console.log('  Deploy Individual de Firebase Functions — Microteia');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Projeto de destino: ${TARGET}`);
console.log(`Total de functions: ${functionsToDeplay.length}`);
console.log(`Delay entre deploys: ${delaySeconds}s`);
if (skipFunctions.length > 0) {
  console.log(`Pulando: ${skipFunctions.join(', ')}`);
}
console.log('───────────────────────────────────────────────────────────\n');

const results = {
  success: [],
  failed: [],
  skipped: [],
};

const sleep = (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

const runCommand = (command, options = {}) => {
  try {
    execSync(command, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      ...options,
    });
    return true;
  } catch (error) {
    return false;
  }
};

const deployFunction = async (functionName, index, total) => {
  const prefix = `[${index + 1}/${total}]`;
  console.log(`\n${prefix} ━━━ ${functionName}`);
  console.log(`${prefix} Iniciando deploy...`);

  const success = runCommand(
    `firebase deploy --only functions:${functionName} --project ${TARGET}`,
    { stdio: 'pipe' }
  );

  if (success) {
    console.log(`${prefix} ✅ Deploy de ${functionName} concluído com sucesso`);
    results.success.push(functionName);
  } else {
    console.error(`${prefix} ❌ Falha no deploy de ${functionName}`);
    results.failed.push(functionName);
  }

  return success;
};

const main = async () => {
  const startTime = Date.now();

  // Build das functions (uma vez antes de tudo)
  console.log('🔧 Compilando functions...\n');
  const buildSuccess = runCommand('npm run build:functions');

  if (!buildSuccess) {
    console.error('\n❌ Falha na compilação das functions. Abortando.\n');
    process.exit(1);
  }

  console.log('\n✅ Compilação concluída.\n');
  console.log('───────────────────────────────────────────────────────────');
  console.log('Iniciando deploys individuais...');
  console.log('───────────────────────────────────────────────────────────');

  // Deploy de cada function
  for (let i = 0; i < functionsToDeplay.length; i++) {
    const functionName = functionsToDeplay[i];
    await deployFunction(functionName, i, functionsToDeplay.length);

    // Aguardar entre deploys (exceto no último)
    if (i < functionsToDeplay.length - 1) {
      console.log(`\n⏳ Aguardando ${delaySeconds}s antes do próximo deploy...`);
      await sleep(delaySeconds);
    }
  }

  // Resumo final
  const endTime = Date.now();
  const totalTime = Math.round((endTime - startTime) / 1000);
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  Resumo do Deploy');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Sucesso: ${results.success.length}`);
  console.log(`❌ Falha:   ${results.failed.length}`);
  console.log(`⏱️  Tempo total: ${minutes}min ${seconds}s`);
  console.log('───────────────────────────────────────────────────────────');

  if (results.success.length > 0) {
    console.log('\n✅ Deployadas com sucesso:');
    results.success.forEach(fn => console.log(`   • ${fn}`));
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Falharam:');
    results.failed.forEach(fn => console.log(`   • ${fn}`));
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  // Salvar log
  const logPath = path.join(__dirname, '..', '.deploy-log.json');
  fs.writeFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    totalTime,
    results,
  }, null, 2));

  console.log(`📄 Log salvo em: ${logPath}\n`);

  // Exit code
  process.exit(results.failed.length > 0 ? 1 : 0);
};

main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
