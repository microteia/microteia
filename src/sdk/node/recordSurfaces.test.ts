import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { CatalogScreenInput } from '../domain/catalog';
import { UI_API_VERSION, UI_TAB_POINT, recordSurface } from '../../domain/schema/ui/uiExtensionPoints';
import { recordSurfaceFindings } from './recordSurfaces';
import type { WorkspaceCatalog } from './workspaceCatalog';

const tab = (id: string, sourceId: string) => ({
  point: UI_TAB_POINT,
  id,
  apiVersion: UI_API_VERSION,
  metadata: { surface: recordSurface(sourceId), key: id, title: 'Prazos' },
  impl: { kind: 'code' as const, key: 'PrazosTab' },
});

const prazos = (overrides: Partial<MarketplacePlugin['manifest']> = {}, screens: MarketplacePlugin['screens'] = []): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.microteia.prazo',
    version: '1.0.0',
    kernel: '^2.19.0',
    name: 'Prazos',
    contributes: [tab('prazos-no-processo', 'microteia:processo')],
    ...overrides,
  },
  screens,
  workflows: [],
});

const screen = (sourceId: string, ownerPluginId: string, collection = 'processos'): CatalogScreenInput => ({
  key: collection,
  collection,
  sourceId,
  titleSingular: 'Processo',
  titleFieldKey: 'numero',
  fields: [],
  ownerPluginId,
});

const workspace = (options: {
  screens?: CatalogScreenInput[];
  authored?: string[];
  installedCollections?: string[];
} = {}): WorkspaceCatalog => ({
  catalog: { entities: [], lookups: [], tagLists: [], screens: options.screens ?? [], exceptions: [] },
  authored: (options.authored ?? []).map((pluginId) => ({ path: `${pluginId}/plugin.ts`, pluginId, version: '1.0.0', exports: [] })),
  installed: options.installedCollections === undefined
    ? null
    : { tenantName: 'Escritório', addedCollections: options.installedCollections },
}) as unknown as WorkspaceCatalog;

const status = (pkg: MarketplacePlugin, read: WorkspaceCatalog) =>
  recordSurfaceFindings(pkg, read).map((one) => `${one.sourceId}=${one.status}`);

/**
 * Pendurar uma aba na tela de OUTRA extensão nunca é recusa: a tela pode existir no escritório de
 * destino. Mas um `sourceId` trocado instala e nunca aparece, e é isso que o `check` precisa dizer.
 */
describe('as telas a que o pacote pendura abas', () => {
  it('reconhece a tela do próprio pacote', () => {
    const pkg = prazos({}, [{ key: 'processos', sourceId: 'microteia:processo' } as never]);
    expect(status(pkg, workspace())).toEqual(['microteia:processo=ok']);
  });

  it('reconhece a tela de uma dependência escrita neste diretório', () => {
    const pkg = prazos({ dependencies: { 'com.microteia.processo': { version: '^1.0.0' } } as never });
    const read = workspace({ screens: [screen('microteia:processo', 'com.microteia.processo')], authored: ['com.microteia.processo'] });
    expect(status(pkg, read)).toEqual(['microteia:processo=ok']);
  });

  it('avisa quando a dona está aqui, mas não é dependência declarada', () => {
    const read = workspace({ screens: [screen('microteia:processo', 'com.microteia.processo')], authored: ['com.microteia.processo'] });
    expect(status(prazos(), read)).toEqual(['microteia:processo=not-a-dependency']);
  });

  it('reconhece a tela que o retrato da instalação traz', () => {
    const read = workspace({ screens: [screen('microteia:processo', 'com.microteia.processo')], installedCollections: ['processos'] });
    expect(status(prazos(), read)).toEqual(['microteia:processo=ok']);
  });

  it('avisa, sem recusar, o sourceId que ninguém daqui enxerga — e agrupa as abas por tela', () => {
    const pkg = prazos({ contributes: [tab('a', 'microteia:processso'), tab('b', 'microteia:processso')] });
    const findings = recordSurfaceFindings(pkg, workspace({ installedCollections: [] }));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ sourceId: 'microteia:processso', status: 'not-found', contributions: ['a', 'b'] });
  });
});
