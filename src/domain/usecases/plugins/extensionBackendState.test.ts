import { describe, expect, it } from 'vitest';
import {
  extensionBackendPendingCause,
  extensionNeedsBackend,
  isExtensionBackendApplied,
  isExtensionBackendPending,
} from './extensionBackendState';
import { installedExtensionRecords } from './installedExtensionRecords';
import { backendFingerprint } from '../../schema/plugin/backendRequirement';
import type { PluginBackendRequirement } from '../../schema/plugin/backendRequirement';
import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { AppliedBackend } from '../../entities/AppliedBackend';

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
    expect(isExtensionBackendApplied(plain, null)).toBe(true);
    expect(isExtensionBackendPending(plain, null)).toBe(false);
  });

  it('exige e não tem carimbo: PENDENTE — falha fechada', () => {
    const pending = extension('com.acme.push', {}, NEEDS);
    expect(isExtensionBackendApplied(pending, null)).toBe(false);
    expect(isExtensionBackendPending(pending, null)).toBe(true);
  });

  it('carimbo que bate com o exigido: satisfeita', () => {
    const applied = extension(
      'com.acme.push',
      { backendState: { fingerprint: backendFingerprint(NEEDS), appliedAt: new Date() } },
      NEEDS,
    );
    expect(isExtensionBackendApplied(applied, null)).toBe(true);
    expect(isExtensionBackendPending(applied, null)).toBe(false);
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
    expect(isExtensionBackendPending(stale, null)).toBe(true);
  });

  it('carimbo vazio ou nulo não passa', () => {
    expect(isExtensionBackendPending(extension('a', { backendState: null }, NEEDS), null)).toBe(true);
    expect(isExtensionBackendPending(
      extension('a', { backendState: { fingerprint: '', appliedAt: new Date() } }, NEEDS),
      null,
    )).toBe(true);
  });
});

describe('carga do host do tenant', () => {
  const trusted = new Set<string>();

  it('a extensão pendente NÃO entra no host — nem menu, nem tela, nem startup', () => {
    const records = installedExtensionRecords([extension('com.acme.push', {}, NEEDS)], trusted, null);
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
      null,
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
      null,
    );
    expect(records).toEqual([]);
  });

  it('uma extensão pendente não impede as outras de carregar', () => {
    const records = installedExtensionRecords(
      [extension('com.acme.push', {}, NEEDS), extension('com.acme.plain')],
      trusted,
      null,
    );
    expect(records.map((record) => record.manifest.id)).toEqual(['com.acme.plain']);
  });
});

/**
 * O escritório B atualiza para a versão que o escritório A já pôs no ar. A function é do projeto, e
 * a cópia de B exige exatamente o que ele roda — não há nada pendente, só o carimbo que o `provision`
 * gravaria se tivesse rodado depois.
 */
describe('o que o PROJETO tem aplicado', () => {
  const projectWith = (pluginId: string, fingerprint: string): AppliedBackend => ({
    writtenAt: new Date(),
    consoleVersion: '2.39.0',
    extensions: [{ pluginId, fingerprint, approvedHash: null, approvedBy: null }],
  });

  it('cópia sem carimbo próprio, com o fingerprint que o projeto roda: liberada', () => {
    const copy = extension('com.acme.push', {}, NEEDS);
    const project = projectWith('com.acme.push', backendFingerprint(NEEDS));
    expect(isExtensionBackendApplied(copy, project)).toBe(true);
    expect(isExtensionBackendPending(copy, project)).toBe(false);
    expect(installedExtensionRecords([copy], new Set(), project).map((record) => record.manifest.id))
      .toEqual(['com.acme.push']);
  });

  it('o projeto roda OUTRO fingerprint da extensão: continua pendente — a versão nova pede deploy', () => {
    const copy = extension('com.acme.push', {}, NEEDS);
    const project = projectWith('com.acme.push', backendFingerprint({ functions: ['integracaoSync', 'integracaoRenew'] }));
    expect(isExtensionBackendPending(copy, project)).toBe(true);
  });

  it('o fingerprint igual de OUTRA extensão não libera esta', () => {
    const copy = extension('com.acme.push', {}, NEEDS);
    expect(isExtensionBackendPending(copy, projectWith('com.acme.outra', backendFingerprint(NEEDS)))).toBe(true);
  });

  it('o código empacotado entra no fingerprint: o projeto rodando outro hash não libera', () => {
    const copy = extension('com.acme.push', {
      package: {
        manifest: { id: 'com.acme.push', version: '1.0.0', kernel: '^2.0.0', name: 'com.acme.push', backend: NEEDS },
        summary: '',
        workflows: [],
        backendSource: { files: {}, hash: 'novo' },
      } as InstalledExtension['package'],
    }, NEEDS);
    expect(isExtensionBackendPending(copy, projectWith('com.acme.push', backendFingerprint(NEEDS, 'antigo')))).toBe(true);
    expect(isExtensionBackendPending(copy, projectWith('com.acme.push', backendFingerprint(NEEDS, 'novo')))).toBe(false);
  });

  it('liberada pelo projeto, o motivo de uma recusa antiga não aparece', () => {
    const copy = extension('com.acme.push', {
      backendPending: { fingerprint: backendFingerprint(NEEDS), reason: 'awaiting-approval', functions: [], recordedAt: new Date() },
    } as Partial<InstalledExtension>, NEEDS);
    expect(extensionBackendPendingCause(copy, null)).not.toBeNull();
    expect(extensionBackendPendingCause(copy, projectWith('com.acme.push', backendFingerprint(NEEDS)))).toBeNull();
  });
});
