/**
 * Gera os `.json` distribuíveis das extensões de primeira parte a partir da FONTE (`src/plugins/
 * marketplace/*.ts`).
 *
 *   npm run build:extensions            # regrava extension-templates/*.json
 *   npm run build:extensions -- --check # falha se algum estiver desatualizado (usado no verify)
 *
 * Existe porque o `.ts` é a fonte editável e o `.json` é o artefato de distribuição: sem este passo
 * um arquivo antigo continua sendo importado, e a extensão instalada não é a que está no código —
 * exatamente o sintoma que motivou o script.
 *
 * Usa o COMPILADOR DO SDK (`src/sdk/node/compile.ts`), o mesmo que um escritório roda com
 * `microteia-plugin build`. Antes era o `ssrLoadModule` do Vite, o que dava dois compiladores para a
 * mesma coisa; agora esta esteira é a prova diária de que o do autor funciona, e
 * `src/sdk/node/compile.test.ts` compara os dois lados byte a byte.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { existsSync as compilerExists } from 'node:fs';

const COMPILER = 'sdk/lib/sdk/node/compile.js';
if (!compilerExists(COMPILER)) {
  console.error(`❌ O compilador do SDK não está construído (${COMPILER}).`);
  console.error('   Rode "npm run build:sdk" — o "npm run verify" já o faz, nesta ordem.');
  process.exit(1);
}

const { buildPlugin } = await import(`../${COMPILER}`);

const OUTPUT_DIR = 'extension-templates';
const CATALOG = 'src/plugins/marketplace/catalog.ts';

/** Arquivo distribuído → export do módulo de catálogo que o origina. */
const TEMPLATES = {
  'agent.json': 'agentPlugin',
  'brasil.json': 'brasilPlugin',
  'news.json': 'newsPlugin',
  'dashboard.json': 'dashboardPlugin',
  'calendar.json': 'calendarPlugin',
  'business-days.json': 'businessDaysPlugin',
  'locale-pt-br.json': 'localePtBrPlugin',
  'automation-example.json': 'automationExamplePlugin',
  'report-example.json': 'reportExamplePlugin',
  'widget-example.json': 'widgetExamplePlugin',
  'access-example.json': 'accessExamplePlugin',
  'backend-example.json': 'backendExamplePlugin',
  'library-example.json': 'libraryExamplePlugin',
  'consumer-example.json': 'consumerExamplePlugin',
  'patch-example.json': 'patchExamplePlugin',
  'theme-example.json': 'themeExamplePlugin',
  'auth-example.json': 'authExamplePlugin',
  'command-example.json': 'commandExamplePlugin',
  'settings-example.json': 'settingsExamplePlugin',
  'record-tab-example.json': 'recordTabExamplePlugin',
  'document-example.json': 'documentExamplePlugin',
};

const check = process.argv.includes('--check');
let stale = 0;

for (const [fileName, exportName] of Object.entries(TEMPLATES)) {
  const { json, issues } = buildPlugin({ entry: CATALOG, exportName });

  // O mesmo veredito que a instalação daria. Publicar um artefato que o próprio kernel recusaria é o
  // defeito mais caro possível: ele só aparece no escritório de quem instalou.
  if (issues.length > 0) {
    console.error(`❌ ${fileName}: ${issues.length} pendência(s) que a instalação recusaria:`);
    for (const issue of issues) console.error(`     [${issue.source}] ${issue.message}`);
    stale += 1;
    continue;
  }

  const path = join(OUTPUT_DIR, fileName);
  const current = existsSync(path) ? readFileSync(path, 'utf8') : null;

  if (current === json) {
    console.log(`✔️  ${path} (em dia)`);
  } else if (check) {
    stale += 1;
    console.error(`❌ ${path} está desatualizado — rode "npm run build:extensions".`);
  } else {
    writeFileSync(path, json);
    console.log(`✏️  gerado: ${path}`);
  }
}

if (stale > 0) process.exitCode = 1;
else if (!check) console.log('✅ extensões exportadas');
