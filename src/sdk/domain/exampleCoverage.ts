import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { PluginManifest } from '../../domain/schema/plugin/pluginManifest';
import { KERNEL_EXTENSION_POINTS } from '../../domain/schema/extensionPoints';

/**
 * QUE MECANISMO DESTA PLATAFORMA NENHUM EXEMPLO ENSINA.
 *
 * É o irmão de `coverage.ts`, com a mesma forma e outra pergunta. Aquele responde "o vocabulário do
 * modelo alcança este mecanismo?"; este responde "existe fonte para LER sobre ele?".
 *
 * Ele nasce do mesmo defeito, que já custou caro três vezes neste repositório: **um mecanismo sem
 * vocabulário é invisível até alguém tropeçar nele**, e a resposta não é atenção — é uma lista
 * derivada, com teste. Antes disso, seis exemplos cobriam seis dos vinte e dois pontos de extensão, e
 * nada em lugar nenhum dizia quais dezesseis faltavam: quem procurasse como entregar um relatório, uma
 * Cloud Function ou uma permissão concluía que não dava.
 *
 * Duas coisas o mantêm honesto, e as duas são mecânicas:
 *
 * - **Os `Record<keyof …>` fecham por tipo.** Uma chave nova em `MarketplacePlugin` ou em
 *   `PluginManifest` NÃO COMPILA até ganhar uma linha aqui — dizendo qual exemplo a ensina, ou dizendo
 *   que nenhum ensina. É a mesma disciplina de `PACKAGE_REACH` em `coverage.ts`.
 * - **A lista de pontos é PERCORRIDA, não copiada.** Um ponto acrescentado amanhã aparece como lacuna
 *   no mesmo dia, sem que ninguém precise lembrar deste arquivo.
 *
 * E o que ele NÃO faz: escrever exemplo nenhum. A lista É a entrega. Fechar uma lacuna é decidir o que
 * vale a pena ensinar, e essa decisão não se toma dentro do relatório que a revelou.
 *
 * É PURO, e recebe os pacotes por parâmetro: `src/sdk/` só pode depender de `domain/`, e alcançar
 * `plugins/marketplace` daqui reprovaria em `sdkPurity.test.ts`. Quem tem os exemplos em mãos os passa.
 */

export const EXAMPLE_COVERAGE_SURFACES = [
  'extension-point',
  'package-artifact',
  'manifest-property',
] as const;
export type ExampleCoverageSurface = (typeof EXAMPLE_COVERAGE_SURFACES)[number];

export interface ExampleCoverageItem {
  surface: ExampleCoverageSurface;
  /** O identificador do mecanismo, como o kernel o chama. */
  id: string;
  /** Os exemplos que o exercem, na ordem em que foram dados. Vazio é LACUNA. */
  taughtBy: string[];
  /**
   * Por que a lacuna existe, quando existe. `unreachable` é a lacuna que NÃO se fecha escrevendo um
   * exemplo: o mecanismo não está ao alcance de quem escreve extensão, e dizer isso é a informação —
   * um autor que procura `data.service` merece saber que o caminho dele é `startup`, não que ninguém
   * se lembrou de escrever o exemplo.
   */
  gap: 'none' | 'missing' | 'unreachable';
  note: string;
}

/**
 * Os pontos que um pacote de terceiro NÃO tem como preencher, e o que ele usa no lugar.
 *
 * Todos exigem `impl: { kind: 'code', key }`, e essa chave se resolve no registro de implementações do
 * BUNDLE — que só plugin de primeira parte popula. Uma extensão que entrega FONTE tem outro caminho
 * para a mesma coisa, e é ele que o exemplo ensina.
 */
const UNREACHABLE_POINTS: Record<string, string> = {
  'ui.command': 'needs `impl: code`, resolved in the bundle registry. An extension that ships source registers a '
    + 'palette provider from `startup` instead — see `command-example`',
  'ui.record.action': 'needs `impl: code`. A gesture on a record travels as an `ActionModuleTemplate` instead — see '
    + '`automation-example`',
  'data.entity': 'exposes an entity the KERNEL already has. An extension declares a screen instead, and the platform '
    + 'derives the collection and its four permissions',
  'data.lookup': 'exposes an option list the KERNEL already has. An extension declares `lookups` instead',
  'data.service': 'needs `impl: code`, resolved in the bundle registry. An extension registers what it offers from '
    + '`startup` instead — see `command-example`',
  'report.definition': 'declared and consulted by NOTHING at runtime. A report reaches an office through '
    + '`package.reports`, which the installation materialises — that is the live path, and `report-example` takes it',
};

const pointItems = (examples: MarketplacePlugin[]): ExampleCoverageItem[] => {
  const used = new Map<string, string[]>();
  for (const example of examples) {
    for (const contribution of example.manifest.contributes ?? []) {
      const list = used.get(contribution.point) ?? [];
      if (!list.includes(example.manifest.id)) list.push(example.manifest.id);
      used.set(contribution.point, list);
    }
  }

  return KERNEL_EXTENSION_POINTS.map((point) => {
    const taughtBy = used.get(point.id) ?? [];
    const unreachable = UNREACHABLE_POINTS[point.id];
    if (taughtBy.length > 0) {
      return { surface: 'extension-point' as const, id: point.id, taughtBy, gap: 'none' as const, note: point.description ?? point.title };
    }
    return {
      surface: 'extension-point' as const,
      id: point.id,
      taughtBy,
      gap: unreachable ? ('unreachable' as const) : ('missing' as const),
      note: unreachable
        ? `OUT OF REACH: it ${unreachable}.`
        : 'NO EXAMPLE: nothing an author can read shows this point being filled.',
    };
  });
};

/**
 * Cada chave do PACOTE, e o que ela traz. `null` é a chave que nenhum exemplo pode exercer sozinha;
 * o `Record<keyof …>` é o que impede uma chave nova de entrar sem esta linha.
 */
const PACKAGE_NOTES: Record<keyof MarketplacePlugin, string> = {
  manifest: 'the identity and everything declared about the package',
  summary: 'the one line the office reads before installing',
  workflows: 'the automations the package installs',
  screens: 'the entities it brings, with their fields and keys',
  screenPatches: 'fields it adds to a screen ANOTHER extension owns',
  lookups: 'the option lists it seeds',
  tagLists: 'the tag lists it seeds',
  actions: 'the gestures offered on a record',
  scripts: 'code that runs in the server sandbox',
  reports: 'the declarative reports it installs',
  views: 'screens written in code, travelling as source',
  startup: 'the function that runs at load time and registers what a declaration cannot express',
  migrations: 'code that converts data an earlier version of the package wrote',
  overview: 'the rich description shown before installing',
};

const PACKAGE_GAP_NOTES: Partial<Record<keyof MarketplacePlugin, string>> = {
  overview: 'a reading-only example carries `summary` and nothing more, on purpose: an `overview` is what the office '
    + 'reads in the Extensions screen, and these are not installed from there',
};

const has = (example: MarketplacePlugin, key: keyof MarketplacePlugin): boolean => {
  const value = example[key];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

const packageItems = (examples: MarketplacePlugin[]): ExampleCoverageItem[] =>
  (Object.keys(PACKAGE_NOTES) as (keyof MarketplacePlugin)[]).map((key) => {
    const taughtBy = examples.filter((one) => has(one, key)).map((one) => one.manifest.id);
    return {
      surface: 'package-artifact' as const,
      id: key,
      taughtBy,
      gap: taughtBy.length > 0 ? ('none' as const) : ('missing' as const),
      note: taughtBy.length > 0
        ? PACKAGE_NOTES[key]
        : `NO EXAMPLE: ${PACKAGE_GAP_NOTES[key] ?? `nothing shows ${PACKAGE_NOTES[key]}.`}`,
    };
  });

const MANIFEST_NOTES: Record<keyof PluginManifest, string> = {
  id: 'the permanent reverse-DNS identity',
  version: 'the semver of the package',
  kernel: 'the contract range it needs of the kernel',
  name: 'what the office reads',
  description: 'one paragraph about what it does',
  category: 'how it is grouped in the Marketplace',
  icon: 'a key of the curated screen-icon set',
  homepage: 'where to read more about it',
  publisher: 'who answers for it',
  license: 'the terms it adds to the ones Microteia already asks',
  dependencies: 'the extensions it needs installed, with ranges',
  exports: 'the artifacts another extension may point at. ABSENT IS AN EMPTY SURFACE',
  provides: 'the capabilities it offers',
  consumes: 'the capabilities it asks for',
  permissions: 'the SANDBOX grant — what its code may do, decided on install',
  extensionPoints: 'points of its own, for other extensions to fill',
  contributes: 'everything it registers at the kernel points',
  lifecycle: 'install and upgrade hooks',
  backend: 'what it needs of the Firebase project — functions, indexes, parameters, manual steps',
};

/**
 * O que o manifesto DECLARA e o kernel não executa. Um exemplo que os usasse ensinaria comportamento
 * que não existe — o pior tipo de material de leitura, porque só falha em silêncio.
 */
const DEAD_MANIFEST_KEYS: Record<string, string> = {
  lifecycle: 'declared in the type and never executed: no `onInstall`, `onUpgrade`, `onEnable`, `onDisable` or '
    + '`onUninstall` hook is read anywhere. An example using it would document behaviour that does not happen',
  permissions: 'the SANDBOX grant, and a different axis from the RBAC an office assembles. It is recorded on install '
    + 'and nothing consults it to authorise anything yet, so an example would be teaching a promise',
};

const MANIFEST_GAP_NOTES: Partial<Record<keyof PluginManifest, string>> = {
  homepage: 'nothing an example needs to say — a reading-only package has no page of its own',
};

const manifestItems = (examples: MarketplacePlugin[]): ExampleCoverageItem[] =>
  (Object.keys(MANIFEST_NOTES) as (keyof PluginManifest)[]).map((key) => {
    const taughtBy = examples
      .filter((one) => {
        const value = one.manifest[key];
        if (value === undefined || value === null) return false;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        if (typeof value === 'string') return value.trim() !== '';
        return true;
      })
      .map((one) => one.manifest.id);

    const dead = DEAD_MANIFEST_KEYS[key];
    if (taughtBy.length > 0) {
      return { surface: 'manifest-property' as const, id: key, taughtBy, gap: 'none' as const, note: MANIFEST_NOTES[key] };
    }
    return {
      surface: 'manifest-property' as const,
      id: key,
      taughtBy,
      gap: dead ? ('unreachable' as const) : ('missing' as const),
      note: dead
        ? `OUT OF REACH: it is ${dead}.`
        : `NO EXAMPLE: ${MANIFEST_GAP_NOTES[key] ?? `nothing shows ${MANIFEST_NOTES[key]}.`}`,
    };
  });

/** A superfície inteira, num lugar só, na ordem estável das superfícies declaradas. */
export const exampleCoverage = (examples: MarketplacePlugin[]): ExampleCoverageItem[] => [
  ...pointItems(examples),
  ...packageItems(examples),
  ...manifestItems(examples),
];

/** Só o que NENHUM exemplo ensina e que um exemplo poderia ensinar. */
export const exampleCoverageGaps = (examples: MarketplacePlugin[]): ExampleCoverageItem[] =>
  exampleCoverage(examples).filter((one) => one.gap === 'missing');

export interface ExampleCoverageSummary {
  surface: ExampleCoverageSurface;
  total: number;
  taught: number;
  gaps: number;
  unreachable: number;
}

export const exampleCoverageSummary = (examples: MarketplacePlugin[]): ExampleCoverageSummary[] => {
  const all = exampleCoverage(examples);
  return EXAMPLE_COVERAGE_SURFACES.map((surface) => {
    const items = all.filter((one) => one.surface === surface);
    return {
      surface,
      total: items.length,
      taught: items.filter((one) => one.gap === 'none').length,
      gaps: items.filter((one) => one.gap === 'missing').length,
      unreachable: items.filter((one) => one.gap === 'unreachable').length,
    };
  });
};
