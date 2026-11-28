import { describe, expect, it } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { InstalledExtensionCache } from './InstalledExtensionCache';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';

const installed = (docs: Record<string, Record<string, unknown>>): Firestore => ({
  collection: () => ({
    get: async () => ({ docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })) }),
  }),
}) as unknown as Firestore;

const withBundles = (...bundles: Array<{ namespace: string; messages: Record<string, string> }>) => ({
  package: { manifest: { contributes: bundles.map((bundle) => messageBundleContribution({ locale: 'pt-BR', ...bundle })) } },
});

describe('InstalledExtensionCache — a tradução que o portal recebe (#57)', () => {
  it('o vocabulário dos componentes vai ao portal de toda extensão ligada; o resto do catálogo, não', async () => {
    const cache = new InstalledExtensionCache(installed({
      'com.microteia.locale-pt-br': withBundles(
        { namespace: 'core.ui', messages: { 'select.placeholder': 'Selecione...' } },
        { namespace: 'core.admin', messages: { 'access.title': 'Acessos' } },
      ),
      'com.desligada': { active: false, ...withBundles({ namespace: 'core.ui', messages: { 'select.placeholder': 'Outro' } }) },
    }));

    const { views, bundles, kernelBundles } = await cache.portalViews('t1');

    expect(views).toEqual([]);
    expect(bundles).toEqual([]);
    expect(kernelBundles).toEqual([
      { locale: 'pt-BR', namespace: 'core.ui', messages: { 'select.placeholder': 'Selecione...' } },
    ]);
  });
});
