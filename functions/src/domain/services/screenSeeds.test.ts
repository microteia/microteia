import { describe, expect, it } from 'vitest';
import type { IScreenSeedRepository, SeedInstalledScreen } from '../repositories/IScreenSeedRepository';
import { readExtensionSeedState } from '../schema/screenSeed';
import type { ExtensionSeedState, ScreenSeedEntry, ScreenSeedFailure } from '../schema/screenSeed';
import { runScreenSeedPass } from './screenSeeds';
import type { ScreenSeedDeps, ScreenSeedPassSummary, SeedWriteOutcome } from './screenSeeds';

const breeds = (records: { key: string; data: Record<string, unknown> }[], mode?: string) => ({
  manifest: { id: 'acme.pets' },
  screens: [{
    key: 'breeds',
    sourceId: 'acme.pets.breeds',
    fields: [{ key: 'name', type: 'text' }, { key: 'species', type: 'select' }],
    seed: { ...(mode ? { mode } : {}), records },
  }],
});

const LAB = { key: 'labrador', data: { name: 'Labrador', species: 'dog' } };
const PERSIAN = { key: 'persian', data: { name: '@acme.pets/breed.persian', species: 'cat' } };
const SIAMESE = { key: 'siamese', data: { name: 'Siamese', species: 'cat' } };

class FakeRepository implements IScreenSeedRepository {
  state: ExtensionSeedState = readExtensionSeedState(undefined);
  installed: { package: unknown; active: boolean } | null;
  screens: SeedInstalledScreen[] = [{ sourceId: 'acme.pets.breeds', collection: 'breeds' }];
  collectionEmpty = true;
  emptinessChecks = 0;
  claims = 0;
  onAfterPass?: () => void;

  constructor(pkg: unknown) {
    this.installed = { package: pkg, active: true };
  }

  async readInstalled() {
    return this.installed;
  }
  async installedScreens() {
    return this.screens;
  }
  async isCollectionEmpty() {
    this.emptinessChecks += 1;
    return this.collectionEmpty;
  }
  async readState() {
    return structuredClone(this.state);
  }
  async claim(_tenantId: string, _pluginId: string, now: number, leaseMs: number) {
    if (this.state.leaseUntil !== null && this.state.leaseUntil > now) return null;
    this.claims += 1;
    this.state.leaseUntil = now + leaseMs;
    return structuredClone(this.state);
  }
  async release() {
    this.state.leaseUntil = null;
    this.onAfterPass?.();
  }
  async saveScreen(_tenantId: string, _pluginId: string, sourceId: string, entry: ScreenSeedEntry, failures: ScreenSeedFailure[]) {
    this.state.screens[sourceId] = { planned: entry.planned, delivered: this.state.screens[sourceId]?.delivered ?? [] };
    this.state.failures[sourceId] = failures;
  }
  async markDelivered(_tenantId: string, _pluginId: string, sourceId: string, key: string) {
    const entry = this.state.screens[sourceId] ?? { planned: null, delivered: [] };
    if (!entry.delivered.includes(key)) entry.delivered.push(key);
    this.state.screens[sourceId] = entry;
  }
}

const harness = (repository: FakeRepository, outcome: (data: Record<string, unknown>) => SeedWriteOutcome = () => ({ ok: true })) => {
  const written: Record<string, unknown>[] = [];
  const passes: ScreenSeedPassSummary[] = [];
  const deps: ScreenSeedDeps = {
    repository,
    writeSeed: async (_tenantId, _collection, data) => {
      written.push(data);
      return outcome(data);
    },
    prepare: async () => undefined,
    resolverFor: async () => (ref) => (ref === 'acme.pets/breed.persian' ? 'Persa' : ref),
    recordPass: async (_tenantId, summary) => {
      passes.push(summary);
    },
    now: () => 1_000,
    logger: { warn: () => undefined },
  };
  return { deps, written, passes };
};

describe('runScreenSeedPass', () => {
  it('semeia a coleção vazia, resolve a referência no idioma do escritório e deixa UMA linha de auditoria', async () => {
    const repository = new FakeRepository(breeds([LAB, PERSIAN]));
    const { deps, written, passes } = harness(repository);

    const summary = await runScreenSeedPass('t1', 'acme.pets', deps);

    expect(written).toEqual([{ name: 'Labrador', species: 'dog' }, { name: 'Persa', species: 'cat' }]);
    expect(summary).toMatchObject({ created: 2, matched: 0, failed: 0, screens: 1 });
    expect(passes).toHaveLength(1);
    expect(repository.state.screens['acme.pets.breeds']).toEqual({ planned: ['labrador', 'persian'], delivered: ['labrador', 'persian'] });
    expect(repository.state.leaseUntil).toBeNull();
  });

  it('when-empty não semeia a coleção que o escritório já preencheu', async () => {
    const repository = new FakeRepository(breeds([LAB]));
    repository.collectionEmpty = false;
    const { deps, written, passes } = harness(repository);

    await runScreenSeedPass('t1', 'acme.pets', deps);

    expect(written).toEqual([]);
    expect(passes).toEqual([]);
    expect(repository.state.screens['acme.pets.breeds'].planned).toEqual([]);
  });

  it('uma segunda passada sem mudança no pacote não reserva nem grava', async () => {
    const repository = new FakeRepository(breeds([LAB]));
    const { deps } = harness(repository);
    await runScreenSeedPass('t1', 'acme.pets', deps);
    const { deps: again, written } = harness(repository);

    expect(await runScreenSeedPass('t1', 'acme.pets', again)).toBeNull();
    expect(written).toEqual([]);
    expect(repository.claims).toBe(1);
  });

  it('required: a versão nova entrega só a chave nova, e a apagada pelo escritório não volta', async () => {
    const repository = new FakeRepository(breeds([LAB, PERSIAN], 'required'));
    repository.state.screens['acme.pets.breeds'] = { planned: null, delivered: ['labrador', 'persian'] };
    repository.installed = { package: breeds([LAB, PERSIAN, SIAMESE], 'required'), active: true };
    const { deps, written } = harness(repository);

    await runScreenSeedPass('t1', 'acme.pets', deps);

    expect(written).toEqual([{ name: 'Siamese', species: 'cat' }]);
    expect(repository.emptinessChecks).toBe(0);
  });

  it('a semente que esbarra numa chave declarada conta como entregue; a recusada fica para a próxima', async () => {
    const repository = new FakeRepository(breeds([LAB, PERSIAN, SIAMESE], 'required'));
    const { deps, passes } = harness(repository, (data) => {
      if (data.name === 'Labrador') return { ok: false, error: '@core.automation/mutation.upsert.key-conflict' };
      if (data.name === 'Siamese') return { ok: false, error: '@core.automation/mutation.upsert.required', errorParams: { field: 'size' } };
      return { ok: true };
    });

    await runScreenSeedPass('t1', 'acme.pets', deps);

    expect(repository.state.screens['acme.pets.breeds'].delivered.sort()).toEqual(['labrador', 'persian']);
    expect(repository.state.failures['acme.pets.breeds']).toEqual([
      { key: 'siamese', error: '@core.automation/mutation.upsert.required', errorParams: { field: 'size' } },
    ]);
    expect(passes[0]).toMatchObject({ created: 1, matched: 1, failed: 1 });
  });

  it('a passada reservada por outra entrega sai sem gravar', async () => {
    const repository = new FakeRepository(breeds([LAB]));
    repository.state.leaseUntil = 5_000;
    const { deps, written } = harness(repository);

    expect(await runScreenSeedPass('t1', 'acme.pets', deps)).toBeNull();
    expect(written).toEqual([]);
  });

  it('o pacote que muda durante a passada é semeado na mesma reserva', async () => {
    const repository = new FakeRepository(breeds([LAB], 'required'));
    const { deps, written } = harness(repository);
    let changed = false;
    const originalInstalledScreens = repository.installedScreens.bind(repository);
    repository.installedScreens = async () => {
      if (!changed) {
        changed = true;
        repository.installed = { package: breeds([LAB, SIAMESE], 'required'), active: true };
      }
      return originalInstalledScreens();
    };

    await runScreenSeedPass('t1', 'acme.pets', deps);

    expect(written.map((data) => data.name)).toEqual(['Labrador', 'Siamese']);
  });

  it('extensão desligada não semeia', async () => {
    const repository = new FakeRepository(breeds([LAB]));
    repository.installed = { package: breeds([LAB]), active: false };
    const { deps, written } = harness(repository);

    expect(await runScreenSeedPass('t1', 'acme.pets', deps)).toBeNull();
    expect(written).toEqual([]);
  });

  it('tela ainda não instalada adia a semente sem marcar nada', async () => {
    const repository = new FakeRepository(breeds([LAB]));
    repository.screens = [];
    const { deps, written } = harness(repository);

    await runScreenSeedPass('t1', 'acme.pets', deps);

    expect(written).toEqual([]);
    expect(repository.state.screens['acme.pets.breeds']).toBeUndefined();
  });
});
