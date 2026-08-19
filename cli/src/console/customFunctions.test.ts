import { describe, expect, it, beforeEach } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  exportedNames,
  findFunctionSources,
  functionProblems,
  gatherCustomFunctions,
} from './customFunctions.js';

/**
 * As Cloud Functions do escritório vêm de dois lugares que respondem a duas perguntas: a function é
 * daquela extensão (`extensions/<plugin>/functions/`) ou é comum a várias (`functions/`)? Os dois ficam
 * FORA de `.microteia/`, que o `unpack` apaga por inteiro.
 *
 * O risco que estes casos guardam é o de substituição silenciosa: o `index.js` do pacote espalha o
 * customizado DEPOIS do kernel, então um nome repetido troca a implementação sem erro nenhum. Um gatilho
 * do kernel substituído não falha — ele simplesmente deixa de acontecer.
 */
const KERNEL = ['onWorkflowEventCreated', 'runScript', 'gmailPush'];

let root: string;

const writeFunctions = async (relative: string, source: string): Promise<void> => {
  await mkdir(join(root, relative), { recursive: true });
  await writeFile(join(root, relative, 'index.ts'), source);
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'microteia-fn-'));
});

describe('os nomes que um módulo de entrada exporta', () => {
  it('reconhece a declaração no lugar, que é como se escreve uma function', () => {
    expect(exportedNames("export const helloOffice = onCall({}, () => ({ ok: true }));"))
      .toEqual(['helloOffice']);
  });

  it('reconhece a reexportação, que é como se organiza um diretório', () => {
    expect(exportedNames("export { alpha, beta } from './handlers';")).toEqual(['alpha', 'beta']);
  });

  it('lê o nome final de um alias, que é o que vai ser deployado', () => {
    expect(exportedNames("export { internalName as publicName };")).toEqual(['publicName']);
  });

  it('ignora o default, que não é uma function deployável', () => {
    expect(exportedNames('export default {};')).toEqual([]);
  });
});

describe('de onde as functions do escritório vêm', () => {
  it('acha as comuns e as de cada extensão, e nomeia cada origem', async () => {
    await writeFunctions('functions', 'export const shared = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const vendasHook = 1;');
    await writeFunctions('extensions/rh/functions', 'export const rhHook = 1;');

    const sources = await findFunctionSources(root);
    expect(sources.map((source) => source.label)).toEqual([
      'functions',
      'extensions/rh/functions',
      'extensions/vendas/functions',
    ]);
    expect(sources.map((source) => source.slug)).toEqual(['shared', 'rh', 'vendas']);
  });

  it('não encontra nada numa instalação que não escreveu function nenhuma', async () => {
    expect(await findFunctionSources(root)).toEqual([]);
  });

  it('um diretório sem index.ts é recusado dizendo o que fazer', async () => {
    await mkdir(join(root, 'functions'), { recursive: true });
    await expect(findFunctionSources(root)).rejects.toThrow(/has no index\.ts/);
  });

  it('ignora node_modules dentro de extensions', async () => {
    await writeFunctions('extensions/node_modules/algo/functions', 'export const x = 1;');
    expect(await findFunctionSources(root)).toEqual([]);
  });
});

describe('o que impede montar o conjunto', () => {
  it('recusa um nome igual ao de uma function do Microteia', async () => {
    await writeFunctions('functions', 'export const gmailPush = 1;');
    const problems = functionProblems(await findFunctionSources(root), KERNEL);
    expect(problems.join()).toMatch(/"gmailPush", which is the name of a Microteia function/);
  });

  it('recusa o mesmo nome em duas origens, nomeando as duas', async () => {
    await writeFunctions('functions', 'export const dobrado = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const dobrado = 1;');
    const problems = functionProblems(await findFunctionSources(root), KERNEL);
    expect(problems.join()).toContain('exported by both functions and extensions/vendas/functions');
  });

  it('recusa um diretório que não exporta nada, em vez de deployar o vazio', async () => {
    await writeFunctions('functions', '// nada aqui\n');
    expect(functionProblems(await findFunctionSources(root), KERNEL).join()).toMatch(/exports nothing/);
  });

  it('não reclama de um conjunto válido', async () => {
    await writeFunctions('functions', 'export const shared = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const vendasHook = 1;');
    expect(functionProblems(await findFunctionSources(root), KERNEL)).toEqual([]);
  });
});

describe('a montagem dentro de install/', () => {
  const install = (): string => join(root, '.microteia', 'install');

  it('copia cada origem para a sua pasta e gera o barril', async () => {
    await writeFunctions('functions', 'export const shared = 1;');
    await writeFunctions('extensions/vendas/functions', 'export const vendasHook = 1;');

    const result = await gatherCustomFunctions(root, install(), KERNEL);
    expect(result.functions).toEqual(['shared', 'vendasHook']);

    const target = join(install(), 'functions/custom/src');
    expect(await readFile(join(target, 'shared/index.ts'), 'utf8')).toContain('shared');
    expect(await readFile(join(target, 'vendas/index.ts'), 'utf8')).toContain('vendasHook');

    const generated = await readFile(join(target, 'index.ts'), 'utf8');
    expect(generated).toContain("export * from './shared';");
    expect(generated).toContain("export * from './vendas';");
    expect(generated).toContain('rebuilt on every deploy');
  });

  it('numa instalação sem function nenhuma, escreve um barril vazio que compila', async () => {
    const result = await gatherCustomFunctions(root, install(), KERNEL);
    expect(result.sources).toEqual([]);
    expect(await readFile(join(install(), 'functions/custom/src/index.ts'), 'utf8')).toContain('export {};');
  });

  /**
   * O diretório é DERIVADO. Um resto da montagem anterior seria deployado sem que nada apontasse a
   * origem dele — o tipo de function fantasma que ninguém sabe de onde veio.
   */
  it('apaga o que sobrou da montagem anterior', async () => {
    await writeFunctions('extensions/antiga/functions', 'export const antiga = 1;');
    await gatherCustomFunctions(root, install(), KERNEL);

    await writeFunctions('extensions/nova/functions', 'export const nova = 1;');
    const { readdir, rm } = await import('node:fs/promises');
    await rm(join(root, 'extensions/antiga'), { recursive: true, force: true });

    await gatherCustomFunctions(root, install(), KERNEL);
    const entries = await readdir(join(install(), 'functions/custom/src'));
    expect(entries.sort()).toEqual(['index.ts', 'nova']);
  });

  it('a recusa acontece ANTES de escrever qualquer coisa', async () => {
    await writeFunctions('functions', 'export const gmailPush = 1;');
    await expect(gatherCustomFunctions(root, install(), KERNEL)).rejects.toThrow(/cannot be assembled/);
  });
});
