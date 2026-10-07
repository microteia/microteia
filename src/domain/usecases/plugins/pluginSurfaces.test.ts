import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { UI_API_VERSION, UI_TAB_POINT, recordSurface, recordSurfaceSourceId } from '../../schema/ui/uiExtensionPoints';
import { packageSurfaceIssues } from './pluginSurfaces';
import { packageIssues } from './pluginReferences';

const withTabs = (...surfaces: string[]): MarketplacePlugin => ({
  summary: 'x',
  manifest: {
    id: 'com.acme.prazo',
    version: '1.0.0',
    kernel: '^2.19.0',
    name: 'Prazos',
    contributes: surfaces.map((surface, index) => ({
      point: UI_TAB_POINT,
      id: `aba${index}`,
      apiVersion: UI_API_VERSION,
      metadata: { surface, key: `aba${index}`, title: 'Prazos' },
      impl: { kind: 'code' as const, key: 'PrazosTab' },
    })),
  },
  workflows: [],
});

describe('a superfície do detalhe de um registro', () => {
  it('é endereçada pelo sourceId da tela, e só por ele', () => {
    expect(recordSurface('microteia:processo')).toBe('record:microteia:processo');
    expect(recordSurfaceSourceId('record:microteia:processo')).toBe('microteia:processo');
    expect(recordSurfaceSourceId('record:')).toBe('');
    expect(recordSurfaceSourceId('tenant-settings')).toBeNull();
  });

  it('aceita a aba que diz de qual tela é', () => {
    expect(packageSurfaceIssues(withTabs(recordSurface('microteia:processo'), 'tenant-settings'))).toEqual([]);
  });

  /**
   * `record:` sem tela instala, não dá erro em lugar nenhum e nunca aparece: nenhum detalhe lê essa
   * superfície. É o portão do pacote que pode dizê-lo enquanto o autor ainda corrige.
   */
  it('recusa record: sem sourceId, dizendo qual contribuição e onde', () => {
    const issues = packageSurfaceIssues(withTabs('tenant-settings', 'record:', 'record:  '));
    expect(issues.map((issue) => issue.messageParams?.where)).toEqual([
      'contributes[1].metadata.surface',
      'contributes[2].metadata.surface',
    ]);
    expect(issues[0].message).toBe('@core.marketplace/issue.package.record-surface.no-source-id');
  });

  it('entra na porta única das validações de pacote', () => {
    expect(packageIssues(withTabs('record:')).map((issue) => issue.message))
      .toContain('@core.marketplace/issue.package.record-surface.no-source-id');
  });
});
