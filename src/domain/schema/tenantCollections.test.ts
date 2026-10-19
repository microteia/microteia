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
