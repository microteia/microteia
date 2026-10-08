import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { CatalogScreenInput } from '../domain/catalog';
import { eventRefFindings } from './eventRefs';
import type { WorkspaceCatalog } from './workspaceCatalog';

const pushes = (dependencies: Record<string, { version: string; collections?: string[] }> = {}): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.microteia.push', version: '1.0.0', kernel: '^2.0.0', name: 'Pushes', dependencies },
  workflows: [{
    templateId: 'vincular', name: 'Vincular pushes ao processo cadastrado', eventName: 'case.saved', version: 1,
    condition: { kind: 'AlwaysTrue' }, steps: [],
  }],
});

const PROCESSO = { 'com.microteia.processo': { version: '^2.0.0', collections: ['cases'] } };

const processos = (source: CatalogScreenInput['source'], overrides: Partial<CatalogScreenInput> = {}): CatalogScreenInput => ({
  key: 'processos',
  collection: 'cases',
  eventPrefix: 'case',
  titleSingular: 'Processo',
  titleFieldKey: 'numero',
  fields: [],
  ownerPluginId: 'com.microteia.processo',
  ...(source === undefined ? {} : { source }),
  ...overrides,
});

const workspace = (screens: CatalogScreenInput[], snapshot = false): WorkspaceCatalog => ({
  catalog: { entities: [], lookups: [], tagLists: [], screens, exceptions: [] },
  authored: [],
  installed: snapshot ? { tenantId: 't1', tenantName: 'Escritório', ageDays: 2 } : null,
}) as unknown as WorkspaceCatalog;

const status = (pkg: MarketplacePlugin, read: WorkspaceCatalog) =>
  eventRefFindings(pkg, read).map((one) => `${one.prefix}=${one.status}`);

/**
 * O `check` resolve o gatilho em `case.saved` pelas telas das dependências que enxerga — o
 * `plugin.ts` delas neste diretório e o retrato da instalação. O que não enxerga é aviso, não recusa.
 */
describe('os gatilhos que escutam outra extensão, no check', () => {
  it('aceita pelo plugin.ts da dependência neste workspace', () => {
    const findings = eventRefFindings(pushes(PROCESSO), workspace([processos(undefined)]));
    expect(findings.map((one) => one.status)).toEqual(['ok']);
    expect(findings[0].detail).toContain('plugin.ts of com.microteia.processo');
  });

  it('aceita pelo retrato da instalação', () => {
    const findings = eventRefFindings(pushes(PROCESSO), workspace([processos('installation')], true));
    expect(findings.map((one) => one.status)).toEqual(['ok']);
    expect(findings[0].detail).toContain('installed-catalog.json');
  });

  it('recusa, nomeando o prefixo e a extensão, quando quem emite não é dependência declarada', () => {
    const findings = eventRefFindings(pushes({ 'com.acme.utils': { version: '^1.0.0' } }), workspace([processos('installation')], true));
    expect(findings.map((one) => one.status)).toEqual(['refused']);
    expect(findings[0].detail).toContain('"case"');
    expect(findings[0].detail).toContain('com.microteia.processo');
  });

  it('avisa, sem recusar, o prefixo que nenhuma fonte visível emite', () => {
    expect(status(pushes(PROCESSO), workspace([]))).toEqual(['case=unverifiable']);
    expect(status(pushes(PROCESSO), workspace([], true))).toEqual(['case=unverifiable']);
  });

  it('a tela do escritório que emite o prefixo não cobre o gatilho, e isso é dito', () => {
    const designed = processos('installation', { ownerPluginId: undefined });
    const [finding] = eventRefFindings(pushes(PROCESSO), workspace([designed], true));
    expect(finding.status).toBe('unverifiable');
    expect(finding.detail).toContain('belongs to no extension');
  });

  it('a tela sem eventPrefix emite pela coleção', () => {
    const pkg = { ...pushes(PROCESSO), workflows: [{ ...pushes().workflows[0], eventName: 'cases_x.saved' }] };
    const screen = processos(undefined, { eventPrefix: undefined, key: 'cases_x', collection: 'cases_x' });
    expect(status(pkg, workspace([screen]))).toEqual(['cases_x=ok']);
  });
});
