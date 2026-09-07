import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { Contribution } from '../../domain/schema/plugin/contribution';
import { messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import { exportedSurface } from '../../domain/usecases/plugins/crossExtensionRefs';
import { buildPlugin } from './compile';
import { exampleNote } from './exampleNotes';
import { describeWith } from './messages';
import { readWorkspaceCatalog } from './workspaceCatalog';
import { EXAMPLES_DIR, findPluginFiles, isExamplePlugin } from './workspacePlugins';

/**
 * O QUE UMA EXTENSÃO É CAPAZ DE FAZER, respondido a partir do pacote COMPILADO.
 *
 * A pergunta chegava sem resposta: um agente que quisesse saber como se faz uma view de código, ou qual
 * extensão declara ponto de extensão próprio, tinha de abrir seis `plugin.ts` de quinhentas linhas e
 * inferir. O que ele obtinha eram id, versão e problemas — nunca o que a extensão traz.
 *
 * Nada aqui é prosa nova, e é isso que faz a resposta valer: o manifest já diz os pontos tocados, a
 * superfície exportada e o que a extensão exige do projeto Firebase; o pacote já diz as telas, as
 * listas, os scripts, as views e as migrações; e `description`, `summary` e `overview` já são a nossa
 * descrição curada — a mesma que a tela de Extensões do escritório mostra, resolvida aqui para o
 * idioma-fonte com o catálogo que o próprio pacote carrega. Uma segunda descrição escrita à mão ao
 * lado desta ficaria desatualizada na primeira contribuição alterada, e sem reprovar em nada.
 *
 * A ÚNICA frase que não sai do pacote é a da autoria — qual mecanismo aquele exemplo é o melhor para
 * ler —, e ela mora em `exampleNotes.ts`, com o porquê.
 *
 * Duas escolhas de desenho, e as duas vêm do custo de contexto:
 *
 * - **`detail` existe.** O `dashboard` inteiro, projetado campo a campo, passa de duzentas linhas de
 *   JSON — o que o transformaria no `.json` de 90 KB que os exemplos existem para não ser. O padrão
 *   conta e nomeia; `full` abre os campos de cada tela.
 * - **Compila UM pacote, não o diretório.** Casar por id exigiria compilar todos, então o caminho e o
 *   nome da pasta são tentados primeiro, e a varredura por id é o último recurso.
 */

export type ExtensionOrigin = 'authored' | 'example';

export interface DescribeExtensionOptions {
  detail?: 'summary' | 'full';
}

const asText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * O texto de dentro de um nó de Widget DSL, achatado em linhas.
 *
 * A caminhada é DEFENSIVA de propósito: `overview` é `unknown` no tipo do pacote porque o renderizador
 * vive na camada de apresentação e ignora nó desconhecido em vez de derrubar a tela. Uma projeção que
 * exigisse conhecer cada tipo de nó passaria a reprovar por um nó novo que a tela renderiza sem
 * reclamar — então ela colhe as chaves que carregam texto, em qualquer profundidade, e ignora o resto.
 */
const TEXT_KEYS = ['content', 'label', 'value', 'message', 'text', 'title', 'heading'];

const flattenWidget = (node: unknown, resolveText: (value: string) => string, into: string[]): void => {
  if (Array.isArray(node)) {
    for (const one of node) flattenWidget(one, resolveText, into);
    return;
  }
  if (typeof node !== 'object' || node === null) return;

  const record = node as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of TEXT_KEYS) {
    const text = asText(record[key]);
    if (text !== null) parts.push(resolveText(text));
  }
  if (parts.length > 0) into.push(parts.join(' — '));

  for (const [key, value] of Object.entries(record)) {
    if (TEXT_KEYS.includes(key)) continue;
    flattenWidget(value, resolveText, into);
  }
};

/** As contribuições agrupadas pelo PONTO, que é a pergunta que se faz delas: o que ela pluga onde. */
const contributionsByPoint = (
  contributions: readonly Contribution[],
): { point: string; ids: string[]; impl: string[] }[] => {
  const grouped = new Map<string, { ids: string[]; impl: Set<string> }>();
  for (const one of contributions) {
    const found = grouped.get(one.point) ?? { ids: [], impl: new Set<string>() };
    found.ids.push(one.id);
    const kind = (one.impl as { kind?: unknown } | undefined)?.kind;
    if (typeof kind === 'string') found.impl.add(kind);
    grouped.set(one.point, found);
  }
  return [...grouped.entries()]
    .map(([point, found]) => ({ point, ids: found.ids.sort(), impl: [...found.impl].sort() }))
    .sort((a, b) => (a.point < b.point ? -1 : 1));
};

const screenOf = (
  screen: NonNullable<MarketplacePlugin['screens']>[number],
  resolveText: (value: string) => string,
  full: boolean,
): Record<string, unknown> => ({
  key: screen.key,
  collection: screen.dataCollection ?? screen.key,
  title: resolveText(screen.titleSingular),
  titleField: screen.titleFieldKey,
  ...(screen.parentEntity === undefined ? {} : { parentEntity: screen.parentEntity, parentField: screen.parentFieldKey }),
  ...(screen.sourceId === undefined ? {} : { sourceId: screen.sourceId }),
  ...(full
    ? {
      fields: screen.fields.map((field) => ({
        key: field.key,
        label: resolveText(field.label),
        type: field.type,
        ...(field.required ? { required: true } : {}),
      })),
    }
    : { fields: screen.fields.length }),
});

/** Os arquivos que valem abrir, e nada além deles: a fonte do pacote e a de cada view. */
const readThis = (entry: string, pkg: MarketplacePlugin, root: string): string[] => {
  const directory = dirname(entry);
  const views = join(directory, 'views');
  const sources = existsSync(views)
    ? readdirSync(views).filter((name) => name.endsWith('.tsx') || name.endsWith('.ts'))
      .map((name) => relative(root, join(views, name)))
    : [];
  return [
    relative(root, entry),
    ...sources,
    ...(pkg.startup === undefined || sources.length > 0 ? [] : ['startup code inlined in the package']),
  ];
};

const projectPackage = (
  entry: string,
  root: string,
  origin: ExtensionOrigin,
  detail: 'summary' | 'full',
): Record<string, unknown> => {
  const result = buildPlugin({ entry });
  const pkg = result.package;
  const { manifest } = pkg;
  const resolveText = describeWith(messageBundlesOf(manifest.contributes ?? []));
  const full = detail === 'full';

  const overview: string[] = [];
  flattenWidget(pkg.overview, resolveText, overview);

  const folder = basename(dirname(entry));
  const note = origin === 'example' ? exampleNote(folder) : null;

  return {
    extension: {
      id: manifest.id,
      version: manifest.version,
      name: resolveText(manifest.name),
      kernel: manifest.kernel,
      ...(manifest.category === undefined ? {} : { category: resolveText(manifest.category) }),
      ...(manifest.description === undefined ? {} : { description: resolveText(manifest.description) }),
      ...(manifest.homepage === undefined ? {} : { homepage: manifest.homepage }),
    },
    source: {
      origin,
      ...(origin === 'example'
        ? {
          isReadingMaterial:
            `It travels in ${EXAMPLES_DIR}/ as source to read. Nobody in this organization wrote it and nothing `
            + 'here installs it: whether this organization runs it is the installation snapshot\'s to say. The '
            + 'whole directory is rewritten whenever this installation takes a new platform version, so do not '
            + 'edit it — copy what you need into your own package.',
          ...(note === null ? {} : { whyReadThisOne: note }),
        }
        : {}),
      readThis: readThis(entry, pkg, root),
    },
    whatItDoes: {
      summary: resolveText(pkg.summary),
      ...(overview.length === 0 ? {} : { overview }),
    },
    capability: {
      contributesTo: contributionsByPoint(manifest.contributes ?? []),
      declaresExtensionPoints: (manifest.extensionPoints ?? []).map((one) => one.id),
      ...(manifest.provides === undefined ? {} : { provides: manifest.provides }),
      ...(manifest.consumes === undefined ? {} : { consumes: manifest.consumes }),
      ...(manifest.permissions === undefined ? {} : { declaresPermissions: manifest.permissions }),
    },
    brings: {
      screens: (pkg.screens ?? []).map((screen) => screenOf(screen, resolveText, full)),
      ...(pkg.screenPatches === undefined ? {} : {
        screenPatches: pkg.screenPatches.map((patch) => ({ target: patch.target, fields: patch.fields.length })),
      }),
      lookups: (pkg.lookups ?? []).map((one) => one.collection),
      tagLists: (pkg.tagLists ?? []).map((one) => one.collection),
      workflows: pkg.workflows.map((one) => ({ templateId: one.templateId, name: resolveText(one.name), event: one.eventName })),
      actions: (pkg.actions ?? []).map((one) => ({ templateId: one.templateId, title: resolveText(one.title) })),
      scripts: (pkg.scripts ?? []).map((one) => ({ templateId: one.templateId, name: resolveText(one.name) })),
      reports: (pkg.reports ?? []).map((one) => one.templateId),
      codeViews: (pkg.views ?? []).map((one) => one.key),
      hasStartupCode: pkg.startup !== undefined,
      migrations: (pkg.migrations ?? []).map((one) => one.id),
    },
    surface: {
      /**
       * O nome passa pelo catálogo do pacote: `exportedSurface` é função de domínio e devolve o que
       * está no artefato, que pode ser uma REFERÊNCIA de mensagem. Sem isto a resposta imprime
       * `@com.example.billing/flow.closing` para quem pediu o nome do fluxo.
       */
      exports: exportedSurface(pkg).map((one) => ({ ...one, name: resolveText(one.name) })),
      ...(manifest.exports === undefined
        ? { note: 'No `manifest.exports`: every artifact of it is PRIVATE, and no other extension may reference one.' }
        : {}),
      ...(manifest.dependencies === undefined ? {} : { dependencies: manifest.dependencies }),
    },
    requiresOfTheProject: manifest.backend ?? null,
    wouldInstall: result.issues.length === 0
      ? 'Yes — this package passes the same gate the platform runs on install.'
      : `No — ${result.issues.length} problem(s). Run validate_plugin on it for the list.`,
  };
};

const candidatePaths = (root: string, query: string): string[] => {
  const trimmed = query.trim();
  const asPath = isAbsolute(trimmed) ? trimmed : resolve(root, trimmed);
  return [
    asPath.endsWith('.ts') ? asPath : join(asPath, 'plugin.ts'),
    join(root, trimmed, 'plugin.ts'),
    join(root, EXAMPLES_DIR, trimmed, 'plugin.ts'),
  ];
};

/**
 * O retrato só sabe id, nome, versão, se está ligada e o que ela exporta — é ESQUEMA, nunca conteúdo.
 * Responder isso é melhor que não responder, desde que a resposta diga o que ela NÃO alcança: sem o
 * pacote em mãos não há como descrever capacidade nenhuma, e apresentar o silêncio como ausência foi o
 * defeito que este arquivo inteiro persegue.
 */
const fromSnapshot = (root: string, query: string): Record<string, unknown> | null => {
  const read = readWorkspaceCatalog(root);
  const installed = read.installed;
  if (installed === null) return null;

  const found = installed.extensions.find((one) => one.id === query.trim());
  if (found === undefined) return null;

  return {
    extension: { id: found.id, version: found.version, name: found.name },
    source: {
      origin: 'installation',
      snapshot: { file: installed.path, office: installed.tenantName, takenAt: installed.exportedAt, ageDays: installed.ageDays },
      readThis: [],
    },
    active: found.active,
    surface: { exports: found.exports ?? null },
    limits:
      'This is what the installation SNAPSHOT records, and the snapshot is schema only: it carries no '
      + 'contributions, no screens and no code, so what this extension is capable of cannot be described from '
      + 'here. Its package is not in this directory. If it is a first-party extension, the same source travels '
      + `in ${EXAMPLES_DIR}/ — describe it by folder name instead.`,
  };
};

export interface DescribeExtensionResult {
  found: boolean;
  answer: Record<string, unknown> | string;
}

/**
 * A porta: um nome de pasta, um id ou um caminho de `plugin.ts`. A ordem das tentativas é de custo
 * crescente, e a varredura por id — a única que compila mais de um pacote — é a última.
 */
export const describeExtension = (
  root: string,
  query: string,
  options: DescribeExtensionOptions = {},
): DescribeExtensionResult => {
  const detail = options.detail === 'full' ? 'full' : 'summary';
  const originOf = (entry: string): ExtensionOrigin => (isExamplePlugin(root, entry) ? 'example' : 'authored');

  for (const candidate of candidatePaths(root, query)) {
    if (existsSync(candidate)) {
      return { found: true, answer: projectPackage(candidate, root, originOf(candidate), detail) };
    }
  }

  const files = findPluginFiles(root);
  for (const entry of [...files.authored, ...files.examples]) {
    try {
      if (buildPlugin({ entry }).package.manifest.id !== query.trim()) continue;
      return { found: true, answer: projectPackage(entry, root, originOf(entry), detail) };
    } catch {
      continue;
    }
  }

  const snapshot = fromSnapshot(root, query);
  if (snapshot !== null) return { found: true, answer: snapshot };

  const known = [...files.authored, ...files.examples].map((entry) => relative(root, dirname(entry)));
  return {
    found: false,
    answer: known.length === 0
      ? `Nothing here to describe: no plugin.ts in this directory, and no ${EXAMPLES_DIR}/ either.`
      : `No extension "${query}" here. Pass a folder name, an id, or a path to a plugin.ts. Present: ${known.join(', ')}.`,
  };
};

/**
 * A LISTA dos exemplos, que é a pergunta anterior a `describe_extension`: qual deles eu abro.
 *
 * Sem ela o agente escolhia o exemplo pelo nome da pasta. É deliberadamente barata — não compila nada,
 * lê o nome da pasta e a nota — porque quem a chama ainda não sabe o que procura, e a resposta cara é
 * a seguinte, sobre um exemplo só.
 */
export const listExamples = (root: string): Record<string, unknown> => {
  const { examples } = findPluginFiles(root);

  return {
    total: examples.length,
    ...(examples.length === 0
      ? {
        note:
          `This installation carries no ${EXAMPLES_DIR}/. They are copied in whenever a platform version is `
          + 'unpacked, so either this workspace was never synced or the installed package predates them.',
      }
      : {
        whatTheseAre:
          'The first-party extensions of this platform, in SOURCE form, one folder each — the same source that '
          + 'produces the artifact the platform installs. They are here to be READ: nobody in this organization '
          + 'wrote them, nothing here installs them, and the whole directory is rewritten whenever this '
          + 'installation takes a new platform version. Copy from them; do not edit them.',
        examples: examples.map((entry) => {
          const folder = basename(dirname(entry));
          const note = exampleNote(folder);
          return {
            folder,
            path: relative(root, entry),
            ...(note === null
              ? { whyReadThisOne: null, note: 'No note recorded for this one — read the source.' }
              : { whyReadThisOne: note }),
          };
        }),
        next: 'describe_extension with the folder name says what one of them declares, brings and requires.',
      }),
  };
};
