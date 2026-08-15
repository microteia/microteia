#!/usr/bin/env node
/**
 * Confere que toda chave usada em `t('...')` existe no catálogo de origem (inglês)
 * e aponta as chaves do catálogo pt-BR que não têm par no inglês.
 *
 * O namespace de cada arquivo vem do `useT('<ns>')` declarado nele.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const MODULE_BY_NS = {
  'core.ui': 'coreUi',
  'core.admin': 'coreAdmin',
  'core.marketplace': 'coreMarketplace',
  'core.records': 'coreRecords',
  'core.workspace': 'coreWorkspace',
  'core.settings': 'coreSettings',
  'core.i18n': 'coreI18n',
  'core.automation': 'coreAutomation',
  'core.data': 'coreData',
  'core.license': 'coreLicense',
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
    const moduleName = MODULE_BY_NS[match[1]];
    if (!moduleName) continue;
    const keys = catalogKeys(path.join(SRC, 'plugins', 'messages'), moduleName);
    const key = match[2];
    if (!keys.has(key) && !(keys.has(`${key}.one`) && keys.has(`${key}.other`))) {
      missing.push(`${path.relative(ROOT, file)} -> ${match[1]}/${key}`);
    }
  }
};
const duplicates = [];

// Chave repetida no mesmo catálogo é silenciosa em JS — a última vence — e desfaz uma tradução
// anterior sem aviso. Aqui ela para o gate.
for (const [ns, moduleName] of Object.entries(MODULE_BY_NS)) {
  for (const dir of ['messages', path.join('marketplace', 'localePtBr')]) {
    const file = path.join(SRC, 'plugins', dir, `${moduleName}.ts`);
    if (!fs.existsSync(file)) continue;
    const seen = new Set();
    for (const match of fs.readFileSync(file, 'utf8').matchAll(/^\s*'([^']+)':/gm)) {
      if (seen.has(match[1])) duplicates.push(`${path.relative(ROOT, file)} -> ${ns}/${match[1]}`);
      seen.add(match[1]);
    }
  }
}

for (const file of walk(SRC)) {
  const source = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  checkReferences(file, source);

  const namespaces = [...source.matchAll(/useT\('([^']+)'\)/g)].map((m) => m[1]);
  if (namespaces.length !== 1) continue;
  const ns = namespaces[0];
  const moduleName = MODULE_BY_NS[ns];
  if (!moduleName) continue;
  for (const match of source.matchAll(/\bt\('([^']+)'/g)) {
    // Uma chave com `/` é ABSOLUTA: traz o próprio namespace e ignora o do arquivo.
    const slash = match[1].lastIndexOf('/');
    const keyNs = slash === -1 ? ns : match[1].slice(0, slash);
    const key = slash === -1 ? match[1] : match[1].slice(slash + 1);
    const keyModule = MODULE_BY_NS[keyNs];
    if (!keyModule) continue;
    const keys = catalogKeys(path.join(SRC, 'plugins', 'messages'), keyModule);
    // Chave de PLURAL não existe sozinha: o catálogo guarda `.one`/`.other`.
    if (!keys.has(key) && !(keys.has(`${key}.one`) && keys.has(`${key}.other`))) {
      missing.push(`${path.relative(ROOT, file)} -> ${keyNs}/${key}`);
    }
  }
}

for (const [ns, moduleName] of Object.entries(MODULE_BY_NS)) {
  const source = catalogKeys(path.join(SRC, 'plugins', 'messages'), moduleName);
  const translated = catalogKeys(path.join(SRC, 'plugins', 'marketplace', 'localePtBr'), moduleName);
  for (const key of translated) {
    if (!source.has(key)) orphans.push(`${ns}/${key}`);
  }
}

if (missing.length === 0 && orphans.length === 0 && duplicates.length === 0) {
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
process.exit(1);
