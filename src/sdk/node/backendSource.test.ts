import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { attachBackendSource, hashBackendSource, readBackendSource } from './backendSource';

let dir: string | undefined;
afterEach(() => {
  if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  dir = undefined;
});

const write = (root: string, path: string, content: string): void => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};

const pkg = { manifest: { id: 'com.exemplo.x', version: '1.0.0', kernel: '*', name: 'X' }, summary: 's', workflows: [] } as unknown as MarketplacePlugin;

describe('readBackendSource', () => {
  it('sem functions/ ao lado do plugin.ts: nada', () => {
    dir = mkdtempSync(join(tmpdir(), 'bsrc-'));
    expect(readBackendSource(dir)).toBeNull();
  });

  // Teste e node_modules existem na pasta de qualquer autor que trabalha direito; levá-los quebraria a
  // compilação de TODAS as functions da instalação que os recebesse.
  it('leva .ts e .json, e deixa de fora teste, node_modules e oculto', () => {
    dir = mkdtempSync(join(tmpdir(), 'bsrc-'));
    write(dir, 'functions/index.ts', 'export {};');
    write(dir, 'functions/data/rules.json', '{}');
    write(dir, 'functions/package.json', '{"dependencies":{}}');
    write(dir, 'functions/index.test.ts', 'import "vitest";');
    write(dir, 'functions/node_modules/x/index.ts', 'x');
    write(dir, 'functions/.env', 'SECRET=1');
    write(dir, 'functions/README.md', '#');

    const source = readBackendSource(dir);
    expect(Object.keys(source?.files ?? {}).sort()).toEqual(['data/rules.json', 'index.ts', 'package.json']);
    expect(source?.hash).toBe(hashBackendSource(source?.files ?? {}));
  });

  it('o hash não depende da ordem em que o disco lista os arquivos', () => {
    expect(hashBackendSource({ 'a.ts': '1', 'b.ts': '2' })).toBe(hashBackendSource({ 'b.ts': '2', 'a.ts': '1' }));
  });
});

describe('attachBackendSource', () => {
  it('acopla a fonte ao pacote', () => {
    dir = mkdtempSync(join(tmpdir(), 'bsrc-'));
    write(dir, 'functions/index.ts', 'export {};');
    expect(Object.keys(attachBackendSource(pkg, dir).backendSource?.files ?? {})).toEqual(['index.ts']);
  });

  it('fonte escrita à mão E pasta ao lado é recusa, não precedência', () => {
    dir = mkdtempSync(join(tmpdir(), 'bsrc-'));
    write(dir, 'functions/index.ts', 'export {};');
    const handWritten = { ...pkg, backendSource: { files: {}, hash: '0'.repeat(64) } };
    expect(() => attachBackendSource(handWritten, dir as string)).toThrow(/keep the folder/);
  });
});
