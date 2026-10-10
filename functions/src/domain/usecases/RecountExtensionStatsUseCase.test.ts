import { describe, it, expect } from 'vitest';
import type { IExtensionStatsRepository } from '../repositories/IExtensionStatsRepository';
import { countsAsCatalogInstall } from '../services/extensionStats';
import { makeRecountExtensionInstallsUseCase, makeRecountExtensionRatingsUseCase } from './RecountExtensionStatsUseCase';

const fakeRepo = (preexisting: string[] = [], ratings: number[] = []) => {
  const markers = new Set<string>();
  let seeded = false;
  let written: number | null = null;
  let writtenRatings: { count: number; sum: number } | null = null;
  let scans = 0;
  const repo: IExtensionStatsRepository = {
    setInstallMarker: async (_pluginId, tenantId, installed) => {
      if (installed) markers.add(tenantId);
      else markers.delete(tenantId);
    },
    isInstallCountSeeded: async () => seeded,
    findCatalogInstallTenants: async () => {
      scans += 1;
      return preexisting;
    },
    seedInstallMarkers: async (_pluginId, tenantIds) => {
      tenantIds.forEach((tenantId) => markers.add(tenantId));
      seeded = true;
    },
    countInstallMarkers: async () => markers.size,
    writeInstallCount: async (_pluginId, installs) => { written = installs; },
    aggregateRatings: async () => ({ count: ratings.length, sum: ratings.reduce((a, b) => a + b, 0) }),
    writeRatings: async (_pluginId, count, sum) => { writtenRatings = { count, sum }; },
  };
  return { repo, markers, written: () => written, writtenRatings: () => writtenRatings, scans: () => scans };
};

describe('countsAsCatalogInstall', () => {
  it('conta a cópia vinda do catálogo público ou embutido', () => {
    expect(countsAsCatalogInstall({ source: 'public' })).toBe(true);
    expect(countsAsCatalogInstall({ source: 'builtin' })).toBe(true);
  });

  it('não conta a extensão privada do próprio escritório, nem a cópia apagada', () => {
    expect(countsAsCatalogInstall({ source: 'private' })).toBe(false);
    expect(countsAsCatalogInstall(undefined)).toBe(false);
  });
});

describe('RecountExtensionInstallsUseCase', () => {
  it('na primeira vez, levanta as instalações que já existiam antes da contagem', async () => {
    const fake = fakeRepo(['t1', 't2']);
    const installs = await makeRecountExtensionInstallsUseCase(fake.repo)
      .execute({ pluginId: 'com.acme.x', tenantId: 't3', installed: true });

    expect(installs).toBe(3);
    expect(fake.written()).toBe(3);
  });

  it('varre os escritórios uma vez só', async () => {
    const fake = fakeRepo(['t1']);
    const recount = makeRecountExtensionInstallsUseCase(fake.repo);
    await recount.execute({ pluginId: 'com.acme.x', tenantId: 't2', installed: true });
    await recount.execute({ pluginId: 'com.acme.x', tenantId: 't3', installed: true });

    expect(fake.scans()).toBe(1);
    expect(fake.written()).toBe(3);
  });

  it('é idempotente: a mesma instalação reentregue não conta duas vezes', async () => {
    const fake = fakeRepo();
    const recount = makeRecountExtensionInstallsUseCase(fake.repo);
    await recount.execute({ pluginId: 'com.acme.x', tenantId: 't1', installed: true });
    await recount.execute({ pluginId: 'com.acme.x', tenantId: 't1', installed: true });

    expect(fake.written()).toBe(1);
  });

  it('desinstalar tira o escritório da conta', async () => {
    const fake = fakeRepo(['t1', 't2']);
    await makeRecountExtensionInstallsUseCase(fake.repo)
      .execute({ pluginId: 'com.acme.x', tenantId: 't1', installed: false });

    expect(fake.written()).toBe(2);
  });
});

describe('RecountExtensionRatingsUseCase', () => {
  it('grava quantidade e soma dos votos, das quais a tela deriva a média', async () => {
    const fake = fakeRepo([], [5, 4, 3]);
    await makeRecountExtensionRatingsUseCase(fake.repo).execute('com.acme.x');

    expect(fake.writtenRatings()).toEqual({ count: 3, sum: 12 });
  });
});
