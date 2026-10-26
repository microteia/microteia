import { describe, it, expect } from 'vitest';
import { buildPermissionCatalog } from './access/resolvePermissions';
import type { CatalogScreenSource } from './tenantCollections';
import {
  tenantCollectionPermissionResources,
  tenantLookupCollections,
  tenantTagCollections,
} from './tenantCollections';
import { BUILTIN_LOOKUPS } from './screenEntity';

const tela = (overrides: Partial<CatalogScreenSource> = {}): CatalogScreenSource => ({
  id: 'consultas',
  origin: 'design',
  titleSingular: 'Consultation',
  titlePlural: 'Consultations',
  fields: [],
  ...overrides,
});

const catalogoDe = (
  telas: CatalogScreenSource[],
  listas: { collection: string; label: string }[] = [],
  etiquetas: { collection: string; label: string }[] = [],
) => buildPermissionCatalog([], tenantCollectionPermissionResources(
  telas,
  tenantLookupCollections(telas, listas),
  tenantTagCollections(telas, etiquetas),
));

describe('as coleções do escritório no catálogo de permissões', () => {
  it('a lista referenciada só por um campo de tela rende o CRUD dela', () => {
    const catalogo = catalogoDe([
      tela({ fields: [{ label: 'Specialty', lookupCollection: 'especialidades' }] }),
    ]);

    expect(catalogo.byId.has('especialidades.read')).toBe(true);
    expect(catalogo.byId.has('especialidades.create')).toBe(true);
  });

  it('o conjunto de etiquetas declarado só pela tela rende o CRUD dele', () => {
    const catalogo = catalogoDe([tela({ tagCollection: 'consultas_tags' })]);

    expect(catalogo.byId.has('consultas_tags.update')).toBe(true);
  });

  it('as listas do núcleo entram sem declaração nenhuma do escritório', () => {
    const disponiveis = tenantLookupCollections([], []).map((lista) => lista.collection);

    expect(disponiveis).toEqual(BUILTIN_LOOKUPS.map((lista) => lista.collection));
  });

  it('coleção reservada não deriva CRUD, mesmo apontada por um campo', () => {
    const catalogo = catalogoDe([
      tela({ fields: [{ label: 'Screens', lookupCollection: 'screenDefinitions' }] }),
    ]);

    expect(catalogo.byId.has('screenDefinitions.read')).toBe(false);
  });

  it('a âncora de uma coleção descrita por outra tela não dá o nome do recurso', () => {
    const catalogo = catalogoDe([
      tela({ id: 'agenda', origin: 'builtin', titleSingular: 'agenda', titlePlural: 'agenda' }),
      tela({ id: 'compromissos', dataCollection: 'agenda', titleSingular: 'Event', titlePlural: 'Events' }),
    ]);

    expect(catalogo.resourceLabels.get('agenda')?.name).toBe('Events');
  });

  it('na lista vence o rótulo DECLARADO; na etiqueta, o DERIVADO da tela', () => {
    const telas = [tela({
      tagCollection: 'consultas_tags',
      fields: [{ label: 'Specialty', lookupCollection: 'especialidades' }],
    })];

    const [lista] = tenantLookupCollections(telas, [{ collection: 'especialidades', label: 'Especialidades' }])
      .filter((one) => one.collection === 'especialidades');
    const [etiqueta] = tenantTagCollections(telas, [{ collection: 'consultas_tags', label: 'Antigo' }])
      .filter((one) => one.collection === 'consultas_tags');

    expect(lista.label).toBe('Especialidades');
    expect(etiqueta.label).toBe('@core.records/tag-list.of');
  });
});

describe('a supervisão derivada da visibilidade por registro', () => {
  it('a tela restrita sem supervisão nomeada rende `<coleção>.read-all`, que exige ver', () => {
    const catalog = catalogoDe([tela({ memberVisibility: { userFields: ['medico'] } })]);
    expect(catalog.byId.get('consultas.read-all')).toMatchObject({
      requires: ['consultas.read'],
      resource: 'consultas',
      action: 'read-all',
      name: '@core.access/action.read-all',
      derived: true,
    });
  });

  it('a tela sem restrição — o caso de todo escritório até aqui — não ganha permissão nova', () => {
    const catalog = catalogoDe([tela()]);
    expect([...catalog.byId.keys()].filter((id) => id.startsWith('consultas.'))).toEqual([
      'consultas.read', 'consultas.create', 'consultas.update', 'consultas.delete',
    ]);
  });

  it('com `bypassPermission`, a supervisão é a nomeada, e a derivada não existe', () => {
    const catalog = catalogoDe([tela({ memberVisibility: { userFields: ['medico'], bypassPermission: 'consultas.supervise' } })]);
    expect(catalog.byId.has('consultas.read-all')).toBe(false);
  });

  it('numa tela vinculada, vale a declaração do documento da COLEÇÃO — o que a regra lê', () => {
    const ancora = tela({ id: 'atendimentos', origin: 'builtin', memberVisibility: { userFields: ['medico'] } });
    const caixa = tela({ id: 'caixa', dataCollection: 'atendimentos', memberVisibility: null });
    expect(catalogoDe([ancora, caixa]).byId.has('atendimentos.read-all')).toBe(true);

    const soNaVinculada = tela({ id: 'caixa', dataCollection: 'atendimentos', memberVisibility: { userFields: ['medico'] } });
    expect(catalogoDe([tela({ id: 'atendimentos', origin: 'builtin' }), soNaVinculada]).byId.has('atendimentos.read-all'))
      .toBe(false);
  });
});
