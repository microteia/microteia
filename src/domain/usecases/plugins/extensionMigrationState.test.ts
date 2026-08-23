import { describe, expect, it } from 'vitest';
import {
  extensionMigrationError,
  isExtensionMigrationPending,
  pendingExtensionMigrations,
} from './extensionMigrationState';
import { installedExtensionRecords } from './installedExtensionRecords';
import type { ExtensionMigrationState } from '../../entities/ExtensionMigration';
import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PluginMigration } from '../../schema/plugin/migration';

const NOW = new Date('2026-08-19T12:00:00.000Z');

const migration = (overrides: Partial<PluginMigration> = {}): PluginMigration => ({
  id: 'um',
  version: '1.1.0',
  name: 'Uma migração',
  sourceTs: 'main()',
  ...overrides,
});

const extension = (id: string, migrations?: PluginMigration[]): InstalledExtension => {
  const pkg: MarketplacePlugin = {
    manifest: { id, version: '1.1.0', kernel: '^2.0.0', name: id },
    summary: 's',
    workflows: [],
    ...(migrations ? { migrations } : {}),
  };
  return {
    id,
    tenantId: 't1',
    active: true,
    package: pkg,
    source: 'builtin',
    installedVersion: '1.1.0',
    authorId: 'u1',
    authorName: 'Autor',
    authorPhotoURL: null,
    installedBy: 'u1',
    installedAt: NOW,
    updatedAt: NOW,
  };
};

const states = (...entries: ExtensionMigrationState[]) =>
  new Map(entries.map((state) => [state.pluginId, state]));

const state = (pluginId: string, appliedIds: string[], lastError?: ExtensionMigrationState['lastError']): ExtensionMigrationState => ({
  pluginId,
  tenantId: 't1',
  applied: appliedIds.map((id) => ({ id, version: '1.1.0', appliedAt: NOW, appliedBy: 'u1', rounds: 1, changed: 2 })),
  lastError: lastError ?? null,
});

describe('pendência de migração da extensão instalada', () => {
  it('extensão sem migração nunca fica pendente', () => {
    expect(isExtensionMigrationPending(extension('com.a'), states())).toBe(false);
  });

  it('migração declarada e não aplicada deixa a extensão pendente', () => {
    expect(isExtensionMigrationPending(extension('com.a', [migration()]), states())).toBe(true);
    expect(isExtensionMigrationPending(extension('com.a', [migration()]), states(state('com.a', ['um'])))).toBe(false);
  });

  it('lista o que falta', () => {
    const ext = extension('com.a', [migration({ id: 'um' }), migration({ id: 'dois', version: '1.2.0' })]);
    expect(pendingExtensionMigrations(ext, states(state('com.a', ['um']))).map((m) => m.id)).toEqual(['dois']);
  });

  it('devolve o erro da última tentativa, para a tela explicar por que não subiu', () => {
    const failure = { migrationId: 'um', message: '@core.marketplace/migration.error.failed', at: NOW };
    expect(extensionMigrationError(extension('com.a', [migration()]), states(state('com.a', [], failure))))
      .toEqual(failure);
    expect(extensionMigrationError(extension('com.a'), states())).toBeNull();
  });

  /**
   * A consequência que importa: pendente NÃO entra no Kernel do escritório. É a mesma decisão do
   * `backendState` — deixar as telas subirem sobre dado no formato antigo obrigaria a extensão a
   * tolerar os dois formatos para sempre.
   */
  describe('efeito no boot do escritório', () => {
    it('exclui a extensão com migração pendente', () => {
      const ext = extension('com.a', [migration()]);
      expect(installedExtensionRecords([ext], new Set(), new Set(['com.a']))).toEqual([]);
      expect(installedExtensionRecords([ext], new Set(), new Set())).toHaveLength(1);
    });

    it('sem conjunto de pendentes, quem não declara migração entra normalmente', () => {
      expect(installedExtensionRecords([extension('com.a')], new Set())).toHaveLength(1);
    });
  });
});
