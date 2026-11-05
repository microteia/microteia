import { describe, expect, it } from 'vitest';
import { backendSourceCanonical, backendSourceIssues, isBackendSourcePath } from './backendSource';

const hash = 'a'.repeat(64);

describe('isBackendSourcePath', () => {
  it('aceita .ts e .json dentro do diretório', () => {
    expect(isBackendSourcePath('index.ts')).toBe(true);
    expect(isBackendSourcePath('domain/x.ts')).toBe(true);
    expect(isBackendSourcePath('package.json')).toBe(true);
  });

  // O Console grava estes arquivos em disco: um caminho que escapa escreveria fora da pasta da extensão.
  it('recusa o que sai do diretório', () => {
    for (const path of ['../x.ts', '/x.ts', 'a/../../x.ts', 'a\\x.ts', '']) {
      expect(isBackendSourcePath(path), path).toBe(false);
    }
  });

  it('recusa teste, oculto, node_modules e o que não é .ts/.json', () => {
    for (const path of ['x.test.ts', 'x.spec.ts', '.env', 'a/.git/x.ts', 'node_modules/x.ts', '__tests__/x.ts', 'x.md', 'x.js']) {
      expect(isBackendSourcePath(path), path).toBe(false);
    }
  });
});

describe('backendSourceCanonical', () => {
  it('não depende da ordem das chaves', () => {
    expect(backendSourceCanonical({ 'b.ts': '2', 'a.ts': '1' })).toBe(backendSourceCanonical({ 'a.ts': '1', 'b.ts': '2' }));
  });

  it('o separador não deixa duas árvores diferentes produzirem o mesmo texto', () => {
    expect(backendSourceCanonical({ 'a.ts': 'b.ts' })).not.toBe(backendSourceCanonical({ 'a.tsb.ts': '' }));
  });
});

describe('backendSourceIssues', () => {
  it('sem fonte não há o que conferir', () => {
    expect(backendSourceIssues(undefined, [])).toEqual([]);
  });

  it('fonte íntegra e declarada passa', () => {
    expect(backendSourceIssues({ files: { 'index.ts': '' }, hash }, ['f'])).toEqual([]);
  });

  it('forma errada é uma recusa só', () => {
    expect(backendSourceIssues('x', ['f'])).toEqual([{ code: 'shape' }]);
    expect(backendSourceIssues({ files: {}, hash: 'curto' }, ['f'])).toEqual([{ code: 'shape' }]);
    expect(backendSourceIssues({ files: { 'index.ts': 1 }, hash }, ['f'])).toEqual([{ code: 'shape' }]);
  });

  it('caminho proibido, falta de index.ts e fonte sem declaração', () => {
    expect(backendSourceIssues({ files: { '../x.ts': '' }, hash }, [])).toEqual([
      { code: 'path', path: '../x.ts' },
      { code: 'no-index' },
      { code: 'undeclared' },
    ]);
  });
});
