import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  canonicalSource,
  decideWithoutAsking,
  hashSource,
  isSourcePath,
  packagedSourceOf,
  parseApprovals,
  sourceProblems,
  writePackagedSource,
} from './packagedSources.js';
import type { PackagedClaim } from './packagedSources.js';
import { packagedFunctionsPath, packagedReviewPath, packagedSlug } from './packagedPaths.js';

const files = { 'index.ts': "export * from './quote';\n", 'quote.ts': 'export const quote = 1;\n' };

const claim = (over: Partial<PackagedClaim> = {}): PackagedClaim => ({
  pluginId: 'com.exemplo.cotacao',
  name: 'Cotação',
  version: '1.0.0',
  functions: ['quote'],
  source: { files, hash: hashSource(files) },
  approvedHashes: new Set(),
  ...over,
});

describe('paridade com o kernel', () => {
  // Separadas, o hash gravado pelo build nunca conferiria aqui, e toda extensão com fonte seria recusada
  // como adulterada — sem erro nenhum que apontasse a divergência.
  it('a serialização e a regra de caminho são as mesmas', async () => {
    const kernel = await import('../../../src/domain/schema/plugin/backendSource.js');
    const sample = { 'b/x.ts': 'b', 'a.ts': 'a', 'package.json': '{}' };
    expect(canonicalSource(sample)).toBe(kernel.backendSourceCanonical(sample));

    const paths = [
      'index.ts', 'a/b.ts', 'package.json', 'x.test.ts', 'x.spec.ts', '../x.ts', '/abs.ts', 'a\\b.ts',
      '.hidden.ts', 'node_modules/x.ts', '__tests__/x.ts', 'a//b.ts', 'readme.md', '', 'a/./b.ts',
    ];
    for (const path of paths) expect(isSourcePath(path), path).toBe(kernel.isBackendSourcePath(path));
  });

  it('o hash é o mesmo que o build do SDK grava', async () => {
    const sdk = await import('../../../src/sdk/node/backendSource.js');
    expect(hashSource(files)).toBe(sdk.hashBackendSource(files));
  });
});

describe('sourceProblems', () => {
  it('fonte íntegra não tem problema', () => {
    expect(sourceProblems({ files, hash: hashSource(files) })).toEqual([]);
  });

  it('conteúdo alterado depois do build é recusado', () => {
    const changed = { ...files, 'quote.ts': 'export const quote = 2;\n' };
    expect(sourceProblems({ files: changed, hash: hashSource(files) }).join(' ')).toMatch(/checksum/);
  });

  it('caminho que sai do diretório e falta de index.ts são recusados', () => {
    const bad = { '../escape.ts': 'x' };
    const problems = sourceProblems({ files: bad, hash: hashSource(bad) }).join(' ');
    expect(problems).toMatch(/cannot be written/);
    expect(problems).toMatch(/index\.ts/);
  });
});

describe('packagedSourceOf', () => {
  it('lê do pacote instalado e ignora o que não é texto', () => {
    expect(packagedSourceOf({ backendSource: { files: { 'index.ts': 'x', bad: 1 }, hash: 'h' } }))
      .toEqual({ files: { 'index.ts': 'x' }, hash: 'h' });
    expect(packagedSourceOf({})).toBeUndefined();
  });
});

describe('parseApprovals', () => {
  it('aceita id@hash separados por vírgula', () => {
    expect(parseApprovals('com.a@abc, com.b@def')).toEqual(new Map([['com.a', 'abc'], ['com.b', 'def']]));
    expect(parseApprovals(undefined).size).toBe(0);
  });

  it('recusa o que não tem as duas partes', () => {
    expect(() => parseApprovals('com.a')).toThrow(/--approve/);
    expect(() => parseApprovals('com.a@')).toThrow(/--approve/);
  });
});

describe('decideWithoutAsking', () => {
  const none = new Map<string, string>();

  it('a fonte da instalação vale mais que a empacotada', () => {
    expect(decideWithoutAsking(claim(), new Set(['quote']), none)).toEqual({ kind: 'provided' });
  });

  it('fonte que não confere é inválida, mesmo aprovada antes', () => {
    const tampered = claim({ source: { files, hash: '0'.repeat(64) }, approvedHashes: new Set(['0'.repeat(64)]) });
    expect(decideWithoutAsking(tampered, new Set(), none)?.kind).toBe('invalid');
  });

  // O caso dos escritórios A e B: A reinstala, B ainda carrega a aprovação daquele hash.
  it('o hash aprovado em qualquer cópia do projeto dispensa a pergunta', () => {
    const approved = claim({ approvedHashes: new Set([hashSource(files)]) });
    expect(decideWithoutAsking(approved, new Set(), none)).toEqual({ kind: 'approved', how: 'recorded' });
  });

  it('--approve com o hash certo aprova; com outro hash, retém', () => {
    expect(decideWithoutAsking(claim(), new Set(), new Map([['com.exemplo.cotacao', hashSource(files)]])))
      .toEqual({ kind: 'approved', how: 'flag' });
    expect(decideWithoutAsking(claim(), new Set(), new Map([['com.exemplo.cotacao', 'outro']])))
      .toEqual({ kind: 'held', flagMismatch: true });
  });

  it('código novo, ainda não aprovado: pergunta', () => {
    expect(decideWithoutAsking(claim({ approvedHashes: new Set(['velho']) }), new Set(), none)).toBeNull();
  });
});

describe('writePackagedSource', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root !== undefined) await rm(root, { recursive: true, force: true });
  });

  it('grava em packaged-functions para subir, e em packaged-review só para ler', async () => {
    root = await mkdtemp(join(tmpdir(), 'packaged-'));
    await writePackagedSource(root, claim());
    await writePackagedSource(root, claim(), 'review');
    const slug = packagedSlug('com.exemplo.cotacao');
    expect(await readFile(join(packagedFunctionsPath(root), slug, 'quote.ts'), 'utf8')).toBe(files['quote.ts']);
    expect(await readFile(join(packagedReviewPath(root), slug, 'index.ts'), 'utf8')).toBe(files['index.ts']);
  });

  it('recusa caminho que escaparia da pasta, ainda que ninguém tenha conferido antes', async () => {
    root = await mkdtemp(join(tmpdir(), 'packaged-'));
    const escape = { '../../fora.ts': 'x' };
    await expect(writePackagedSource(root, claim({ source: { files: escape, hash: hashSource(escape) } })))
      .rejects.toThrow(/outside its folder/);
  });
});
