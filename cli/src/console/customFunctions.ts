import { access, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const readSource = async (path: string, label: string, slug: string): Promise<FunctionSource> => {
  const entry = join(path, 'index.ts');
  if (!await exists(entry)) {
    throw new Error(
      `${label}/ has no index.ts.\n`
      + 'A directory of Cloud Functions is read through its index.ts — export from there what should be'
      + ' deployed.',
    );
  }
  return { label, slug, path, exported: exportedNames(await readFile(entry, 'utf8')) };
};

/** Onde o escritório pode ter escrito function, na ordem em que as mensagens as citam. */
export const findFunctionSources = async (root: string): Promise<FunctionSource[]> => {
  const found: FunctionSource[] = [];

  if (await exists(join(root, FUNCTIONS_DIR))) {
    found.push(await readSource(join(root, FUNCTIONS_DIR), FUNCTIONS_DIR, 'shared'));
  }

  const extensions = join(root, EXTENSIONS_DIR);
  if (await exists(extensions)) {
    for (const entry of (await readdir(extensions, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = join(extensions, entry.name, FUNCTIONS_DIR);
      if (!await exists(path)) continue;
      found.push(await readSource(path, `${EXTENSIONS_DIR}/${entry.name}/${FUNCTIONS_DIR}`, entry.name));
    }
  }

  return found;
};

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

export interface GatherResult {
  sources: FunctionSource[];
  functions: string[];
}

/**
 * Monta `install/functions/custom/src/` a partir das fontes de fora, e escreve o barril.
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
    await cp(source.path, join(target, source.slug), { recursive: true });
  }

  await writeFile(
    join(target, 'index.ts'),
    sources.length === 0
      ? '// Generated by "microteia deploy". No Cloud Functions of your own were found.\nexport {};\n'
      : barrel(sources),
  );

  return { sources, functions: sources.flatMap((source) => source.exported).sort() };
};
