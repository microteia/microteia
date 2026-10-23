import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { DeclaredNavGroup } from '../../domain/usecases/plugins/declaredNavGroups';
import { declaredNavGroupsOf } from '../../domain/usecases/plugins/declaredNavGroups';
import type { DocumentTemplateContract } from '../../domain/usecases/plugins/documentStepIntegrity';
import { declaredDocumentTemplates } from '../../domain/usecases/plugins/documentStepIntegrity';
import type { SchemaLookup } from '../../domain/schema/screenEntity';
import type { ExportedArtifact } from '../../domain/usecases/plugins/crossExtensionRefs';
import { exportedSurface } from '../../domain/usecases/plugins/crossExtensionRefs';
import type { NavTargetOwner } from '../../domain/usecases/plugins/navTargets';
import { navTargetOwnerOf } from '../../domain/usecases/plugins/navTargets';
import type { CatalogException, CatalogScreenInput, DomainCatalog } from '../domain/catalog';
import { buildDomainCatalog, collectionOfScreen } from '../domain/catalog';
import { DOMAIN_MODEL_FILE, parseDomainModel } from '../domain/domainModel';
import { packageScreenInputs, sourceIdPatchesFrom } from '../domain/packageScreens';
import type { RuleLedger } from '../domain/traceability';
import { RULE_LEDGER_FILE, RULE_LEDGER_VERSION, emptyRuleLedger, parseRuleLedger } from '../domain/traceability';
import { modelExceptions } from '../domain/toPlatform';
import { buildPlugin } from './compile';
import { packageText } from './messages';
import { findPluginFiles } from './workspacePlugins';
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
 * E são DUAS fontes, não três: o que mora em `examples/` fica FORA deste catálogo. Aqueles pacotes são
 * nossos, reescritos a cada troca de kernel, e nada neste diretório os instalou — enquanto eles entravam
 * pela varredura, a precedência acima trabalhava contra o próprio propósito dela, porque a coleção de um
 * exemplo descartava a tela real do escritório. Ver `workspacePlugins.ts`.
 *
 * Ele lê uma segunda coisa, e ela é o que faz uma exceção declarada custar UMA aprovação em vez de
 * uma por sessão: o `domain-model.json` ao lado do `plugin.ts`. `source` e `reason` de um snapshot
 * não têm onde morar num `FieldDefinition` — o artefato guarda um campo comum —, então a declaração
 * fica no arquivo do autor, que é do workspace e não do pacote. Ver `CatalogException`.
 */

/**
 * Os dois arquivos de trabalho lidos do lado do `plugin.ts`: o modelo e o livro de rastreabilidade.
 *
 * Nenhum dos dois nasce aqui — `domainModel.ts` e `traceability.ts` os declaram, e este módulo só os
 * repassa a quem já o importa. O livro é o que faz a REAPLICAÇÃO valer: sem o vínculo de ontem, a
 * mesma regra amanhã propõe as mesmas telas outra vez e a regra ALTERADA propõe uma segunda leva
 * parecida com a primeira. Ver `traceability.ts` para o porquê de ele não morar dentro do artefato
 * instalado.
 */
export { DOMAIN_MODEL_FILE, RULE_LEDGER_FILE };

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
  /**
   * Se a superfície exportada das extensões pode ser lida como completa. `false` quando o retrato veio
   * de um Console anterior a `exports` — e aí a ausência de uma lista não diz que a extensão não
   * exporta nada, diz que ninguém perguntou.
   */
  exportsKnown: boolean;
  /** Se o retrato traz os grupos da barra lateral de TODAS as extensões — ver `navGroupsKnown`. */
  navGroupsKnown: boolean;
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
  /**
   * A SUPERFÍCIE PÚBLICA de cada pacote deste diretório — o que uma extensão daqui pode referenciar
   * de uma IRMÃ daqui.
   *
   * O retrato da instalação não alcança este caso, e ele é o mais comum de todos: o escritório escreve
   * a `utils` e a extensão que a usa lado a lado, e a `utils` ainda não está instalada em lugar nenhum.
   * Enquanto isto não viajava, o que se enxergava da irmã era id, versão e problemas — nunca o nome de
   * nada dentro dela.
   *
   * Aqui a lista vazia é AFIRMAÇÃO, ao contrário do retrato: o `plugin.ts` está na mão, e um pacote sem
   * `exports` não expõe nada mesmo.
   */
  authored: {
    path: string;
    pluginId: string;
    version: string;
    exports: ExportedArtifact[];
    /**
     * As páginas e as telas do pacote — o que um item de menu de uma irmã que a declara em
     * `dependencies` pode abrir. Ausente só num retrato montado à mão, e aí ela não é enxergada.
     */
    navTargets?: NavTargetOwner;
    /** Os grupos da barra lateral que o pacote declara, com o nome resolvido pelo catálogo dele. */
    navGroups?: DeclaredNavGroup[];
    /** Os modelos de documento que o pacote declara, como contrato — o que um passo de uma irmã cita. */
    documentTemplates?: DocumentTemplateContract[];
  }[];
  /**
   * Os `plugin.ts` de `examples/`, como CAMINHO e nada mais.
   *
   * Eles não são compilados e não entram em nada acima: nada neste diretório os instalou, e uma
   * entidade que só existe num exemplo não existe em escritório nenhum. Viajam para que a resposta
   * possa dizer que estão lá e valem leitura — o silêncio faria um diretório só com exemplos parecer
   * vazio. Ver `workspacePlugins.ts`.
   */
  examples: string[];
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
  const authored: WorkspaceCatalog['authored'] = [];
  const failures: WorkspaceCatalog['failures'] = [];
  const models: WorkspaceCatalog['models'] = [];
  const ledgers: WorkspaceCatalog['ledgers'] = [];
  const exceptions: CatalogException[] = [];
  const ruleEntries: RuleLedger['rules'] = [];
  const compiled: MarketplacePlugin[] = [];

  const files = findPluginFiles(root);

  for (const entry of files.authored) {
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
      compiled.push(pkg);
      const describe = packageText(pkg);
      const own = packageScreenInputs(pkg, [], { sourceIdPatches: false });
      screens.push(...own);
      lookups.push(...(pkg.lookups ?? []).map((one) => ({ collection: one.collection, label: one.label })));
      tagLists.push(...(pkg.tagLists ?? []).map((one) => ({ collection: one.collection, label: one.label })));
      sources.push({
        path: relative(root, entry),
        pluginId: pkg.manifest.id,
        screens: (pkg.screens ?? []).length,
        lookups: (pkg.lookups ?? []).length,
      });
      authored.push({
        path: relative(root, entry),
        pluginId: pkg.manifest.id,
        version: pkg.manifest.version,
        /**
         * O nome resolvido AQUI, e não em quem imprime: esta lista é a resposta de `list_referenceable`
         * e do portão da referência cruzada, e cada um dos dois teria de lembrar de resolvê-la — o
         * catálogo do pacote está em mãos neste ponto do laço e em nenhum dos dois.
         */
        exports: exportedSurface(pkg).map((one) => ({ ...one, name: describe(one.name) })),
        navTargets: navTargetOwnerOf(pkg),
        navGroups: declaredNavGroupsOf(pkg.manifest.contributes),
        documentTemplates: declaredDocumentTemplates(pkg.manifest.contributes),
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
      exportsKnown: installation.exportsKnown,
      navGroupsKnown: installation.navGroupsKnown,
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
    if (!installation.exportsKnown) {
      installedProblems.push(
        `${INSTALLED_CATALOG_FILE} was taken by a Console that did not record what each extension exports, `
        + 'so there is no telling which artifacts of them may be referenced. Do not read the absence of a '
        + `list as "this extension exports nothing". Run "microteia export-catalog --tenant `
        + `${snapshot.tenantId}" with the Console that came with this installation.`,
      );
    }
    if (installation.kernelDiffers) {
      installedProblems.push(
        `${INSTALLED_CATALOG_FILE} was taken by kernel contract ${snapshot.kernelVersion}, and this workspace `
        + 'builds against another one. What it describes may not be what this contract installs.',
      );
    }
  }

  screens.push(...compiled.flatMap((pkg) => sourceIdPatchesFrom(pkg, screens)));

  return {
    catalog: buildDomainCatalog(screens, lookups, tagLists, exceptions),
    ruleLedger: { version: RULE_LEDGER_VERSION, rules: ruleEntries },
    sources,
    authored,
    examples: files.examples.map((path) => relative(root, path)),
    failures,
    models,
    ledgers,
    installed,
    installedProblems,
  };
};
