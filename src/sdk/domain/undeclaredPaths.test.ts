import { describe, expect, it } from 'vitest';
import type { QuerySpec } from '../../domain/schema/querySpec';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';
import type { CatalogScreenInput } from './catalog';
import { catalogSchemaContext } from './catalog';
import type { ScreenSourcePackage } from './packageScreens';
import { packagesSchemaContext } from './packageScreens';
import { undeclaredQueryPaths, undeclaredReportPaths } from './undeclaredPaths';

const contacts: CatalogScreenInput = {
  key: 'contacts',
  titleSingular: 'Contact',
  titleFieldKey: 'name',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'city', label: 'City', type: 'text', required: false, order: 1, origin: 'plugin' },
  ],
};

const tickets: CatalogScreenInput = {
  key: 'tickets',
  titleSingular: 'Ticket',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Title', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'amount', label: 'Amount', type: 'number', required: false, order: 1, origin: 'plugin' },
    {
      key: 'ownerId', label: 'Owner', type: 'reference', refEntity: 'contacts', refDenormKey: 'owner',
      required: false, order: 2, origin: 'plugin',
    },
    {
      key: 'watcherIds', label: 'Watchers', type: 'reference', refEntity: 'contacts', multi: true,
      required: false, order: 3, origin: 'plugin',
    },
    {
      key: 'vendorId', label: 'Vendor', type: 'reference', refEntity: 'vendors', required: false, order: 4, origin: 'plugin',
    },
  ],
};

const ctx = catalogSchemaContext([contacts, tickets]);

const report = (dimension: string, extra: Partial<ReportSpec['dataset']> = {}): ReportSpec => ({
  v: 1,
  dataset: {
    table: 'tickets',
    dimensions: [{ key: 'd', path: dimension, label: 'D' }],
    measures: [{ key: 'total', label: 'Total', op: 'sum', path: 'amount' }],
    ...extra,
  },
  shape: { kind: 'summary', groupBy: [{ dimension: 'd' }], values: ['total'] },
});

/**
 * A plataforma aceita o caminho que não conhece — pode ser campo do escritório. Sobre uma tela que o
 * autor tem em mãos, o mesmo caminho é aviso: nenhum campo dela o declara.
 */
describe('o caminho que nenhum campo declara', () => {
  it('nada a dizer quando cada segmento é um campo declarado, inclusive pelo nome do apontado', () => {
    expect(undeclaredReportPaths(report('ownerId.city'), ctx)).toEqual([]);
    expect(undeclaredReportPaths(report('owner.city'), ctx)).toEqual([]);
    expect(undeclaredReportPaths(report('watcherIds.city'), ctx)).toEqual([]);
    expect(undeclaredReportPaths(report('id'), ctx)).toEqual([]);
  });

  it('acusa o erro de digitação na coleção raiz', () => {
    expect(undeclaredReportPaths(report('titel'), ctx)).toEqual([
      { path: 'titel', collection: 'tickets', segment: 'titel' },
    ]);
  });

  it('acusa o erro de digitação depois do salto de referência, nomeando a coleção apontada', () => {
    expect(undeclaredReportPaths(report('ownerId.nameThatDoesNotExist'), ctx)).toEqual([
      { path: 'ownerId.nameThatDoesNotExist', collection: 'contacts', segment: 'nameThatDoesNotExist' },
    ]);
    expect(undeclaredReportPaths(report('watcherIds.cty'), ctx)).toEqual([
      { path: 'watcherIds.cty', collection: 'contacts', segment: 'cty' },
    ]);
  });

  it('confere todo caminho que o relatório lê: filtro, expressão e medida', () => {
    const found = undeclaredReportPaths(report('title', {
      where: [{ path: 'stauts', op: 'exists' }],
      includeWhen: 'owner.cyti == "Recife"',
      measures: [{ key: 'total', label: 'Total', op: 'sum', path: 'amout' }],
    }), ctx);
    expect(found.map((one) => one.path).sort()).toEqual(['amout', 'owner.cyti', 'stauts']);
  });

  it('cala sobre a coleção que não se enxerga: a apontada que não tem tela aqui', () => {
    expect(undeclaredReportPaths(report('vendorId.anything'), ctx)).toEqual([]);
  });

  it('cala sobre a coleção fora do conjunto declarado como completo', () => {
    expect(undeclaredReportPaths(report('titel'), ctx, new Set(['contacts']))).toEqual([]);
    expect(undeclaredReportPaths(report('ownerId.cty'), ctx, new Set(['contacts']))).toHaveLength(1);
  });

  it('cala sobre a tabela que o contexto não conhece, e sobre o caminho que a plataforma já recusa', () => {
    expect(undeclaredReportPaths({ ...report('x'), dataset: { ...report('x').dataset, table: 'elsewhere' } }, ctx)).toEqual([]);
    expect(undeclaredReportPaths(report('title.whatever'), ctx)).toEqual([]);
  });

  it('confere a consulta de automação pelos mesmos critérios', () => {
    const spec: QuerySpec = {
      table: 'tickets',
      where: [{ path: 'ownerId.cyty', op: 'exists' }],
      orderBy: [{ path: 'title', dir: 'asc' }],
      limit: 10,
      projections: ['title', 'amuont'],
    };
    expect(undeclaredQueryPaths(spec, ctx).map((one) => `${one.collection}.${one.segment}`))
      .toEqual(['contacts.cyty', 'tickets.amuont']);
  });
});

/**
 * O teste de extensão monta o esquema a partir dos `plugin.ts` irmãos, sem diretório e sem mapear
 * campo nenhum à mão — inclusive o campo que uma irmã acrescenta à tela da outra.
 */
describe('o esquema das extensões irmãs', () => {
  const contactsPackage: ScreenSourcePackage = {
    manifest: { id: 'com.acme.contacts' },
    screens: [{ key: 'contacts', sourceId: 'com.acme.contacts/contacts', titleSingular: 'Contact', titlePlural: 'Contacts', icon: 'user', titleFieldKey: 'name',
      fields: [{ key: 'name', label: 'Name', type: 'text', required: true, order: 0 }] }],
  };
  const ticketsPackage: ScreenSourcePackage = {
    manifest: { id: 'com.acme.tickets' },
    screens: [{ key: 'tickets', titleSingular: 'Ticket', titlePlural: 'Tickets', icon: 'ticket', titleFieldKey: 'title', fields: [
      { key: 'title', label: 'Title', type: 'text', required: true, order: 0 },
      { key: 'amount', label: 'Amount', type: 'number', required: false, order: 1 },
      { key: 'ownerId', label: 'Owner', type: 'reference', refEntity: 'contacts', required: false, order: 2 },
    ] }],
    screenPatches: [{ target: 'com.acme.contacts/contacts', targetKind: 'sourceId',
      fields: [{ key: 'tier', label: 'Tier', type: 'text', required: false, order: 9 }] }],
  };

  it('conta o campo do complemento por sourceId, qualquer que seja a ordem dos pacotes', () => {
    for (const order of [[contactsPackage, ticketsPackage], [ticketsPackage, contactsPackage]]) {
      const siblings = packagesSchemaContext(order);
      expect(undeclaredReportPaths(report('ownerId.tier'), siblings)).toEqual([]);
      expect(undeclaredReportPaths(report('ownerId.tire'), siblings)).toEqual([
        { path: 'ownerId.tire', collection: 'contacts', segment: 'tire' },
      ]);
    }
  });
});
