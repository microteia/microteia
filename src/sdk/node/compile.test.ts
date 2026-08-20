import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildPlugin, loadModule } from './compile';

/**
 * O compilador que o autor de fora usa é o MESMO que produz os `extension-templates/*.json` deste
 * repositório. Este teste é o que prova isso, e é a razão de não haver dois compiladores.
 *
 * O risco que ele cobre é o de a nossa esteira e a do escritório divergirem: se o loader do SDK lesse
 * um módulo de forma minimamente diferente da que a nossa esteira lê, o `.json` que um autor produz
 * deixaria de ser comparável ao que produzimos — e ninguém notaria até um pacote instalar errado.
 * Comparar BYTE A BYTE contra os artefatos já versionados não deixa margem.
 */
const ROOT = resolve(__dirname, '../../..');
const CATALOG = join(ROOT, 'src/plugins/marketplace/catalog.ts');

/** Arquivo distribuído -> export do catálogo que o origina, como em `scripts/export-extensions.mjs`. */
const TEMPLATES: [string, string][] = [
  ['brasil.json', 'brasilPlugin'],
  ['pessoa.json', 'pessoaPlugin'],
  ['processo.json', 'processoPlugin'],
  ['push.json', 'pushPlugin'],
  ['kanban-processos.json', 'kanbanCasesPlugin'],
  ['locale-pt-br.json', 'localePtBrPlugin'],
  ['calendar.json', 'calendarPlugin'],
  ['contrato.json', 'contratoPlugin'],
  ['dashboard.json', 'dashboardPlugin'],
  ['financeiro.json', 'financeiroPlugin'],
  ['news.json', 'newsPlugin'],
  ['prazo.json', 'prazoPlugin'],
];

describe('o compilador do SDK e os artefatos deste repositório', () => {
  it.each(TEMPLATES)('%s sai igual, byte a byte', (file, exportName) => {
    const built = buildPlugin({ entry: CATALOG, exportName });
    const onDisk = readFileSync(join(ROOT, 'extension-templates', file), 'utf8');
    expect(built.json).toBe(onDisk);
  });

  it.each(TEMPLATES)('%s não tem pendência que a instalação recusaria', (_file, exportName) => {
    expect(buildPlugin({ entry: CATALOG, exportName }).issues).toEqual([]);
  });

  /** Um módulo importado por dois arquivos é avaliado UMA vez, senão duas cópias de uma constante
   * deixam de ser iguais por identidade — e um `Set` de chaves passa a ter o dobro de itens. */
  it('avalia cada módulo uma só vez', () => {
    const cache = new Map<string, Record<string, unknown>>();
    const first = loadModule(CATALOG, cache);
    const second = loadModule(CATALOG, cache);
    expect(second).toBe(first);
    expect(cache.size).toBeGreaterThan(10);
  });

  it('recusa um módulo que não exporta pacote nenhum', () => {
    expect(() => buildPlugin({ entry: join(ROOT, 'src/sdk/index.ts') }))
      .toThrow(/exports no extension package/);
  });

  it('exige escolher quando o módulo exporta vários pacotes', () => {
    expect(() => buildPlugin({ entry: CATALOG })).toThrow(/--export/);
  });

  it('recusa um export que não existe, em vez de compilar o pacote errado', () => {
    expect(() => buildPlugin({ entry: CATALOG, exportName: 'naoExiste' }))
      .toThrow(/does not export a package named "naoExiste"/);
  });
});
