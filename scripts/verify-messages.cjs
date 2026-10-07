#!/usr/bin/env node
/**
 * Confere que toda chave usada em `t('...')` existe no catálogo de origem (inglês)
 * e aponta as chaves do catálogo pt-BR que não têm par no inglês.
 *
 * O namespace de cada arquivo vem do `useT('<ns>')` declarado nele.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/**
 * O BACKEND entra na conferência de referências, e não entrava.
 *
 * Ele não tem `useT` — devolve a REFERÊNCIA e quem resolve é a tela —, então era o único lugar onde
 * uma referência podia apontar para o vazio sem ninguém notar. Foi o que aconteceu com
 * `@core.admin/member.limit-reached-error` (a chave mora em `core.tenant`) e com seis categorias de
 * função de expressão que nunca existiram no catálogo: o que a pessoa lia na tela era o texto cru
 * "@core.admin/member.limit-reached-error".
 */
const FUNCTIONS_SRC = path.join(ROOT, 'functions', 'src');

/**
 * Os namespaces do NÚCLEO, cujo catálogo de origem mora em `src/plugins/messages/`.
 *
 * Uma EXTENSÃO não entra aqui: o catálogo dela viaja dentro do pacote, e é `PLUGIN_CATALOG_BY_NS`
 * que diz onde. A distinção não é burocrática — é a mesma que impede o pacote de idioma do núcleo
 * de carregar chave de plugin.
 */
const MODULE_BY_NS = {
  'core.access': 'coreAccess',
  'core.ui': 'coreUi',
  'core.admin': 'coreAdmin',
  'core.tenant': 'coreTenant',
  'core.marketplace': 'coreMarketplace',
  'core.records': 'coreRecords',
  'core.reports': 'coreReports',
  'core.workspace': 'coreWorkspace',
  'core.settings': 'coreSettings',
  'core.i18n': 'coreI18n',
  'core.automation': 'coreAutomation',
  'core.data': 'coreData',
  'core.license': 'coreLicense',
};

/**
 * Onde mora a tradução pt-BR de cada namespace.
 *
 * O normal é o pacote de idioma: um pacote traduz o núcleo inteiro, instala e desinstala. Mas um
 * plugin pode chegar com a própria tradução — é a tendência natural de quem escreve uma extensão, e
 * o mecanismo é o mesmo (uma contribuição `i18n.messages`). O que muda é só o ARQUIVO, e é isto que
 * o gate precisa saber para continuar cobrando o par de cada chave.
 */
const PT_BR_LOCALE_PACKAGE = { dir: path.join('marketplace', 'localePtBr') };

const PT_BR_CATALOG_BY_NS = {
  'core.tenant': { dir: 'core.tenant', module: 'messagesPtBr' },
  'core.auth': { dir: 'core.auth', module: 'messagesPtBr' },
};

/**
 * As EXTENSÕES que carregam o próprio par de catálogos — o de origem e o traduzido —, ao lado do
 * arquivo de plugin. São as agnósticas de negócio: uma agenda, uma tela de abertura, um mural e os
 * moldes de autoria servem a qualquer escritório, e por isso nascem em inglês em vez de num idioma só.
 *
 * O `dir` é relativo a `src/plugins/`, e é por isso que um exemplo da coletânea traz o caminho da
 * pasta dele: o par de catálogos mora junto do `plugin.ts` que os usa, não num diretório comum.
 *
 * Estão aqui pelo mesmo motivo que os namespaces do núcleo estão: sem a entrada, o gate não conhece
 * o catálogo e para de cobrar o par de cada chave — e deixar de cobrar é indistinguível de estar
 * tudo certo.
 */
const PLUGIN_CATALOG_BY_NS = {
  'com.microteia.agent': { dir: 'marketplace', source: 'agentMessages', ptBr: 'agentMessagesPtBr' },
  'com.microteia.automation-example': { dir: 'marketplace/examples/automation-example', source: 'automationMessages', ptBr: 'automationMessagesPtBr' },
  'com.microteia.calendar': { dir: 'marketplace', source: 'calendarMessages', ptBr: 'calendarMessagesPtBr' },
  'com.microteia.dashboard': { dir: 'marketplace', source: 'dashboardMessages', ptBr: 'dashboardMessagesPtBr' },
  'com.microteia.news': { dir: 'marketplace', source: 'newsMessages', ptBr: 'newsMessagesPtBr' },
  'com.microteia.report-example': { dir: 'marketplace/examples/report-example', source: 'reportMessages', ptBr: 'reportMessagesPtBr' },
  'com.microteia.widget-example': { dir: 'marketplace/examples/widget-example', source: 'widgetMessages', ptBr: 'widgetMessagesPtBr' },
  'com.microteia.access-example': { dir: 'marketplace/examples/access-example', source: 'accessMessages', ptBr: 'accessMessagesPtBr' },
  'com.microteia.backend-example': { dir: 'marketplace/examples/backend-example', source: 'backendMessages', ptBr: 'backendMessagesPtBr' },
  'com.microteia.library-example': { dir: 'marketplace/examples/library-example', source: 'libraryMessages', ptBr: 'libraryMessagesPtBr' },
  'com.microteia.consumer-example': { dir: 'marketplace/examples/consumer-example', source: 'consumerMessages', ptBr: 'consumerMessagesPtBr' },
  'com.microteia.patch-example': { dir: 'marketplace/examples/patch-example', source: 'patchMessages', ptBr: 'patchMessagesPtBr' },
  'com.microteia.theme-example': { dir: 'marketplace/examples/theme-example', source: 'themeMessages', ptBr: 'themeMessagesPtBr' },
  'com.microteia.auth-example': { dir: 'marketplace/examples/auth-example', source: 'authMessages', ptBr: 'authMessagesPtBr' },
  'com.microteia.command-example': { dir: 'marketplace/examples/command-example', source: 'commandMessages', ptBr: 'commandMessagesPtBr' },
  'com.microteia.settings-example': { dir: 'marketplace/examples/settings-example', source: 'settingsMessages', ptBr: 'settingsMessagesPtBr' },
  'com.microteia.record-tab-example': { dir: 'marketplace/examples/record-tab-example', source: 'recordTabMessages', ptBr: 'recordTabMessagesPtBr' },
};

/** Onde mora o catálogo de ORIGEM de um namespace, seja ele do núcleo ou de uma extensão. */
const sourceCatalog = (ns) => {
  const plugin = PLUGIN_CATALOG_BY_NS[ns];
  if (plugin) return { dir: path.join(SRC, 'plugins', plugin.dir), module: plugin.source };
  const moduleName = MODULE_BY_NS[ns];
  return moduleName ? { dir: path.join(SRC, 'plugins', 'messages'), module: moduleName } : null;
};

const translatedCatalog = (ns) => {
  const plugin = PLUGIN_CATALOG_BY_NS[ns];
  if (plugin) return { dir: path.join(SRC, 'plugins', plugin.dir), module: plugin.ptBr };
  const moduleName = MODULE_BY_NS[ns];
  return moduleName ? ptBrCatalog(ns, moduleName) : null;
};

/** Todo namespace que o gate conhece — do núcleo e das extensões que trazem catálogo próprio. */
const ALL_NAMESPACES = [...Object.keys(MODULE_BY_NS), ...Object.keys(PLUGIN_CATALOG_BY_NS)];

const ptBrCatalog = (ns, moduleName) => {
  const declared = PT_BR_CATALOG_BY_NS[ns];
  return {
    dir: path.join(SRC, 'plugins', declared?.dir ?? PT_BR_LOCALE_PACKAGE.dir),
    module: declared?.module ?? moduleName,
  };
};

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

const catalogKeys = (dir, moduleName) => {
  const file = path.join(dir, `${moduleName}.ts`);
  if (!fs.existsSync(file)) return new Set();
  const source = fs.readFileSync(file, 'utf8');
  const keys = new Set();
  for (const match of source.matchAll(/^\s*'([^']+)':/gm)) keys.add(match[1]);
  for (const match of source.matchAll(/^\s*([A-Za-z][\w.-]*):/gm)) keys.add(match[1]);
  return keys;
};

const missing = [];
const orphans = [];

/**
 * Uma REFERÊNCIA (`@core.ui/action.save`) escrita num catálogo declarativo ou num diagnóstico não
 * passa por `t()` e escaparia da checagem — e uma referência sem chave aparece na tela como o texto
 * cru "@core.ui/action.save", que é justamente o que a resolução tolerante deixa passar em silêncio.
 */
const checkReferences = (file, source) => {
  for (const match of source.matchAll(/'@([a-z][\w.-]*)\/([\w.-]+)'/g)) {
    const catalog = sourceCatalog(match[1]);
    if (!catalog) continue;
    const keys = catalogKeys(catalog.dir, catalog.module);
    const key = match[2];
    if (!keys.has(key) && !(keys.has(`${key}.one`) && keys.has(`${key}.other`))) {
      missing.push(`${path.relative(ROOT, file)} -> ${match[1]}/${key}`);
    }
  }
};
const duplicates = [];

// Chave repetida no mesmo catálogo é silenciosa em JS — a última vence — e desfaz uma tradução
// anterior sem aviso. Aqui ela para o gate.
for (const ns of ALL_NAMESPACES) {
  const origin = sourceCatalog(ns);
  const translated = translatedCatalog(ns);
  const files = [
    path.join(origin.dir, `${origin.module}.ts`),
    path.join(translated.dir, `${translated.module}.ts`),
  ];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const seen = new Set();
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s*'([^']+)':/gm)) {
      if (seen.has(match[1])) duplicates.push(`${path.relative(ROOT, file)} -> ${ns}/${match[1]}`);
      seen.add(match[1]);
    }
  }
}

/**
 * O arquivo de plugin não escreve a referência inteira em cada rótulo — seriam mais de cem repetições
 * do namespace. Ele declara um construtor de UMA linha:
 *
 *     const message = (key: string): string => `@com.microteia.calendar/${key}`;
 *
 * e o gate lê o namespace DALI e confere cada `message('chave')`. É o mesmo desenho do `useT('<ns>')`:
 * o namespace aparece uma vez, escrito, e todas as chaves do arquivo são cobradas contra ele. Sem esta
 * leitura, um construtor esconderia as referências do gate — o que é pior do que não ter o gate, porque
 * ele continuaria dizendo que está tudo certo.
 */
const checkMessageBuilder = (file, source) => {
  const declared = /=> `@([a-z][\w.-]*)\/\$\{key\}`/.exec(source);
  if (!declared) return;
  const catalog = sourceCatalog(declared[1]);
  if (!catalog) {
    missing.push(`${path.relative(ROOT, file)} -> namespace ${declared[1]} sem catálogo declarado no gate`);
    return;
  }
  const keys = catalogKeys(catalog.dir, catalog.module);
  for (const match of source.matchAll(/\bmessage\('([^']+)'\)/g)) {
    const key = match[1];
    if (!keys.has(key) && !(keys.has(`${key}.one`) && keys.has(`${key}.other`))) {
      missing.push(`${path.relative(ROOT, file)} -> ${declared[1]}/${key}`);
    }
  }
};

for (const file of walk(FUNCTIONS_SRC)) {
  checkReferences(file, fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''));
}

for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  checkReferences(file, source);
  checkMessageBuilder(file, source);

  const namespaces = [...source.matchAll(/useT\('([^']+)'\)/g)].map((m) => m[1]);
  if (namespaces.length !== 1) continue;
  const ns = namespaces[0];
  if (!sourceCatalog(ns)) continue;
  for (const match of source.matchAll(/\bt\('([^']+)'/g)) {
    // Uma chave com `/` é ABSOLUTA: traz o próprio namespace e ignora o do arquivo.
    const slash = match[1].lastIndexOf('/');
    const keyNs = slash === -1 ? ns : match[1].slice(0, slash);
    const key = slash === -1 ? match[1] : match[1].slice(slash + 1);
    const catalog = sourceCatalog(keyNs);
    if (!catalog) continue;
    const keys = catalogKeys(catalog.dir, catalog.module);
    // Chave de PLURAL não existe sozinha: o catálogo guarda `.one`/`.other`.
    if (!keys.has(key) && !(keys.has(`${key}.one`) && keys.has(`${key}.other`))) {
      missing.push(`${path.relative(ROOT, file)} -> ${keyNs}/${key}`);
    }
  }
}

for (const ns of ALL_NAMESPACES) {
  const origin = sourceCatalog(ns);
  const source = catalogKeys(origin.dir, origin.module);
  const ptBr = translatedCatalog(ns);
  for (const key of catalogKeys(ptBr.dir, ptBr.module)) {
    if (!source.has(key)) orphans.push(`${ns}/${key}`);
  }
}

/**
 * O pacote de idioma instalado num escritório é um retrato: só é atualizado quando a VERSÃO muda.
 * A impressão digital garante que mudar o catálogo sem mexer na versão pare o gate.
 */
const fingerprintIssue = () => {
  const dir = path.join(SRC, 'plugins', 'marketplace', 'localePtBr');
  const hash = crypto.createHash('sha256');
  for (const file of fs.readdirSync(dir).filter((name) => /^core.*\.ts$/.test(name)).sort()) {
    hash.update(fs.readFileSync(path.join(dir, file)));
  }
  const actual = hash.digest('hex').slice(0, 12);
  const index = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');
  const declared = /PT_BR_MESSAGES_FINGERPRINT = '([0-9a-f]+)'/.exec(index)?.[1];
  if (declared === actual) return null;
  return (
    `O catálogo pt-BR mudou (impressão ${actual}, declarada ${declared ?? 'nenhuma'}).\n`
    + '  Suba o `version` do pacote em src/plugins/marketplace/localePtBr/index.ts e ponha a\n'
    + `  impressão nova em PT_BR_MESSAGES_FINGERPRINT: '${actual}'.\n`
    + '  Sem isso, quem já instalou o idioma não recebe as chaves novas — o Marketplace só\n'
    + '  oferece atualização quando a versão muda.'
  );
};

const fingerprint = fingerprintIssue();

if (missing.length === 0 && orphans.length === 0 && duplicates.length === 0 && !fingerprint) {
  console.log('verify-messages: catálogos íntegros.');
  process.exit(0);
}
if (missing.length > 0) {
  console.error(`\nChaves usadas que NÃO existem no catálogo de origem (${missing.length}):`);
  for (const line of [...new Set(missing)].sort()) console.error(`  ${line}`);
}
if (orphans.length > 0) {
  console.error(`\nChaves traduzidas sem par no catálogo de origem (${orphans.length}):`);
  for (const line of orphans.sort()) console.error(`  ${line}`);
}
if (duplicates.length > 0) {
  console.error(`\nChaves declaradas duas vezes no mesmo catálogo (${duplicates.length}):`);
  for (const line of duplicates.sort()) console.error(`  ${line}`);
}
if (fingerprint) console.error(`\n${fingerprint}`);
process.exit(1);
