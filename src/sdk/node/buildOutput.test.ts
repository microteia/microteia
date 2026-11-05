import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildTargets, defaultBuildOutDir } from './buildOutput';

const existing = (...paths: string[]) => (path: string): boolean => paths.includes(path);

describe('destino padrão do build', () => {
  const workspace = join('/', 'office', 'extensions');

  it('grava no dist/ do diretório de extensões, e não ao lado do plugin.ts', () => {
    const entry = join(workspace, 'push', 'plugin.ts');
    expect(defaultBuildOutDir(entry, existing(join(workspace, 'package.json'))))
      .toBe(join(workspace, 'dist'));
  });

  it('um exemplo aninhado vai para o MESMO dist/', () => {
    const entry = join(workspace, 'examples', 'news', 'plugin.ts');
    expect(defaultBuildOutDir(entry, existing(join(workspace, 'package.json'))))
      .toBe(join(workspace, 'dist'));
  });

  it('o package.json mais próximo vence', () => {
    const own = join(workspace, 'solo');
    const entry = join(own, 'plugin.ts');
    expect(defaultBuildOutDir(entry, existing(join(own, 'package.json'), join(workspace, 'package.json'))))
      .toBe(join(own, 'dist'));
  });

  it('sem package.json acima, o dist/ fica ao lado da fonte', () => {
    const entry = join('/', 'tmp', 'loose', 'plugin.ts');
    expect(defaultBuildOutDir(entry, existing())).toBe(join('/', 'tmp', 'loose', 'dist'));
  });
});

describe('o que o build --all compila', () => {
  const root = mkdtempSync(join(tmpdir(), 'build-all-'));
  const plugin = (...segments: string[]): string => {
    const dir = join(root, ...segments);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'plugin.ts'), 'export default {};');
    return join(dir, 'plugin.ts');
  };
  const sales = plugin('sales');
  const billing = plugin('billing');
  const news = plugin('examples', 'news');
  plugin('node_modules', 'dep');
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('deixa examples/ de fora por padrão, e diz quantos ficaram', () => {
    expect(buildTargets(root, false)).toEqual({ entries: [billing, sales], skippedExamples: 1 });
  });

  it('com --examples, inclui os exemplos DEPOIS das extensões do escritório', () => {
    expect(buildTargets(root, true)).toEqual({ entries: [billing, sales, news], skippedExamples: 0 });
  });
});
