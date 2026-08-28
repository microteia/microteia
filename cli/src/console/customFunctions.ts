import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { callableFunctionNames, declaredParametersIn } from '../kernel/manifest.js';
import type { BackendParameter } from '../kernel/manifest.js';
import {
  triggerDeclarations,
  ungatedTriggerProblems,
  unscopedDeclarations,
  unscopedTriggerProblems,
} from './functionGate.js';
import type { TriggerDeclaration } from './functionGate.js';

/**
 * As Cloud Functions do ESCRITÓRIO — as que ele escreve, não as do kernel.
 *
 * Elas moravam em `.microteia/install/functions/custom/src/`, e isso tinha o mesmo defeito que a
 * configuração de backend tinha: editar à mão dentro de um diretório que o `unpack` substitui por
 * inteiro. Sobreviviam porque `functions/custom` estava numa lista de exceção — o que funciona até
 * alguém mexer na lista, e não resolve o problema de o lugar certo não ser óbvio.
 *
 * Agora a fonte fica fora, ao lado do `microteia.yaml`, em dois lugares que respondem a duas perguntas
 * diferentes:
 *
 * - `extensions/<plugin>/functions/` — a function é DAQUELA extensão. Fica junto do plugin que a usa,
 *   e quem lê a pasta da extensão vê tudo o que ela é.
 * - `functions/` — a function é COMUM a várias. É o lugar de quem não pertence a uma só.
 *
 * O que vai para dentro de `install/` é uma cópia montada no deploy, com um barril gerado. É por isso
 * que `functions/custom` saiu da lista de preservação do `unpack`: não há mais nada ali para preservar.
 */

/** O nome do diretório, nos dois lugares. */
export const FUNCTIONS_DIR = 'functions';
export const EXTENSIONS_DIR = 'extensions';

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export interface FunctionSource {
  /** Como aparece nas mensagens: `functions` ou `extensions/<plugin>/functions`. */
  label: string;
  /** Diretório dentro de `custom/src/`, e o que o barril importa. */
  slug: string;
  path: string;
  exported: string[];
  /**
   * `functions/` é COMUM a várias extensões, e por isso não tem dono que possa reivindicá-la: ela sobe
   * no `deploy`, sempre. `extensions/<plugin>/functions/` tem dono, e sobe pelo provisionamento — só no
   * escritório que instalou a extensão. A distinção sai do LUGAR do arquivo, e não de uma declaração:
   * duas extensões não podem reivindicar o mesmo nome (`functionClaimProblems`), então uma function
   * comum não teria como ser declarada.
   */
  shared: boolean;
  /** As callables — as únicas que o navegador chama, e por isso as únicas com alcance a conferir. */
  callables: string[];
  /**
   * Os gatilhos de Firestore declarados aqui, com o estado do portão de instalação de cada um. É o que
   * permite recusar um gatilho de extensão que dispararia para todos os escritórios do projeto.
   */
  triggers: TriggerDeclaration[];
  /**
   * As functions cujo evento NÃO carrega escritório — agendada, fila, HTTP, Storage. Para elas o portão
   * não serve (falha fechado), e quem responde é o laço por escritório.
   */
  unscoped: TriggerDeclaration[];
  /** Os `defineString` que ela declara. O `firebase-functions` os valida GLOBALMENTE (ver abaixo). */
  parameters: BackendParameter[];
  /** As dependências npm que ela declara no `package.json` do próprio diretório. */
  dependencies: Record<string, string>;
}

/**
 * Os nomes que um módulo de entrada exporta. Cobre as duas formas que se escreve de fato: o
 * `export const x = onCall(...)` de quem declara no lugar, e o `export { a, b }` de quem reexporta.
 */
export const exportedNames = (source: string): string[] => {
  const names = new Set<string>();

  for (const match of source.matchAll(/export\s+(?:const|let|var|function|async\s+function)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }

  for (const match of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== '' && name !== 'default') names.add(name);
    }
  }

  return [...names].sort();
};

/** Todo `.ts` do diretório, recursivamente — a fonte das declarações que não moram no `index.ts`. */
const sourceFiles = async (path: string): Promise<string[]> => {
  const found: string[] = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const child = join(path, entry.name);
    if (entry.isDirectory()) found.push(...await sourceFiles(child));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) found.push(child);
  }
  return found.sort();
};

/**
 * As dependências npm que o diretório declara. O `package.json` é OPCIONAL: a maioria das functions do
 * escritório só usa o que o pacote já traz, e exigir o arquivo cobraria cerimônia de quem não precisa.
 */
const readDependencies = async (path: string, label: string): Promise<Record<string, string>> => {
  const manifest = join(path, 'package.json');
  if (!await exists(manifest)) return {};

  const parsed = JSON.parse(await readFile(manifest, 'utf8')) as { dependencies?: Record<string, string> };
  if (parsed.dependencies === undefined) return {};
  if (typeof parsed.dependencies !== 'object' || parsed.dependencies === null) {
    throw new Error(`${label}/package.json has a "dependencies" that is not an object.`);
  }
  return parsed.dependencies;
};

const readSource = async (
  path: string,
  label: string,
  slug: string,
  shared: boolean,
): Promise<FunctionSource> => {
  const entry = join(path, 'index.ts');
  if (!await exists(entry)) {
    throw new Error(
      `${label}/ has no index.ts.\n`
      + 'A directory of Cloud Functions is read through its index.ts — export from there what should be'
      + ' deployed.',
    );
  }

  const exported = exportedNames(await readFile(entry, 'utf8'));
  const callables = new Set<string>();
  const triggers: TriggerDeclaration[] = [];
  const unscoped: TriggerDeclaration[] = [];
  const parameters = new Map<string, BackendParameter>();

  for (const file of await sourceFiles(path)) {
    const source = await readFile(file, 'utf8');
    for (const name of callableFunctionNames(source)) callables.add(name);
    // O gatilho é declarado no arquivo dele e reexportado pelo `index.ts` — é o que o molde escreve —,
    // então a varredura é a mesma das callables: todo `.ts`, e o `index.ts` decide o que conta.
    triggers.push(...triggerDeclarations(source));
    unscoped.push(...unscopedDeclarations(source));
    // Um nome declarado em vários lugares é UM parâmetro, e ele é exigido se ALGUMA declaração o pede
    // sem `default`: é essa que recusa o deploy quando o valor falta, e a conservadora é a que avisa.
    for (const parameter of declaredParametersIn(source)) {
      const previous = parameters.get(parameter.name);
      parameters.set(parameter.name, {
        name: parameter.name,
        required: parameter.required || (previous?.required ?? false),
      });
    }
  }

  return {
    label,
    slug,
    path,
    exported,
    shared,
    // Só as que o `index.ts` de fato exporta: uma callable escrita e não exportada não é deployada, e
    // conferir o alcance dela mandaria procurar um erro que não existe.
    callables: exported.filter((name) => callables.has(name)),
    triggers,
    unscoped,
    parameters: [...parameters.values()].sort((a, b) => a.name.localeCompare(b.name)),
    dependencies: await readDependencies(path, label),
  };
};

/** Onde o escritório pode ter escrito function, na ordem em que as mensagens as citam. */
export const findFunctionSources = async (root: string): Promise<FunctionSource[]> => {
  const found: FunctionSource[] = [];

  if (await exists(join(root, FUNCTIONS_DIR))) {
    found.push(await readSource(join(root, FUNCTIONS_DIR), FUNCTIONS_DIR, 'shared', true));
  }

  const extensions = join(root, EXTENSIONS_DIR);
  if (await exists(extensions)) {
    for (const entry of (await readdir(extensions, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = join(extensions, entry.name, FUNCTIONS_DIR);
      if (!await exists(path)) continue;
      found.push(await readSource(path, `${EXTENSIONS_DIR}/${entry.name}/${FUNCTIONS_DIR}`, entry.name, false));
    }
  }

  return found;
};

/**
 * O que o escritório escreveu, na forma em que os comandos precisam dele.
 *
 * `shared` e `owned` respondem a perguntas diferentes, e é por isso que são duas listas: a comum sobe
 * no `deploy`, sempre; a de extensão sobe pelo provisionamento, e só onde a extensão está instalada.
 */
export interface OfficeFunctions {
  sources: FunctionSource[];
  /** Todos os nomes, na ordem em que as origens são lidas. */
  all: string[];
  /** As de `functions/` — sem dono, e por isso deployadas sempre. */
  shared: string[];
  callables: string[];
  parameters: BackendParameter[];
}

export const officeFunctionsOf = (sources: FunctionSource[]): OfficeFunctions => {
  const parameters = new Map<string, BackendParameter>();
  for (const source of sources) {
    for (const parameter of source.parameters) {
      const previous = parameters.get(parameter.name);
      parameters.set(parameter.name, {
        name: parameter.name,
        required: parameter.required || (previous?.required ?? false),
      });
    }
  }

  return {
    sources,
    all: sources.flatMap((source) => source.exported),
    shared: sources.filter((source) => source.shared).flatMap((source) => source.exported),
    callables: sources.flatMap((source) => source.callables),
    parameters: [...parameters.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
};

/**
 * O que o escritório escreveu, lido de onde ele escreve. É a porta única: `deploy`, `provision` e
 * `unpack` precisam da mesma resposta, e três leituras divergiriam no ponto em que ninguém olha.
 */
export const readOfficeFunctions = async (root: string): Promise<OfficeFunctions> =>
  officeFunctionsOf(await findFunctionSources(root));

/**
 * Os problemas que impedem montar o conjunto. São recusa e não aviso, pelo mesmo motivo do `pack`: o
 * `index.js` do pacote espalha o customizado DEPOIS do kernel, então um nome repetido substitui em
 * silêncio — e substituir um gatilho do kernel é o tipo de defeito que só aparece quando algo deixa de
 * acontecer, sem erro em lugar nenhum.
 */
export const functionProblems = (sources: FunctionSource[], kernelFunctions: string[]): string[] => {
  const problems: string[] = [];
  const kernel = new Set(kernelFunctions);
  const seen = new Map<string, string>();

  for (const source of sources) {
    if (source.exported.length === 0) {
      problems.push(`${source.label}/index.ts exports nothing — remove the directory or export a function`);
    }

    for (const name of source.exported) {
      if (kernel.has(name)) {
        problems.push(`${source.label} exports "${name}", which is the name of a Microteia function — rename yours`);
      }
      const previous = seen.get(name);
      if (previous !== undefined) {
        problems.push(`"${name}" is exported by both ${previous} and ${source.label} — names must be unique`);
      } else {
        seen.set(name, source.label);
      }
    }
  }

  // O portão de instalação entra aqui, e não numa verificação à parte, porque o momento é o mesmo: é
  // este o ponto em que a fonte do escritório passa a fazer parte do pacote que vai subir.
  problems.push(...ungatedTriggerProblems(sources));
  problems.push(...unscopedTriggerProblems(sources));

  return problems;
};

const barrel = (sources: FunctionSource[]): string => `// Generated by "microteia deploy". Do not edit.
//
// The Cloud Functions this installation adds, gathered from where they are written:
${sources.map((source) => `//   ${source.label}/`).join('\n')}
//
// Write them there, not here — this directory is rebuilt on every deploy.

${sources.map((source) => `export * from './${source.slug}';`).join('\n')}
`;

/**
 * O que de um diretório de functions vai para dentro do pacote — e o que NÃO vai.
 *
 * Teste fica fora, e não por economia de bytes: o `predeploy` do pacote compila `custom/` com o `tsc`, e
 * um `import ... from 'vitest'` é `Cannot find module` ali dentro. O `vitest` é dependência de
 * DESENVOLVIMENTO do escritório e não pode ser dependência das functions deployadas — então a compilação
 * falha, e com ela falha o deploy de TODAS as functions, não só das da extensão que trouxe o teste.
 *
 * Foi assim que as cinco functions de uma extensão falharam juntas, com o relatório culpando cada uma
 * delas. O `AGENTS.md` manda o autor escrever teste ao lado da function; era este lado que faltava.
 *
 * O `__fixtures__` continua entrando: é módulo comum, compila sozinho, e adivinhar pelo nome do
 * diretório seria heurística. O que se reconhece aqui são as duas convenções inequívocas.
 */
const deployable = (source: string): boolean => {
  const name = basename(source);
  return !/\.(test|spec)\.tsx?$/.test(name) && name !== '__tests__';
};

/**
 * Duas declarações da MESMA dependência com faixas diferentes, entre diretórios do escritório.
 *
 * É recusa e não escolha porque não há dono: `install/functions/` é uma árvore de `node_modules` só, e
 * eleger uma das faixas em silêncio é a mesma classe de defeito do nome de function repetido — funciona
 * até a versão escolhida ser a errada, e aí a falha aparece longe da causa.
 *
 * Contra o KERNEL a regra é outra e é deliberada: a faixa do pacote VENCE, e o fato é relatado. O
 * runtime das functions é escolha de quem publica o kernel, e uma extensão não pode movê-lo por baixo
 * das outras.
 */
export interface DependencyPlan {
  /** O que acrescentar ao `package.json` do pacote. */
  added: Record<string, string>;
  /** Declarada pelo escritório e já no kernel, com faixa diferente — a do kernel fica. */
  overridden: string[];
  problems: string[];
}

export const dependencyPlan = (
  sources: FunctionSource[],
  kernelDependencies: Record<string, string>,
): DependencyPlan => {
  const added: Record<string, string> = {};
  const overridden: string[] = [];
  const problems: string[] = [];
  const owner = new Map<string, string>();

  for (const source of sources) {
    for (const [name, range] of Object.entries(source.dependencies)) {
      const inKernel = kernelDependencies[name];
      if (inKernel !== undefined) {
        if (inKernel !== range) overridden.push(`${name}: ${source.label} asks for ${range}, the package has ${inKernel}`);
        continue;
      }

      const previous = added[name];
      if (previous !== undefined && previous !== range) {
        problems.push(
          `dependency "${name}" is declared as ${previous} by ${owner.get(name)} and as ${range} by `
          + `${source.label} — one installation has one node_modules, so the two must agree`,
        );
        continue;
      }

      added[name] = range;
      owner.set(name, source.label);
    }
  }

  return { added, overridden: overridden.sort(), problems };
};

interface FunctionsPackageJson {
  dependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Escreve no `package.json` do pacote as dependências que os diretórios do escritório declaram.
 *
 * Elas não podem viajar no pacote: o kernel não sabe o que o escritório vai escrever. E o `npm install`
 * do deploy é o que as instala — o `package-lock.json` que veio do pacote deixa de cobrir tudo, e o npm
 * resolve o que falta e reescreve o lock. É por isso que a primeira instalação depois de declarar uma
 * dependência nova demora mais que as seguintes.
 */
export const applyFunctionDependencies = async (
  install: string,
  sources: FunctionSource[],
): Promise<DependencyPlan> => {
  // Nenhum diretório declarou dependência: não há o que decidir, e não se abre o `package.json` do
  // pacote para nada. É o caso comum — a maioria das functions do escritório só usa o que já vem.
  if (sources.every((source) => Object.keys(source.dependencies).length === 0)) {
    return { added: {}, overridden: [], problems: [] };
  }

  const path = join(install, 'functions', 'package.json');
  const parsed = JSON.parse(await readFile(path, 'utf8')) as FunctionsPackageJson;
  const kernel = parsed.dependencies ?? {};

  const plan = dependencyPlan(sources, kernel);
  if (plan.problems.length > 0) {
    throw new Error(
      `Your Cloud Functions cannot be assembled:\n${plan.problems.map((problem) => `  ${problem}`).join('\n')}`,
    );
  }

  if (Object.keys(plan.added).length === 0) return plan;

  const merged = Object.fromEntries(
    Object.entries({ ...kernel, ...plan.added }).sort(([left], [right]) => left.localeCompare(right)),
  );
  await writeFile(path, `${JSON.stringify({ ...parsed, dependencies: merged }, null, 2)}\n`);
  return plan;
};

export interface GatherResult extends OfficeFunctions {
  /** Todos os nomes, ordenados — o que as mensagens citam. */
  functions: string[];
  dependencies: DependencyPlan;
}

/**
 * Monta `install/functions/custom/src/` a partir das fontes de fora, escreve o barril e acrescenta ao
 * `package.json` do pacote as dependências que essas fontes declaram.
 *
 * O diretório é apagado antes: ele é DERIVADO, e um resto da montagem anterior seria deployado sem que
 * nada apontasse a origem dele.
 */
export const gatherCustomFunctions = async (
  root: string,
  install: string,
  kernelFunctions: string[],
): Promise<GatherResult> => {
  const sources = await findFunctionSources(root);
  const problems = functionProblems(sources, kernelFunctions);
  if (problems.length > 0) {
    throw new Error(`Your Cloud Functions cannot be assembled:\n${problems.map((p) => `  ${p}`).join('\n')}`);
  }

  const target = join(install, 'functions', 'custom', 'src');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });

  for (const source of sources) {
    await cp(source.path, join(target, source.slug), { recursive: true, filter: deployable });
  }

  await writeFile(
    join(target, 'index.ts'),
    sources.length === 0
      ? '// Generated by "microteia deploy". No Cloud Functions of your own were found.\nexport {};\n'
      : barrel(sources),
  );

  const office = officeFunctionsOf(sources);
  return {
    ...office,
    functions: [...office.all].sort(),
    dependencies: await applyFunctionDependencies(install, sources),
  };
};
