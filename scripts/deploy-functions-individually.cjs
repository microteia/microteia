#!/usr/bin/env node

/**
 * Script de deploy individual das Firebase Functions
 *
 * Resolve o problema de limite de CPU ao fazer deploy de todas as functions de uma vez: sobe uma a uma.
 *
 * Três coisas fazem a diferença entre minutos e horas:
 *
 * - O `predeploy` do `firebase.json` recompila TODAS as functions a cada `firebase deploy`. Com ~60
 *   functions, eram ~60 compilações. O build roda UMA vez aqui, e cada deploy usa uma cópia temporária
 *   do `firebase.json` sem o `predeploy` das functions (`--config`).
 * - A function que falha não segura a fila: vai para o fim, e as passadas se repetem até todas subirem
 *   ou cada uma que falha esgotar `--attempts` tentativas (padrão 5).
 * - Nenhum deploy pode ficar esperando resposta. Sem terminal, uma pergunta do Firebase CLI (política de
 *   repetição, exclusão de cópia em outra região) ficava pendurada no stdin. Agora o deploy roda com
 *   `--non-interactive` e stdin fechado: a pergunta vira recusa na hora, é reconhecida e NÃO é repetida,
 *   porque a resposta seria a mesma. Há ainda um tempo máximo por deploy (`--timeout`).
 *
 * Uso:
 *   node scripts/deploy-functions-individually.cjs
 *   node scripts/deploy-functions-individually.cjs --only callAIProxy,getUserInfo
 *   node scripts/deploy-functions-individually.cjs --skip auditFlatEntityChange
 *   node scripts/deploy-functions-individually.cjs --attempts 8 --force
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

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
  'invitePortalUser',
  'getPortalSignInOptions',
  'startPortalSignIn',
  'completePortalSignIn',
  'managePortalSignIn',
  'revokePortalUser',
  'getPortalContext',
  'getPortalDocumentUrl',
  'submitPortalRecord',
  'attachPortalDocument',
  'projectPortalRecord',
  'projectPortalDocument',
  'refreshPortalAudience',
  'reprojectPortalOnScreenChange',
  'runPortalReprojection',
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
  'publishWorkflowEventOnAuditLog',
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
  'onDownloadDeleted',
  'attachDownloadToRecord',
  'previewDocument',
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

// As mesmas recusas que o Console reconhece (`cli/src/console/deployFunctions.ts`): repetir não muda a
// resposta, então a function sai da fila na primeira vez.
const TERMINAL_FAILURES = [
  {
    match: /Aborting because deletion cannot proceed in non-interactive mode/,
    hint: 'Há uma cópia desta function que o código não declara mais (quase sempre em outra região). '
      + 'Apague-a com "firebase functions:delete <nome> --region <região-antiga>" ou rode com --force.',
  },
  {
    match: /Pass the --force option to deploy functions with a failure policy/,
    hint: 'A function passou a ter `retry` e o Firebase pede confirmação uma única vez. Rode de novo '
      + 'com --only <nome> --force (o --force também apagaria cópias em outra região sem perguntar).',
  },
  {
    match: /cannot be answered in non-interactive mode|non-interactive mode/,
    hint: 'O Firebase CLI precisa de uma resposta. Rode uma vez à mão, num terminal: '
      + 'firebase deploy --only functions:<nome> --project <alvo>.',
  },
];

const HELP = `
Uso: node scripts/deploy-functions-individually.cjs [opções]

Opções:
  --only fn1,fn2   Fazer deploy apenas das functions especificadas
  --skip fn1,fn2   Pular as functions especificadas
  --attempts N     Tentativas por function antes de desistir (padrão: 5)
  --delay N        Segundos entre um deploy e o próximo (padrão: 0)
  --pass-wait N    Segundos entre uma passada e a de repetição (padrão: 20)
  --timeout N      Minutos que um deploy pode levar antes de ser abortado (padrão: 15)
  --force          Repassa --force ao firebase: confirma a política de repetição e APAGA cópias
                   da function em outra região sem perguntar
  --help, -h       Mostrar esta mensagem

Exemplos:
  node scripts/deploy-functions-individually.cjs
  TARGET=prod node scripts/deploy-functions-individually.cjs
  node scripts/deploy-functions-individually.cjs --only callAIProxy,getUserInfo
  node scripts/deploy-functions-individually.cjs --skip auditFlatEntityChange,auditNestedEntityChange
`;

const parseArgs = (argv) => {
  const options = {
    only: null,
    skip: [],
    attempts: 5,
    delay: 0,
    passWait: 20,
    timeoutMinutes: 15,
    force: false,
  };
  const list = (value) => value.split(',').map((name) => name.trim()).filter(Boolean);
  const number = (flag, value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      console.error(`Valor inválido para ${flag}: ${value}`);
      process.exit(1);
    }
    return parsed;
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--help' || flag === '-h') {
      console.log(HELP);
      process.exit(0);
    } else if (flag === '--force') {
      options.force = true;
    } else if (value === undefined) {
      console.error(`Opção sem valor ou desconhecida: ${flag}`);
      process.exit(1);
    } else if (flag === '--only') {
      options.only = list(value); i++;
    } else if (flag === '--skip') {
      options.skip = list(value); i++;
    } else if (flag === '--attempts') {
      options.attempts = Math.max(1, Math.floor(number(flag, value))); i++;
    } else if (flag === '--delay') {
      options.delay = number(flag, value); i++;
    } else if (flag === '--pass-wait') {
      options.passWait = number(flag, value); i++;
    } else if (flag === '--timeout') {
      options.timeoutMinutes = number(flag, value); i++;
    } else {
      console.error(`Opção desconhecida: ${flag}`);
      process.exit(1);
    }
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));

const unknown = (options.only || []).filter((name) => !ALL_FUNCTIONS.includes(name));
if (unknown.length > 0) {
  console.error(`Functions desconhecidas em --only: ${unknown.join(', ')}`);
  process.exit(1);
}

const functionsToDeploy = (options.only || ALL_FUNCTIONS).filter((name) => !options.skip.includes(name));

const sleep = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

const stripAnsi = (text) => text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

// A linha que EXPLICA a falha: a causa (`Error:`, `HTTP Error`), e não o epílogo genérico do firebase.
const failureReason = (output) => {
  const lines = stripAnsi(output).split('\n').map((line) => line.trim()).filter(Boolean);
  const epilogue = /^Error: There was an error deploying functions/;
  const chosen = lines.find((line) => /(^|\s)(Error:|HTTP Error|functions\[|✖)/.test(line) && !epilogue.test(line))
    || lines.find((line) => /failed to (create|update|delete)/.test(line))
    || lines[lines.length - 1]
    || 'sem saída do firebase';
  return chosen.length > 240 ? `${chosen.slice(0, 239)}…` : chosen;
};

// Cópia do firebase.json sem o `predeploy` das functions, na RAIZ (o firebase resolve `source` e o
// `.firebaserc` relativos ao diretório do arquivo de configuração).
const DEPLOY_CONFIG = path.join(ROOT, '.firebase.deploy-individual.json');

const writeDeployConfig = () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  const strip = (entry) => {
    const { predeploy: _predeploy, ...rest } = entry;
    return rest;
  };
  config.functions = Array.isArray(config.functions) ? config.functions.map(strip) : strip(config.functions);
  fs.writeFileSync(DEPLOY_CONFIG, JSON.stringify(config, null, 2));
};

const removeDeployConfig = () => {
  try {
    fs.unlinkSync(DEPLOY_CONFIG);
  } catch {
    // já removido
  }
};

const deployOne = (name) => {
  const args = [
    'deploy',
    '--only', `functions:${name}`,
    '--project', TARGET,
    '--config', DEPLOY_CONFIG,
    '--non-interactive',
  ];
  if (options.force) args.push('--force');

  const startedAt = Date.now();
  const result = spawnSync('firebase', args, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeoutMinutes * 60 * 1000,
    env: { ...process.env, CI: process.env.CI || 'true' },
  });
  const seconds = Math.round((Date.now() - startedAt) / 1000);

  if (result.error && result.error.code === 'ETIMEDOUT') {
    return { ok: false, seconds, output: '', reason: `tempo esgotado (${options.timeoutMinutes} min)`, terminal: null };
  }
  if (result.error) {
    return { ok: false, seconds, output: '', reason: result.error.message, terminal: null };
  }

  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status === 0) return { ok: true, seconds, output };

  const clean = stripAnsi(output);
  const terminal = TERMINAL_FAILURES.find((candidate) => candidate.match.test(clean)) || null;
  return { ok: false, seconds, output, reason: failureReason(output), terminal };
};

const formatDuration = (totalSeconds) => `${Math.floor(totalSeconds / 60)}min ${totalSeconds % 60}s`;

const main = async () => {
  const startTime = Date.now();

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Deploy Individual de Firebase Functions — Microteia');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Projeto de destino: ${TARGET}`);
  console.log(`Total de functions: ${functionsToDeploy.length}`);
  console.log(`Tentativas por function: ${options.attempts}`);
  if (options.skip.length > 0) console.log(`Pulando: ${options.skip.join(', ')}`);
  if (options.force) console.log('⚠️  --force: cópias em outra região serão apagadas sem pergunta');
  console.log('───────────────────────────────────────────────────────────\n');

  console.log('🔧 Compilando functions (uma única vez)...\n');
  const build = spawnSync('npm', ['run', 'build:functions'], { cwd: ROOT, stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('\n❌ Falha na compilação das functions. Abortando.\n');
    process.exit(1);
  }

  writeDeployConfig();
  process.on('exit', removeDeployConfig);
  process.on('SIGINT', () => process.exit(130));
  process.on('SIGTERM', () => process.exit(143));

  const attempts = new Map(functionsToDeploy.map((name) => [name, 0]));
  const lastFailure = new Map();
  const deployed = [];
  const gaveUp = [];
  const refused = [];
  let queue = [...functionsToDeploy];

  for (let pass = 1; queue.length > 0; pass++) {
    if (pass > 1) {
      console.log(`\n───────────────────────────────────────────────────────────`);
      console.log(`Passada ${pass}: repetindo ${queue.length} function(s) que falharam`);
      if (options.passWait > 0) {
        console.log(`⏳ Aguardando ${options.passWait}s antes de repetir...`);
        await sleep(options.passWait);
      }
    }

    const retry = [];
    for (let index = 0; index < queue.length; index++) {
      const name = queue[index];
      const attempt = attempts.get(name) + 1;
      attempts.set(name, attempt);
      const label = `[${index + 1}/${queue.length}] ${name}` + (attempt > 1 ? ` (tentativa ${attempt}/${options.attempts})` : '');

      process.stdout.write(`… ${label}\n`);
      const result = deployOne(name);

      if (result.ok) {
        console.log(`✅ ${label} — ${result.seconds}s`);
        deployed.push(name);
      } else {
        console.log(`❌ ${label} — falhou após ${result.seconds}s`);
        console.log(`   ${result.reason}`);
        lastFailure.set(name, result);
        if (result.terminal) {
          console.log('   recusa do firebase sem terminal: repetir não muda a resposta');
          refused.push(name);
        } else if (attempt >= options.attempts) {
          console.log(`   desistindo após ${attempt} tentativas`);
          gaveUp.push(name);
        } else {
          console.log('   vai para o fim da fila');
          retry.push(name);
        }
      }

      if (index < queue.length - 1 && options.delay > 0) await sleep(options.delay);
    }
    queue = retry;
  }

  const totalTime = Math.round((Date.now() - startTime) / 1000);
  const failed = [...refused, ...gaveUp];

  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  Resumo do Deploy');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`✅ Sucesso: ${deployed.length}`);
  console.log(`❌ Falha:   ${failed.length}`);
  console.log(`⏱️  Tempo total: ${formatDuration(totalTime)}`);
  console.log('───────────────────────────────────────────────────────────');

  const retried = deployed.filter((name) => attempts.get(name) > 1);
  if (retried.length > 0) {
    console.log('\n🔁 Subiram depois de repetir:');
    retried.forEach((name) => console.log(`   • ${name} (${attempts.get(name)} tentativas)`));
  }

  if (failed.length > 0) {
    const hints = new Set();
    console.log('\n❌ Não subiram:');
    for (const name of failed) {
      const failure = lastFailure.get(name);
      console.log(`   • ${name} (${attempts.get(name)} tentativa(s)): ${failure.reason}`);
      if (failure.terminal) hints.add(failure.terminal.hint);
    }
    if (hints.size > 0) {
      console.log('\n💡 O que fazer:');
      hints.forEach((hint) => console.log(`   ${hint}`));
    }
    const last = lastFailure.get(failed[failed.length - 1]);
    if (last.output) {
      console.log(`\n── Saída do firebase para ${failed[failed.length - 1]} (últimas linhas) ──`);
      console.log(stripAnsi(last.output).trim().split('\n').slice(-25).join('\n'));
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');

  const logPath = path.join(ROOT, '.deploy-log.json');
  fs.writeFileSync(logPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    target: TARGET,
    totalTime,
    results: {
      success: deployed,
      failed: failed.map((name) => ({
        name,
        attempts: attempts.get(name),
        reason: lastFailure.get(name).reason,
        output: stripAnsi(lastFailure.get(name).output || ''),
      })),
    },
  }, null, 2));
  console.log(`📄 Log salvo em: ${logPath}\n`);

  process.exit(failed.length > 0 ? 1 : 0);
};

main().catch((error) => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
