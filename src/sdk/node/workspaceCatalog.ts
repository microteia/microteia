import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { MarketplacePlugin, ScreenModuleTemplate } from '../../domain/entities/MarketplacePlugin';
import type { SchemaLookup } from '../../domain/schema/screenEntity';
import type { CatalogException, CatalogScreenInput, DomainCatalog } from '../domain/catalog';
import { buildDomainCatalog, collectionOfScreen } from '../domain/catalog';
import { parseDomainModel } from '../domain/domainModel';
import type { RuleLedger } from '../domain/traceability';
import { RULE_LEDGER_FILE, RULE_LEDGER_VERSION, emptyRuleLedger, parseRuleLedger } from '../domain/traceability';
import { modelExceptions } from '../domain/toPlatform';
import { buildPlugin } from './compile';
import {
  INSTALLED_CATALOG_FILE,
  INSTALLED_CATALOG_STALE_DAYS,
  installedScreenInput,
  readInstalledCatalog,
} from './installedCatalog';
import type { InstalledCatalogExtension, InstalledCatalogList } from './installedCatalog';

/**
 * O CATÁLOGO DESTE WORKSPACE — o que o servidor MCP consegue saber, e nada além disso.
 *
 * A honestidade aqui é a parte que importa. O servidor NÃO lê o Firestore do escritório: ele lê os
 * `plugin.ts` que existem neste diretório, compila cada um e junta o que eles declaram, mais as duas
 * entidades que o `entityRegistry.ts` do kernel ainda traz (`members` e `tenant`).
 *
 * Prometer mais do que isso seria pior que a lacuna: o agente deixaria de perguntar.
 *
 * FALTAVA a metade que mais importa numa instalação real. A tela que o escritório criou no Form
 * Design e a extensão de terceiro já instalada não existiam para este módulo, e o detector de "campo
 * que pertence a outra entidade conhecida" não podia disparar justamente contra elas. A saída não foi
 * dar credencial ao SDK — `microteia-plugin` é offline por desenho —, foi ler um RETRATO que o
 * Console exporta (`microteia export-catalog`), quando ele estiver lá. Ver `installedCatalog.ts`.
 *
 * Precedência: uma entidade que apareça nas duas fontes resolve para a do WORKSPACE, que é a que o
 * autor está editando. A do retrato é descartada e a divergência é RELATADA — informação, nunca erro.
 *
 * Ele lê uma segunda coisa, e ela é o que faz uma exceção declarada custar UMA aprovação em vez de
 * uma por sessão: o `domain-model.json` ao lado do `plugin.ts`. `source` e `reason` de um snapshot
 * não têm onde morar num `FieldDefinition` — o artefato guarda um campo comum —, então a declaração
 * fica no arquivo do autor, que é do workspace e não do pacote. Ver `CatalogException`.
 */

export const DOMAIN_MODEL_FILE = 'domain-model.json';

/**
 * O livro de rastreabilidade, lido do lado do `plugin.ts` como o `domain-model.json` já é.
 *
 * Ele é o que faz a REAPLICAÇÃO valer: sem o vínculo de ontem, a mesma regra amanhã propõe as mesmas
 * telas outra vez e a regra ALTERADA propõe uma segunda leva parecida com a primeira. Ver
 * `traceability.ts` para o porquê de ele morar aqui e não dentro do artefato instalado.
 */
export { RULE_LEDGER_FILE };

const findPluginFiles = (dir: string, depth = 3): string[] => {
  if (depth < 0 || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return findPluginFiles(path, depth - 1);
    return entry.name === 'plugin.ts' ? [path] : [];
  });
};

const screenFrom = (template: ScreenModuleTemplate, pluginId: string): CatalogScreenInput => ({
  key: template.key,
  ...(template.dataCollection === undefined ? {} : { collection: template.dataCollection }),
  // O id universal que o pacote já declara. É a segunda precedência da identidade da tela no plano, e
  // sem carregá-lo daqui o plano derivaria um valor novo para uma tela que já tem um — que é o defeito
  // que a identidade existe para não cometer.
  ...(template.sourceId === undefined ? {} : { sourceId: template.sourceId }),
  titleSingular: template.titleSingular,
  titlePlural: template.titlePlural,
  titleFieldKey: template.titleFieldKey,
  fields: template.fields.map((field) => ({ ...field, origin: 'plugin' as const, ownerPluginId: pluginId })),
  ...(template.parentEntity === undefined ? {} : { parentEntity: template.parentEntity }),
  ...(template.parentFieldKey === undefined ? {} : { parentFieldKey: template.parentFieldKey }),
  ...(template.parentRelation === undefined ? {} : { parentRelation: template.parentRelation }),
  ...(template.tagCollection === undefined ? {} : { tagCollection: template.tagCollection }),
  ...(template.eventPrefix === undefined ? {} : { eventPrefix: template.eventPrefix }),
  ownerPluginId: pluginId,
});

/**
 * Um complemento entra como uma SEGUNDA tela sobre a mesma coleção, com chave própria. É assim que
 * `createSchemaContext` já trata o caso, e é o que faz os campos somarem sem que o complemento
 * reivindique o nome da entidade: quem dá rótulo e campo-título continua sendo a tela dona.
 *
 * `targetKind: 'sourceId'` fica de fora: a chave instalada de uma tela de outra extensão varia por
 * escritório, e resolvê-la exigiria ler a instalação.
 */
const patchesFrom = (pkg: MarketplacePlugin): CatalogScreenInput[] =>
  (pkg.screenPatches ?? [])
    .filter((patch) => (patch.targetKind ?? 'collection') === 'collection')
    .map((patch, index) => ({
      key: `${pkg.manifest.id}#patch${index}`,
      collection: patch.target,
      titleSingular: patch.target,
      titleFieldKey: '',
      fields: patch.fields.map((field) => ({ ...field, origin: 'plugin' as const, ownerPluginId: pkg.manifest.id })),
      ownerPluginId: pkg.manifest.id,
    }));

/**
 * O que o retrato da instalação somou a este catálogo — presente só quando o arquivo existe e pôde ser
 * lido. É desta estrutura que sai o que as tools respondem sobre procedência e sobre a idade do
 * retrato: um catálogo apresentado como completo quando não é vale menos que nenhum.
 */
export interface InstalledContribution {
  /** O arquivo, relativo ao diretório de autoria. */
  path: string;
  projectId: string;
  tenantId: string;
  tenantName: string;
  exportedAt: string;
  /** Dias inteiros desde que o retrato foi tirado, ou `null` quando a data é ilegível. */
  ageDays: number | null;
  stale: boolean;
  staleAfterDays: number;
  /** A versão do contrato do kernel que tirou o retrato, e se ela difere da que roda aqui. */
  kernelVersion: string;
  kernelDiffers: boolean;
  consoleVersion: string;
  extensions: InstalledCatalogExtension[];
  /** Coleções que SÓ existem na instalação — as que este catálogo não teria sem o retrato. */
  addedCollections: string[];
  /**
   * Coleções presentes nas duas fontes. A do workspace prevaleceu, e a do retrato foi descartada
   * inteira: é informação, não erro — mas ela é dita, porque a versão instalada pode ter campos que o
   * `plugin.ts` em edição ainda não tem.
   */
  shadowedCollections: string[];
  lookups: number;
  tagLists: number;
}

export interface WorkspaceCatalog {
  catalog: DomainCatalog;
  /** As levas que as regras deste diretório já produziram, num livro só. */
  ruleLedger: RuleLedger;
  /** Os pacotes que compilaram, e o que cada um contribuiu. */
  sources: { path: string; pluginId: string; screens: number; lookups: number }[];
  /** Os que NÃO compilaram. O catálogo segue sem eles, e quem lê fica sabendo. */
  failures: { path: string; error: string }[];
  /** Os `domain-model.json` lidos, e quantas exceções cada um trouxe. */
  models: { path: string; exceptions: number }[];
  /** Os `business-rules.json` lidos, e quantas regras cada um trazia. */
  ledgers: { path: string; rules: number }[];
  /** O retrato da instalação, quando há um utilizável. `null` é o caso normal de quem nunca exportou. */
  installed: InstalledContribution | null;
  /** Por que o retrato não pôde ser usado, ou o que nele merece ressalva. Vazio no caso normal. */
  installedProblems: string[];
}

/**
 * As exceções declaradas num `domain-model.json`. Um arquivo ilegível ou torto é IGNORADO, sem
 * derrubar o catálogo: perder o veredito de ontem é ruim, mas não conseguir validar nada é pior — e
 * quem chama recebe a lista do que foi lido para notar a ausência.
 */
const exceptionsFrom = (path: string, root: string): CatalogException[] => {
  try {
    const parsed = parseDomainModel(readFileSync(path, 'utf8'));
    return parsed.ok ? modelExceptions(parsed.model, relative(root, path)) : [];
  } catch {
    return [];
  }
};

/**
 * O livro de uma pasta. Arquivo ilegível é IGNORADO, sem derrubar nada: perder o vínculo de ontem é
 * ruim, não conseguir planejar hoje é pior — a mesma escolha que `exceptionsFrom` faz.
 */
const ledgerFrom = (path: string): RuleLedger => {
  try {
    return parseRuleLedger(readFileSync(path, 'utf8'));
  } catch {
    return emptyRuleLedger();
  }
};

export interface ReadWorkspaceCatalogOptions {
  /** Injetável só para que a idade do retrato seja testável sem depender do relógio. */
  now?: Date;
}

export const readWorkspaceCatalog = (
  root: string,
  options: ReadWorkspaceCatalogOptions = {},
): WorkspaceCatalog => {
  const screens: CatalogScreenInput[] = [];
  const lookups: SchemaLookup[] = [];
  const tagLists: SchemaLookup[] = [];
  const sources: WorkspaceCatalog['sources'] = [];
  const failures: WorkspaceCatalog['failures'] = [];
  const models: WorkspaceCatalog['models'] = [];
  const ledgers: WorkspaceCatalog['ledgers'] = [];
  const exceptions: CatalogException[] = [];
  const ruleEntries: RuleLedger['rules'] = [];

  for (const entry of findPluginFiles(root)) {
    const modelPath = join(dirname(entry), DOMAIN_MODEL_FILE);
    if (existsSync(modelPath)) {
      const declared = exceptionsFrom(modelPath, root);
      exceptions.push(...declared);
      models.push({ path: relative(root, modelPath), exceptions: declared.length });
    }

    const ledgerPath = join(dirname(entry), RULE_LEDGER_FILE);
    if (existsSync(ledgerPath)) {
      const read = ledgerFrom(ledgerPath);
      ruleEntries.push(...read.rules);
      ledgers.push({ path: relative(root, ledgerPath), rules: read.rules.length });
    }

    try {
      const { package: pkg } = buildPlugin({ entry });
      const own = (pkg.screens ?? []).map((template) => screenFrom(template, pkg.manifest.id));
      screens.push(...own, ...patchesFrom(pkg));
      lookups.push(...(pkg.lookups ?? []).map((one) => ({ collection: one.collection, label: one.label })));
      tagLists.push(...(pkg.tagLists ?? []).map((one) => ({ collection: one.collection, label: one.label })));
      sources.push({
        path: relative(root, entry),
        pluginId: pkg.manifest.id,
        screens: own.length,
        lookups: (pkg.lookups ?? []).length,
      });
    } catch (error) {
      failures.push({ path: relative(root, entry), error: error instanceof Error ? error.message : String(error) });
    }
  }

  const installation = readInstalledCatalog(root, options.now);
  const installedProblems = [...installation.problems];
  let installed: InstalledContribution | null = null;

  if (installation.snapshot !== null) {
    const snapshot = installation.snapshot;
    const claimed = new Set(screens.map(collectionOfScreen));
    const taken = new Set([...claimed, ...lookups.map((one) => one.collection), ...tagLists.map((one) => one.collection)]);

    const addedCollections: string[] = [];
    const shadowedCollections: string[] = [];

    for (const screen of snapshot.screens) {
      const input = installedScreenInput(screen);
      const collection = collectionOfScreen(input);
      if (claimed.has(collection)) {
        if (!shadowedCollections.includes(collection)) shadowedCollections.push(collection);
        continue;
      }
      if (!addedCollections.includes(collection)) addedCollections.push(collection);
      screens.push(input);
    }

    const fromInstallation = (entries: readonly InstalledCatalogList[]): SchemaLookup[] =>
      entries
        .filter((one) => !taken.has(one.collection))
        .map((one) => ({ collection: one.collection, label: one.label }));

    const addedLookups = fromInstallation(snapshot.lookups);
    const addedTagLists = fromInstallation(snapshot.tagLists);
    lookups.push(...addedLookups);
    tagLists.push(...addedTagLists);

    installed = {
      path: relative(root, installation.path),
      projectId: snapshot.projectId,
      tenantId: snapshot.tenantId,
      tenantName: snapshot.tenantName,
      exportedAt: snapshot.exportedAt,
      ageDays: installation.ageDays,
      stale: installation.stale,
      staleAfterDays: INSTALLED_CATALOG_STALE_DAYS,
      kernelVersion: snapshot.kernelVersion,
      kernelDiffers: installation.kernelDiffers,
      consoleVersion: snapshot.consoleVersion,
      extensions: snapshot.extensions,
      addedCollections: addedCollections.sort(),
      shadowedCollections: shadowedCollections.sort(),
      lookups: addedLookups.length,
      tagLists: addedTagLists.length,
    };

    if (installation.stale && installation.ageDays !== null) {
      installedProblems.push(
        `${INSTALLED_CATALOG_FILE} was taken ${installation.ageDays} day(s) ago, and anything created in `
        + `${snapshot.tenantName} since then is missing from it. Run "microteia export-catalog --tenant `
        + `${snapshot.tenantId}" in the installation to refresh it.`,
      );
    }
    if (installation.kernelDiffers) {
      installedProblems.push(
        `${INSTALLED_CATALOG_FILE} was taken by kernel contract ${snapshot.kernelVersion}, and this workspace `
        + 'builds against another one. What it describes may not be what this contract installs.',
      );
    }
  }

  return {
    catalog: buildDomainCatalog(screens, lookups, tagLists, exceptions),
    ruleLedger: { version: RULE_LEDGER_VERSION, rules: ruleEntries },
    sources,
    failures,
    models,
    ledgers,
    installed,
    installedProblems,
  };
};
