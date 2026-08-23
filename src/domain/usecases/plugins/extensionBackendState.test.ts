import { describe, expect, it } from 'vitest';
import {
  extensionNeedsBackend,
  isExtensionBackendApplied,
  isExtensionBackendPending,
} from './extensionBackendState';
import { installedExtensionRecords } from './installedExtensionRecords';
import { backendFingerprint } from '../../schema/plugin/backendRequirement';
import type { PluginBackendRequirement } from '../../schema/plugin/backendRequirement';
import type { InstalledExtension } from '../../entities/InstalledExtension';

const NEEDS: PluginBackendRequirement = { functions: ['integracaoSync'] };

const extension = (
  id: string,
  overrides: Partial<InstalledExtension> = {},
  backend?: PluginBackendRequirement,
): InstalledExtension => ({
  id,
  tenantId: 't1',
  active: true,
  package: {
    manifest: { id, version: '1.0.0', kernel: '^2.0.0', name: id, ...(backend ? { backend } : {}) },
    summary: '',
    workflows: [],
  },
  source: 'builtin',
  installedVersion: '1.0.0',
  authorId: '',
  authorName: '',
  authorPhotoURL: null,
  installedBy: '',
  installedAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('estado de backend de uma extensão instalada', () => {
  it('extensão que não exige nada do backend está sempre satisfeita', () => {
    const plain = extension('com.acme.plain');
    expect(extensionNeedsBackend(plain)).toBe(false);
    expect(isExtensionBackendApplied(plain)).toBe(true);
    expect(isExtensionBackendPending(plain)).toBe(false);
  });

  it('exige e não tem carimbo: PENDENTE — falha fechada', () => {
    const pending = extension('com.acme.push', {}, NEEDS);
    expect(isExtensionBackendApplied(pending)).toBe(false);
    expect(isExtensionBackendPending(pending)).toBe(true);
  });

  it('carimbo que bate com o exigido: satisfeita', () => {
    const applied = extension(
      'com.acme.push',
      { backendState: { fingerprint: backendFingerprint(NEEDS), appliedAt: new Date() } },
      NEEDS,
    );
    expect(isExtensionBackendApplied(applied)).toBe(true);
    expect(isExtensionBackendPending(applied)).toBe(false);
  });

  it('carimbo de OUTRA exigência não vale: é por conteúdo, não por existir', () => {
    const stale = extension(
      'com.acme.push',
      {
        backendState: {
          fingerprint: backendFingerprint({ functions: ['integracaoSync', 'integracaoRenew'] }),
          appliedAt: new Date(),
        },
      },
      NEEDS,
    );
    expect(isExtensionBackendPending(stale)).toBe(true);
  });

  it('carimbo vazio ou nulo não passa', () => {
    expect(isExtensionBackendPending(extension('a', { backendState: null }, NEEDS))).toBe(true);
    expect(isExtensionBackendPending(
      extension('a', { backendState: { fingerprint: '', appliedAt: new Date() } }, NEEDS),
    )).toBe(true);
  });
});

describe('carga do host do tenant', () => {
  const trusted = new Set<string>();

  it('a extensão pendente NÃO entra no host — nem menu, nem tela, nem startup', () => {
    const records = installedExtensionRecords([extension('com.acme.push', {}, NEEDS)], trusted);
    expect(records).toEqual([]);
  });

  it('a mesma extensão entra depois de o Console carimbar', () => {
    const records = installedExtensionRecords(
      [extension(
        'com.acme.push',
        { backendState: { fingerprint: backendFingerprint(NEEDS), appliedAt: new Date() } },
        NEEDS,
      )],
      trusted,
    );
    expect(records.map((record) => record.manifest.id)).toEqual(['com.acme.push']);
  });

  it('o gate de backend é independente do de atividade: inativa segue fora mesmo carimbada', () => {
    const records = installedExtensionRecords(
      [extension(
        'com.acme.push',
        { active: false, backendState: { fingerprint: backendFingerprint(NEEDS), appliedAt: new Date() } },
        NEEDS,
      )],
      trusted,
    );
    expect(records).toEqual([]);
  });

  it('uma extensão pendente não impede as outras de carregar', () => {
    const records = installedExtensionRecords(
      [extension('com.acme.push', {}, NEEDS), extension('com.acme.plain')],
      trusted,
    );
    expect(records.map((record) => record.manifest.id)).toEqual(['com.acme.plain']);
  });
});
