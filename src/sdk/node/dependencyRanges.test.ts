import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { buildPlugin } from './compile';
import { dependencyRangeFindings, dependencyRangeReport } from './dependencyRanges';
import type { WorkspaceCatalog } from './workspaceCatalog';

/**
 * A faixa que o `check` não conferia quando não havia referência a artefato: `com.example.uses`
 * declarava `com.example.base` `^0.1.0`, a irmã ao lado já estava em 0.3.0, e em 0.x isso só admite
 * 0.1.x. O `check` das duas dizia "no problems found"; no escritório, a primeira não carregava.
 */

const pluginSource = (id: string, version: string, dependencies: Record<string, string> = {}): string => `export default {
  manifest: {
    id: '${id}',
    version: '${version}',
    kernel: '^2.0.0',
    name: '${id}',
    description: 'Range fixture.',
    contributes: [],
    dependencies: ${JSON.stringify(dependencies)},
  },
  summary: 'Range fixture.',
  workflows: [],
};
`;

const roots: string[] = [];

const workspace = (plugins: Record<string, string>): string => {
  const root = mkdtempSync(join(tmpdir(), 'microteia-ranges-'));
  roots.push(root);
  for (const [folder, source] of Object.entries(plugins)) {
    mkdirSync(join(root, folder), { recursive: true });
    writeFileSync(join(root, folder, 'plugin.ts'), source);
  }
  return root;
};

const compiled = (root: string, folder: string): MarketplacePlugin =>
  buildPlugin({ entry: join(root, folder, 'plugin.ts') }).package;

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('a faixa de cada dependência, contra o que o diretório enxerga', () => {
  it('avisa a dependência irmã fora da faixa declarada, com a frase do kernel', () => {
    const root = workspace({
      base: pluginSource('com.example.base', '0.3.0'),
      uses: pluginSource('com.example.uses', '0.1.1', { 'com.example.base': '^0.1.0' }),
    });

    const findings = dependencyRangeReport(compiled(root, 'uses'), root);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ extension: 'com.example.base', range: '^0.1.0', status: 'outside-workspace' });
    expect(findings[0].detail).toContain('"com.example.uses" accepts "com.example.base" ^0.1.0');
    expect(findings[0].detail).toContain('0.3.0');
  });

  it('do lado da dependência, avisa a irmã que declara este pacote numa faixa que a versão não satisfaz', () => {
    const root = workspace({
      base: pluginSource('com.example.base', '0.3.0'),
      uses: pluginSource('com.example.uses', '0.1.1', { 'com.example.base': '^0.1.0' }),
    });

    const findings = dependencyRangeReport(compiled(root, 'base'), root);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ extension: 'com.example.uses', range: '^0.1.0', status: 'outside-sibling' });
    expect(findings[0].detail).toContain('uses/plugin.ts');
  });

  it('a faixa larga resolve os dois lados', () => {
    const root = workspace({
      base: pluginSource('com.example.base', '0.3.0'),
      uses: pluginSource('com.example.uses', '0.1.2', { 'com.example.base': '>=0.1.0 <1.0.0' }),
    });

    expect(dependencyRangeReport(compiled(root, 'uses'), root).map((one) => one.status)).toEqual(['ok']);
    expect(dependencyRangeReport(compiled(root, 'base'), root)).toEqual([]);
  });
});

describe('a faixa contra o retrato da instalação', () => {
  const pkg: MarketplacePlugin = {
    summary: '',
    manifest: {
      id: 'com.example.uses',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Uses',
      dependencies: { 'com.example.base': '^1.0.0', 'com.example.absent': '^1.0.0' },
    },
    workflows: [],
  };

  const read = (installed: WorkspaceCatalog['installed']): WorkspaceCatalog =>
    ({ authored: [], installed } as unknown as WorkspaceCatalog);

  it('diz a versão instalada fora da faixa e a dependência que não está lá, sem reprovar nenhuma', () => {
    const findings = dependencyRangeFindings(pkg, read({
      tenantName: 'Acme',
      extensions: [{ id: 'com.example.base', name: 'Base', version: '2.0.0', active: true }],
    } as unknown as WorkspaceCatalog['installed']));

    expect(findings.map((one) => [one.extension, one.status])).toEqual([
      ['com.example.base', 'outside-there'],
      ['com.example.absent', 'absent-there'],
    ]);
  });

  it('sem retrato nem irmã, diz que não dá para conferir daqui', () => {
    expect(dependencyRangeFindings(pkg, read(null)).map((one) => one.status)).toEqual(['unverifiable', 'unverifiable']);
  });
});
