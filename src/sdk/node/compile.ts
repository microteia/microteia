import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { transform } from 'sucrase';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { serializePackage } from '../../domain/usecases/plugins/packageSerialization';
import type { AuthoredPlugin, AuthoredView } from '../authoring';
import type { SdkIssue } from '../validate';
import { validatePluginPackage } from '../validate';

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


/**
 * Uma parte da fonte: o nome que a mensagem de erro cita e o texto.
 *
 * `absolute` é nulo quando a parte veio como TEXTO — o caminho `?raw`, que entrega o conteúdo e não o
 * arquivo. É a única diferença entre as duas formas, e ela muda uma checagem só: sem arquivo, a fusão
 * confere o import relativo pelos NOMES que ele traz, não pelo caminho a que ele aponta.
 */
interface SourcePart {
  declared: string;
  absolute: string | null;
  text: string;
}

const readSource = (baseDir: string, file: string, what: string): SourcePart => {
  const target = resolveFile(resolve(baseDir, file));
  if (target === null) throw new Error(`${what}: cannot find "${file}" (resolved from ${baseDir}).`);
  return { declared: file, absolute: target, text: readFileSync(target, 'utf8') };
};

/** Uma parte que já é texto. Sem arquivo, o índice é o único nome honesto que ela tem. */
const rawPart = (text: string, index: number): SourcePart => ({
  declared: `source[${index}]`,
  absolute: null,
  text,
});

/**
 * Um `import` inteiro — o de nomes, o de efeito colateral (`import './x';`) e o que abre a lista em
 * várias linhas. Ancorado em início e fim de LINHA: é o que impede a busca preguiçosa de varrer o
 * arquivo até um `from` distante.
 */
const IMPORT_STATEMENT = /^[ \t]*import\b(?:[\s\S]*?\bfrom)?[ \t]*(['"])([^'"]+)\1[ \t]*;?[ \t]*$/gm;

/** Declaração de valor no TOPO do arquivo — coluna zero, e sem desestruturação. */
const TOP_LEVEL_BINDING = /^(?:export[ \t]+)?(?:const|let|class)[ \t]+([A-Za-z_$][\w$]*)/gm;

const EXPORTS_DEFAULT = /^[ \t]*export[ \t]+default\b|^[ \t]*export[ \t]*\{[^}]*\bas[ \t]+default\b/m;

const blankOut = (statement: string): string => statement.replace(/[^\n]/g, '');

/**
 * O que um `import` traz para o escopo, como PAR: o nome local e a origem dele.
 *
 * A origem é o que separa repetição de colisão. Dois arquivos que importam `useMemo` de `react`
 * declaram a mesma coisa, e o `sucrase` funde os dois imports num só — não há nada a recusar. Dois
 * arquivos que dão o nome `Card` a coisas diferentes, sim: no módulo fundido só uma sobrevive.
 *
 * O local é o ÚLTIMO identificador do trecho e o importado é o PRIMEIRO, o que resolve `a as b`,
 * `* as ns` e o default de uma vez. Import de tipo fica fora: ele não cria binding em runtime, e um
 * tipo pode legitimamente ter o nome de um valor.
 */
const importedBindings = (statement: string, specifier: string): [string, string][] => {
  const from = statement.lastIndexOf('from');
  if (from < 0) return [];
  const clause = statement.slice(statement.indexOf('import') + 'import'.length, from).replace(/[{}]/g, ' ');
  if (/^\s*type\b/.test(clause)) return [];
  return clause.split(',')
    .map((piece) => piece.trim())
    .filter((piece) => !/^type\b/.test(piece))
    .map((piece) => piece.match(/[A-Za-z_$][\w$]*|\*/g) ?? [])
    .filter((tokens) => tokens.length > 0)
    .map((tokens) => [tokens[tokens.length - 1], `${specifier}#${tokens[0]}`]);
};

/**
 * Cada nome de valor que o arquivo põe no escopo do módulo, apontando para a ORIGEM dele. A origem de
 * uma declaração local carrega o arquivo: duas declarações do mesmo nome nunca são a mesma coisa.
 */
const bindingsOf = (part: SourcePart): Map<string, string> => {
  const bindings = new Map<string, string>();
  for (const [statement, , specifier] of part.text.matchAll(IMPORT_STATEMENT)) {
    if (specifier.startsWith('.')) continue;
    for (const [name, origin] of importedBindings(statement, specifier)) bindings.set(name, origin);
  }
  for (const [, name] of part.text.matchAll(TOP_LEVEL_BINDING)) {
    bindings.set(name, `local@${part.declared}`);
  }
  return bindings;
};

interface Collision {
  name: string;
  first: string;
  second: string;
}

/**
 * O preço de fundir arquivos é um escopo só. Um `const Card` em dois arquivos do mesmo conjunto é
 * erro de módulo, mas cada arquivo passa pelo `tsc` sozinho sem queixa — quem tem de recusar é a
 * fusão, e antes de gravar o pacote, não quando o escritório abrir a tela.
 */
const collisionIn = (parts: SourcePart[]): Collision | null => {
  const owner = new Map<string, { origin: string; declared: string }>();
  for (const part of parts) {
    for (const [name, origin] of bindingsOf(part)) {
      const previous = owner.get(name);
      if (previous !== undefined && previous.origin !== origin) {
        return { name, first: previous.declared, second: part.declared };
      }
      owner.set(name, { origin, declared: part.declared });
    }
  }
  return null;
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

/** Os nomes que o arquivo DECLARA no topo — o que a fusão põe no escopo comum. */
const declaredNames = (part: SourcePart): string[] =>
  [...part.text.matchAll(TOP_LEVEL_BINDING)].map(([, name]) => name);

/**
 * Apaga os imports RELATIVOS, preservando as quebras de linha para que a numeração de cada arquivo
 * sobreviva à fusão. Um import relativo que aponte para fora do conjunto é erro: o runtime não
 * resolve import nenhum, e hoje isso só aparecia ao abrir a tela.
 *
 * Como se sabe que ele aponta para fora depende da forma da parte. Vindo de ARQUIVO, pelo caminho. Vindo
 * de TEXTO (`?raw`), pelos NOMES: se o import traz `useTally` e nenhuma parte do conjunto declara
 * `useTally`, falta um `?raw` na lista — e é esse o esquecimento que o `?raw` convida a cometer.
 */
const dropMergedImports = (
  part: SourcePart,
  merged: Set<string>,
  declared: Set<string>,
  what: string,
): string =>
  part.text.replace(IMPORT_STATEMENT, (statement, _quote: string, specifier: string) => {
    if (!specifier.startsWith('.')) return statement;
    if (part.absolute === null) {
      for (const [name] of importedBindings(statement, specifier)) {
        if (!declared.has(name)) {
          throw new Error(
            `${what}: "${part.declared}" imports "${name}" from "${specifier}", which no merged source`
            + ' declares. The runtime resolves no relative import — merge the source that declares it.',
          );
        }
      }
      return blankOut(statement);
    }
    const target = resolveFile(resolve(dirname(part.absolute), specifier));
    if (target === null || !merged.has(target)) {
      throw new Error(
        `${what}: "${part.declared}" imports "${specifier}", which is not one of the merged files.`
        + ' The runtime resolves no relative import — list the file, or inline what you need.',
      );
    }
    return blankOut(statement);
  });

/**
 * Funde os arquivos de uma fonte composta num módulo só, na ordem declarada.
 *
 * O pacote instalado continua carregando UM texto por view, porque o runtime avalia um módulo por view
 * e o `require` dele só resolve a API curada. A lista é comodidade de AUTORIA: cada arquivo é checado
 * pelo `tsc` como qualquer outro `.tsx`, e a view pode ser escrita em MVVM em vez de caber num arquivo.
 *
 * A marca com o nome do arquivo fica no texto de propósito: é um administrador do escritório que lê
 * essa fonte antes de confiar nela, e uma fusão sem costura visível é uma parede de código.
 */
const mergeSources = (parts: SourcePart[], what: string): string => {
  const absolutes = new Set<string>();
  for (const part of parts) {
    if (part.absolute === null) continue;
    if (absolutes.has(part.absolute)) throw new Error(`${what}: "${part.declared}" is listed twice.`);
    absolutes.add(part.absolute);
  }

  const defaults = parts.filter((part) => EXPORTS_DEFAULT.test(part.text));
  if (defaults.length !== 1) {
    const which = defaults.map((part) => `"${part.declared}"`).join(', ');
    throw new Error(
      defaults.length === 0
        ? `${what}: none of the merged sources has a default export.`
        : `${what}: ${which} each have a default export — the merged module can only have one.`,
    );
  }

  const collision = collisionIn(parts);
  if (collision !== null) {
    throw new Error(
      `${what}: "${collision.name}" is declared in both "${collision.first}" and "${collision.second}".`
      + ' Merged sources share one scope, so every top-level name has to be unique across the list.',
    );
  }

  const declared = new Set(parts.flatMap(declaredNames));
  const bodies = parts.map((part) => dropMergedImports(part, absolutes, declared, what));
  const merged = parts.length === 1
    ? bodies[0]
    : bodies.map((body, index) => `// --- ${parts[index].declared} ---\n${body}`).join('\n');

  assertCompiles(merged, what);
  return merged;
};

/**
 * A fonte na forma que o pacote carrega, vinda de CAMINHO. Um caminho só é colado VERBATIM, como sempre
 * foi; uma lista passa pela fusão, que é onde os imports entre os arquivos deixam de existir.
 */
const authoredSource = (baseDir: string, file: string | string[], what: string): string => {
  if (typeof file === 'string') return readSource(baseDir, file, what).text;
  if (file.length === 0) throw new Error(`${what}: the file list is empty.`);
  return mergeSources(file.map((one) => readSource(baseDir, one, what)), what);
};

/**
 * O mesmo, vindo de TEXTO — o caminho `?raw`, que é como os plugins deste repositório declaram fonte.
 * Uma string só passa intacta; uma lista funde pelas mesmas regras, porque o problema é o mesmo: o
 * pacote carrega um módulo por view, e quem escreve não deveria ter de caber num arquivo por isso.
 */
const inlineSource = (source: string | string[], what: string): string => {
  if (typeof source === 'string') return source;
  if (source.length === 0) throw new Error(`${what}: the source list is empty.`);
  return mergeSources(source.map(rawPart), what);
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
  const pkg = inlineAuthoredCode(authored, dirname(entry));
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
