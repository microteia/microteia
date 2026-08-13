/**
 * Gera os `.json` distribuíveis das extensões de primeira parte a partir da FONTE (`src/plugins/
 * marketplace/*.ts`), no mesmo formato que a tela "Baixar .json" produz (`serializePackage`).
 *
 *   npm run build:extensions            # regrava extension-templates/*.json
 *   npm run build:extensions -- --check # falha se algum estiver desatualizado (usado no verify)
 *
 * Existe porque o `.ts` é a fonte editável e o `.json` é o artefato de distribuição: sem este passo
 * um arquivo antigo continua sendo importado, e a extensão instalada não é a que está no código —
 * exatamente o sintoma que motivou o script.
 *
 * Carrega os módulos TS pelo próprio Vite (`ssrLoadModule`), então resolução, aliases e sintaxe são
 * idênticos aos da aplicação.
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'vite';

const OUTPUT_DIR = 'extension-templates';

/** Arquivo distribuído → export do módulo de catálogo que o origina. */
const TEMPLATES = {
  'brasil.json': 'brasilPlugin',
  'pessoa.json': 'pessoaPlugin',
  'contrato.json': 'contratoPlugin',
  'processo.json': 'processoPlugin',
  'prazo.json': 'prazoPlugin',
  'push.json': 'pushPlugin',
  'financeiro.json': 'financeiroPlugin',
  'noticia.json': 'noticiaPlugin',
  'kanban-processos.json': 'kanbanCasesPlugin',
  'dashboard.json': 'dashboardPlugin',
};

const check = process.argv.includes('--check');

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const catalog = await server.ssrLoadModule('/src/plugins/marketplace/catalog.ts');
  let stale = 0;

  for (const [fileName, exportName] of Object.entries(TEMPLATES)) {
    const plugin = catalog[exportName];
    if (!plugin) throw new Error(`O catálogo não exporta "${exportName}".`);

    const content = `${JSON.stringify(plugin, null, 2)}\n`;
    const path = join(OUTPUT_DIR, fileName);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;

    if (current === content) {
      console.log(`✔️  ${path} (em dia)`);
      continue;
    }
    if (check) {
      stale += 1;
      console.error(`❌ ${path} está desatualizado — rode "npm run build:extensions".`);
      continue;
    }
    writeFileSync(path, content);
    console.log(`✏️  gerado: ${path}`);
  }

  if (stale > 0) process.exitCode = 1;
  else if (!check) console.log('✅ extensões exportadas');
} finally {
  await server.close();
}
