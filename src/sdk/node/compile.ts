import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { transform } from 'sucrase';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { serializePackage } from '../../domain/usecases/plugins/packageSerialization';
import type { AuthoredPlugin, AuthoredView } from '../authoring';
import type { SourcePart } from '../mergeSources';
import { mergeSources, rawPart } from '../mergeSources';
import type { SdkIssue } from '../validate';
import { validatePluginPackage } from '../validate';
import { attachBackendSource } from './backendSource';

/**
 * O compilador de extensão: um módulo TypeScript entra, o `.json` que a plataforma instala sai.
 *
 * O `.json` é o artefato, nunca a fonte — é essa distinção que dá ao autor tipos, autocomplete e
 * teste unitário, e que permite pedir a uma IA que escreva uma extensão inteira e conferir o resultado
 * antes de instalar nada. Ajuste fino direto no `.json` continua valendo: ele é o resultado final.
 *
 * Transpila com `sucrase`, o MESMO transpilador que o runtime do browser usa para avaliar a fonte de
 * uma view. Não há bundler no caminho, e é de propósito: um pacote declarativo não precisa de um, e
 * uma dependência de build a menos é uma coisa a menos para divergir entre a máquina do autor e a
 * nossa.
 */

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

/** O caminho exato, depois com extensão, depois como diretório com `index` — a ordem do Node. */
const resolveFile = (candidate: string): string | null => {
  if (isFile(candidate)) return candidate;
  for (const extension of EXTENSIONS) {
    if (isFile(`${candidate}${extension}`)) return `${candidate}${extension}`;
  }
  for (const extension of EXTENSIONS) {
    const asIndex = join(candidate, `index${extension}`);
    if (isFile(asIndex)) return asIndex;
  }
  return null;
};

/**
 * Carrega um módulo TS/TSX e devolve seus exports.
 *
 * Só resolve caminho RELATIVO por arquivo; qualquer outro especificador vai para o `require` do Node,
 * que é o que permite a um plugin importar uma biblioteca de verdade do `node_modules` dele. O cache
 * por caminho absoluto é o que faz um módulo importado por dois arquivos ser avaliado uma vez — sem
 * ele, um grafo em diamante avaliaria o mesmo arquivo duas vezes e duas cópias de uma constante
 * deixariam de ser iguais por identidade.
 */
export const loadModule = (
  entry: string,
  cache: Map<string, Record<string, unknown>> = new Map(),
): Record<string, unknown> => {
  const absolute = isAbsolute(entry) ? entry : resolve(entry);
  const cached = cache.get(absolute);
  if (cached) return cached;

  const { code } = transform(readFileSync(absolute, 'utf8'), {
    transforms: ['typescript', 'jsx', 'imports'],
    jsxRuntime: 'automatic',
    production: true,
    filePath: absolute,
  });

  const moduleObject: { exports: Record<string, unknown> } = { exports: {} };
  cache.set(absolute, moduleObject.exports);

  // Resolve a partir do ARQUIVO do plugin, não daqui: `@microteia/sdk` e as bibliotecas que o autor
  // instalou estão no `node_modules` DELE, e o `require` deste módulo procuraria no nosso.
  const requireHere = createRequire(absolute);

  const requireFrom = (specifier: string): unknown => {
    // `./x.tsx?raw` devolve o TEXTO do arquivo, não o módulo. É a convenção do Vite, e existe aqui pelo
    // mesmo motivo que lá: a fonte de uma view é dado (viaja no `.json`), mas precisa morar num arquivo
    // de verdade para o `tsc` e o editor a enxergarem. Sem isso, o único jeito de o pacote carregar a
    // própria view seria um template literal — que não passa por checagem nenhuma.
    if (specifier.endsWith('?raw')) {
      const target = resolveFile(resolve(dirname(absolute), specifier.slice(0, -4)));
      if (target === null) throw new Error(`Cannot resolve "${specifier}" from ${absolute}.`);
      // `__esModule` não é detalhe: sem ele o `_interopRequireDefault` do sucrase envolve o objeto
      // outra vez, e `source` chega como `{ default: '...' }` em vez da string.
      return { __esModule: true, default: readFileSync(target, 'utf8') };
    }
    if (!specifier.startsWith('.')) return requireHere(specifier);
    const target = resolveFile(resolve(dirname(absolute), specifier));
    if (target === null) {
      throw new Error(`Cannot resolve "${specifier}" from ${absolute}.`);
    }
    return loadModule(target, cache);
  };

  const factory = new Function('require', 'module', 'exports', '__filename', '__dirname', code) as (
    requireFn: (specifier: string) => unknown,
    module: { exports: Record<string, unknown> },
    exports: Record<string, unknown>,
    filename: string,
    directory: string,
  ) => void;

  factory(requireFrom, moduleObject, moduleObject.exports, absolute, dirname(absolute));
  cache.set(absolute, moduleObject.exports);
  return moduleObject.exports;
};

/** Uma parte vinda de ARQUIVO. O caminho é o que permite conferir um import relativo pelo destino. */
const readSource = (baseDir: string, file: string, what: string): SourcePart => {
  const target = resolveFile(resolve(baseDir, file));
  if (target === null) throw new Error(`${what}: cannot find "${file}" (resolved from ${baseDir}).`);
  return { declared: file, absolute: target, text: readFileSync(target, 'utf8') };
};

/**
 * Dois arquivos válidos podem formar um módulo inválido — é o único defeito que a fusão INVENTA, e
 * por isso é o único que ela precisa conferir. Compila o que vai para o pacote, sem executar nada.
 */
const assertCompiles = (source: string, what: string): void => {
  try {
    const { code } = transform(source, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'automatic',
      production: true,
    });
    new Function('require', 'module', 'exports', code);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${what}: the merged source does not compile — ${detail}`, { cause: error });
  }
};

/** Resolve o import relativo de uma parte que veio de arquivo — o gancho que só o compilador tem. */
const resolveRelative = (part: SourcePart, specifier: string): string | null => (
  part.absolute === null ? null : resolveFile(resolve(dirname(part.absolute), specifier))
);

const merge = (parts: SourcePart[], what: string): string =>
  mergeSources(parts, what, { resolveRelative, assertCompiles });

/**
 * A fonte na forma que o pacote carrega, vinda de CAMINHO. Um caminho só é colado VERBATIM, como sempre
 * foi; uma lista passa pela fusão, que é onde os imports entre os arquivos deixam de existir.
 */
const authoredSource = (baseDir: string, file: string | string[], what: string): string => {
  if (typeof file === 'string') return readSource(baseDir, file, what).text;
  if (file.length === 0) throw new Error(`${what}: the file list is empty.`);
  return merge(file.map((one) => readSource(baseDir, one, what)), what);
};

/**
 * O mesmo, vindo de TEXTO — o caminho `?raw`, que é como os plugins deste repositório declaram fonte.
 * Uma string só passa intacta; uma lista funde pelas mesmas regras, porque o problema é o mesmo: o
 * pacote carrega um módulo por view, e quem escreve não deveria ter de caber num arquivo por isso.
 */
const inlineSource = (source: string | string[], what: string): string => {
  if (typeof source === 'string') return source;
  if (source.length === 0) throw new Error(`${what}: the source list is empty.`);
  return merge(source.map(rawPart), what);
};

/** As quatro portas de uma view, na ordem em que se excluem. */
const viewSource = (view: AuthoredView, baseDir: string): string => {
  const what = `View "${view.key}"`;
  if (view.sourceFile !== undefined && view.source !== undefined) {
    throw new Error(`${what} declares both "source" and "sourceFile" — keep one.`);
  }
  if (view.sourceFile !== undefined) return authoredSource(baseDir, view.sourceFile, what);
  if (view.source !== undefined) return inlineSource(view.source, what);
  throw new Error(`${what} has neither "source" nor "sourceFile".`);
};

/**
 * Resolve `sourceFile`/`startupFile` para o conteúdo, deixando o pacote na forma que a plataforma
 * instala. Declarar os dois para o mesmo artefato é erro, não precedência: um pacote em que a fonte
 * inline e o arquivo divergem instala uma das duas e o autor nunca sabe qual.
 */
export const inlineAuthoredCode = (plugin: AuthoredPlugin, baseDir: string): MarketplacePlugin => {
  const views = plugin.views?.map((view) => ({
    key: view.key,
    title: view.title,
    icon: view.icon,
    source: viewSource(view, baseDir),
  }));

  if (plugin.startupFile !== undefined && plugin.startup !== undefined) {
    throw new Error('The package declares both "startup" and "startupFile" — keep one.');
  }
  const startup = plugin.startupFile !== undefined
    ? authoredSource(baseDir, plugin.startupFile, 'Startup')
    : plugin.startup !== undefined ? inlineSource(plugin.startup, 'Startup') : undefined;

  const rest: Record<string, unknown> = { ...plugin };
  delete rest.startupFile;

  return {
    ...rest,
    ...(views ? { views } : {}),
    ...(startup !== undefined ? { startup } : {}),
  } as MarketplacePlugin;
};

export interface BuildPluginInput {
  /** Módulo de entrada — o `plugin.ts` que exporta o pacote. */
  entry: string;
  /**
   * Qual export ler. Sem isso, o compilador procura o `default` e, na falta dele, o único export que
   * tenha a forma de um pacote — o que faz o caso comum (um arquivo, um plugin) não pedir configuração.
   */
  exportName?: string;
}

export interface BuildPluginResult {
  package: MarketplacePlugin;
  json: string;
  issues: SdkIssue[];
  exportName: string;
}

const looksLikePackage = (value: unknown): boolean =>
  typeof value === 'object'
  && value !== null
  && typeof (value as { manifest?: { id?: unknown } }).manifest?.id === 'string';

const pickExport = (
  exports: Record<string, unknown>,
  requested: string | undefined,
  entry: string,
): [string, AuthoredPlugin] => {
  if (requested !== undefined) {
    const chosen = exports[requested];
    if (!looksLikePackage(chosen)) {
      throw new Error(`${entry} does not export a package named "${requested}".`);
    }
    return [requested, chosen as AuthoredPlugin];
  }

  if (looksLikePackage(exports.default)) return ['default', exports.default as AuthoredPlugin];

  const candidates = Object.entries(exports).filter(([, value]) => looksLikePackage(value));
  if (candidates.length === 1) return candidates[0] as [string, AuthoredPlugin];
  if (candidates.length === 0) {
    throw new Error(`${entry} exports no extension package. Export it as \`default\`.`);
  }
  throw new Error(
    `${entry} exports ${candidates.length} packages (${candidates.map(([name]) => name).join(', ')}).`
    + ' Pass --export <name> to choose one.',
  );
};

/**
 * Compila e VALIDA — nunca só compila. A validação é a mesma porta que a importação usa
 * (`validatePluginPackage`), e é isso que faz o `check` do autor recusar exatamente o que a instalação
 * recusaria, em vez de descobrir o problema no escritório do cliente.
 *
 * As pendências voltam em `issues` em vez de virarem exceção: quem chama decide se reprova (o `check`)
 * ou se grava avisando (`build --force`, para inspecionar o `.json` de um pacote que ainda não fecha).
 */
export const buildPlugin = (input: BuildPluginInput): BuildPluginResult => {
  const entry = isAbsolute(input.entry) ? input.entry : resolve(input.entry);
  const [exportName, authored] = pickExport(loadModule(entry), input.exportName, entry);
  // A fonte das Cloud Functions vem de `functions/` ao lado do `plugin.ts`: é onde o autor já as escreve
  // para o Console da instalação dele, e é o que faz a extensão funcionar numa instalação que não tem
  // essa pasta. Ver `PackagedBackendSource`.
  const pkg = attachBackendSource(inlineAuthoredCode(authored, dirname(entry)), dirname(entry));
  return { package: pkg, json: `${serializePackage(pkg)}\n`, issues: validatePluginPackage(pkg), exportName };
};

/**
 * O transpilador de SCRIPT, reexportado aqui — e não no barril isomórfico — porque ele é FERRAMENTA:
 * arrasta o `sucrase`, e `@microteia/sdk` é a superfície que não arrasta nada além de `expr-eval`.
 * É a mesma linha que separa `compile.ts` do resto do SDK.
 *
 * Existe porque um `Script` viaja com `sourceTs` E `compiledJs`, e nada preenche o segundo: o sandbox
 * do servidor nunca transpila, de propósito. Sem esta porta, `scripts` era um campo do pacote que quem
 * escreve de fora não tinha como preencher direito — a saída era colar JavaScript nos dois campos, ou
 * arriscar um transpilador que não é o da plataforma.
 */
export type { TranspileScriptResult } from '../../domain/services/scriptSource';
export { transpileScriptSource } from '../../domain/services/scriptSource';
