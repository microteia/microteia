import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  belongsToNamespace,
  qualifyPluginId,
  recordNamespace,
  storedNamespace,
  workspaceNamespace,
} from './namespace';

const workspaces: string[] = [];

const workspace = (pkg: Record<string, unknown>): string => {
  const root = mkdtempSync(join(tmpdir(), 'microteia-namespace-'));
  workspaces.push(root);
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  return root;
};

afterEach(() => {
  while (workspaces.length > 0) rmSync(workspaces.pop() as string, { recursive: true, force: true });
});

describe('o namespace do diretório de extensões', () => {
  it('é lido de package.json, sob microteia.namespace', () => {
    const root = workspace({ name: 'acme-extensions', microteia: { namespace: 'com.acme', kernelVersion: '1.0.0' } });
    expect(workspaceNamespace(root)).toBe('com.acme');
  });

  it('não existe quando falta, e um valor fora do formato não serve de prefixo', () => {
    expect(workspaceNamespace(workspace({ name: 'x' }))).toBeNull();
    const invalid = workspace({ microteia: { namespace: 'Acme' } });
    expect(storedNamespace(invalid)).toBe('Acme');
    expect(workspaceNamespace(invalid)).toBeNull();
  });

  it('é gravado sem tocar no resto do package.json', () => {
    const root = workspace({ name: 'acme-extensions', scripts: { test: 'vitest run' }, microteia: { kernelVersion: '1.0.0' } });
    recordNamespace(root, 'com.acme');
    expect(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))).toEqual({
      name: 'acme-extensions',
      scripts: { test: 'vitest run' },
      microteia: { kernelVersion: '1.0.0', namespace: 'com.acme' },
    });
  });

  it('recusa gravar um namespace fora do formato', () => {
    const root = workspace({ name: 'x' });
    expect(() => recordNamespace(root, 'acme')).toThrow('not a valid namespace');
  });

  it('completa o nome curto e deixa o id inteiro como veio', () => {
    expect(qualifyPluginId('billing', 'com.acme')).toBe('com.acme.billing');
    expect(qualifyPluginId(' com.acme.billing ', 'com.acme')).toBe('com.acme.billing');
    expect(qualifyPluginId('com.microteia.billing', 'com.acme')).toBe('com.microteia.billing');
  });

  /** O prefixo é por SEGMENTO: `com.acmex` não pertence a `com.acme`, nem o próprio namespace é um id. */
  it('confere pertença por segmento inteiro', () => {
    expect(belongsToNamespace('com.acme.billing', 'com.acme')).toBe(true);
    expect(belongsToNamespace('com.acmex.billing', 'com.acme')).toBe(false);
    expect(belongsToNamespace('com.acme', 'com.acme')).toBe(false);
    expect(belongsToNamespace('com.microteia.billing', 'com.acme')).toBe(false);
  });
});
