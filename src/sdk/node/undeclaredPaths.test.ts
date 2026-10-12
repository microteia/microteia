import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { CatalogScreenInput } from '../domain/catalog';
import { designedFieldsOverWorkspace, undeclaredPathFindings } from './undeclaredPaths';
import type { WorkspaceCatalog } from './workspaceCatalog';

const field = (key: string, extra: Partial<CatalogScreenInput['fields'][number]> = {}): CatalogScreenInput['fields'][number] => ({
  key, label: key, type: 'text', required: false, order: 0, origin: 'plugin', ...extra,
});

const contacts = (source: CatalogScreenInput['source'], extra: Partial<CatalogScreenInput> = {}): CatalogScreenInput => ({
  key: 'contacts',
  titleSingular: 'Contact',
  titleFieldKey: 'name',
  fields: [field('name'), field('city')],
  ownerPluginId: 'com.acme.contacts',
  ...(source === undefined ? {} : { source }),
  ...extra,
});

const workspace = (screens: CatalogScreenInput[], shadowed: string[] = []): WorkspaceCatalog => ({
  catalog: { entities: [], lookups: [], tagLists: [], screens, exceptions: [] },
  authored: [],
  installed: { tenantId: 't1', tenantName: 'Office', ageDays: 3, shadowedCollections: shadowed },
}) as unknown as WorkspaceCatalog;

const board = (dimension: string, query?: string): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.board', version: '1.0.0', kernel: '^9.0.0', name: 'Board',
    dependencies: { 'com.acme.contacts': { version: '^1.0.0' } },
  },
  screens: [{
    key: 'tickets', titleSingular: 'Ticket', titleFieldKey: 'title',
    fields: [field('title'), field('amount', { type: 'number' }), field('ownerId', { type: 'reference', refEntity: 'contacts' })],
  } as unknown as NonNullable<MarketplacePlugin['screens']>[number]],
  reports: [{
    templateId: 'r1', key: 'board-r1', title: 'Tickets by owner', origin: 'plugin',
    spec: {
      v: 1,
      dataset: {
        table: 'tickets',
        dimensions: [{ key: 'd', path: dimension, label: 'D' }],
        measures: [{ key: 'total', label: 'Total', op: 'count' }],
      },
      shape: { kind: 'summary', groupBy: [{ dimension: 'd' }], values: ['total'] },
    },
  }],
  workflows: query === undefined ? [] : [{
    templateId: 'w1', name: 'Look up', eventName: 'tickets.saved', version: 1, condition: { kind: 'AlwaysTrue' },
    steps: [{
      id: 's1', stepDefinitionId: 'query', type: 'Action', order: 0, enabled: true,
      configuration: { query: { kind: 'Literal', value: { table: 'contacts', where: [], limit: 5, projections: [query] } } },
    }],
  }],
}) as unknown as MarketplacePlugin;

const paths = (pkg: MarketplacePlugin, read: WorkspaceCatalog, extra: CatalogScreenInput[] = []) =>
  undeclaredPathFindings(pkg, read, extra).map((one) => `${one.collection}.${one.segment}`);

/**
 * O `check` confere os caminhos dos relatórios e das consultas contra as MESMAS telas que usa para os
 * prefixos de evento: o próprio pacote, as irmãs do diretório e o retrato da instalação.
 */
describe('os caminhos que nenhum campo declara, no check', () => {
  it('acusa o erro de digitação sobre a tela de uma irmã do diretório, dizendo onde procurou', () => {
    const [found] = undeclaredPathFindings(board('ownerId.nameThatDoesNotExist'), workspace([contacts(undefined)]));
    expect(`${found.collection}.${found.segment}`).toBe('contacts.nameThatDoesNotExist');
    expect(found.writtenBy).toBe('report "Tickets by owner"');
    expect(found.detail).toContain('plugin.ts of com.acme.contacts');
  });

  it('acusa pelo retrato da instalação', () => {
    const [found] = undeclaredPathFindings(board('ownerId.cty'), workspace([contacts('installation')]));
    expect(found.detail).toContain('installed-catalog.json');
  });

  it('acusa sobre a tela do próprio pacote, mesmo fora do diretório', () => {
    expect(paths(board('titel'), workspace([]))).toEqual(['tickets.titel']);
  });

  it('nada a dizer quando o caminho existe, e cala sobre a coleção que não se enxerga', () => {
    expect(paths(board('ownerId.city'), workspace([contacts(undefined)]))).toEqual([]);
    expect(paths(board('ownerId.anything'), workspace([]))).toEqual([]);
  });

  it('confere a consulta das automações do pacote', () => {
    const findings = undeclaredPathFindings(board('title', 'citty'), workspace([contacts(undefined)]));
    expect(findings.map((one) => `${one.collection}.${one.segment}`)).toEqual(['contacts.citty']);
    expect(findings[0].writtenBy).toBe('query step of workflow "Look up"');
  });

  it('o campo do escritório sobre uma tela daqui não é acusado: o retrato o declara', () => {
    const installed = contacts('installation', { fields: [field('name'), field('vip', { origin: 'design' })] });
    const read = workspace([contacts(undefined)], ['contacts']);
    expect(paths(board('ownerId.vip'), read)).toEqual(['contacts.vip']);
    expect(paths(board('ownerId.vip'), read, designedFieldsOverWorkspace(read, [installed]))).toEqual([]);
  });

  it('o campo acrescentado por complemento à tela de outra extensão conta como declarado', () => {
    const pkg = {
      ...board('ownerId.tier'),
      screenPatches: [{ target: 'com.acme.contacts/contacts', targetKind: 'sourceId', fields: [field('tier')] }],
    } as unknown as MarketplacePlugin;
    const read = workspace([contacts(undefined, { sourceId: 'com.acme.contacts/contacts' })]);
    expect(paths(pkg, read)).toEqual([]);
  });
});
