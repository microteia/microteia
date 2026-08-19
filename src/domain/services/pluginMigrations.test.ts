import { describe, expect, it } from 'vitest';
import {
  MIGRATION_LOCK_STALE_MS,
  appliedMigrationIds,
  baselineRecords,
  canClaimMigrationLock,
  hasBlockingMigrations,
  pendingPluginMigrations,
  planPluginMigrations,
} from './pluginMigrations';
import type { ExtensionMigrationState } from '../entities/ExtensionMigration';
import type { PluginMigration } from '../schema/plugin/migration';

const NOW = new Date('2026-08-19T12:00:00.000Z');

const migration = (overrides: Partial<PluginMigration> = {}): PluginMigration => ({
  id: 'um',
  version: '1.1.0',
  name: 'Uma migração',
  sourceTs: 'main()',
  ...overrides,
});

const state = (overrides: Partial<ExtensionMigrationState> = {}): ExtensionMigrationState => ({
  pluginId: 'com.acme.x',
  tenantId: 't1',
  applied: [],
  ...overrides,
});

const applied = (id: string) => ({ id, version: '1.0.0', appliedAt: NOW, appliedBy: 'u1', rounds: 1, changed: 3 });

describe('fila de migração de extensão', () => {
  describe('planejamento', () => {
    it('atualização roda tudo o que ainda não foi aplicado, em ordem, separado por fase', () => {
      const plan = planPluginMigrations({
        migrations: [
          migration({ id: 'a', version: '1.1.0' }),
          migration({ id: 'b', version: '1.2.0', phase: 'before' }),
          migration({ id: 'c', version: '1.3.0' }),
        ],
        appliedIds: new Set(['a']),
        freshInstall: false,
      });
      expect(plan.before.map((m) => m.id)).toEqual(['b']);
      expect(plan.after.map((m) => m.id)).toEqual(['c']);
      expect(plan.baseline).toEqual([]);
    });

    /** O ponto todo do desenho: instalação nova não tem dado de versão anterior para consertar. */
    it('instalação nova carimba a fila como aplicada sem rodar nada', () => {
      const plan = planPluginMigrations({
        migrations: [migration({ id: 'a' }), migration({ id: 'b', version: '1.2.0' })],
        appliedIds: new Set(),
        freshInstall: true,
      });
      expect(plan.before).toEqual([]);
      expect(plan.after).toEqual([]);
      expect(plan.baseline.map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('mas roda na instalação nova a que preenche dado que já estava no escritório', () => {
      const plan = planPluginMigrations({
        migrations: [migration({ id: 'a' }), migration({ id: 'backfill', version: '1.2.0', runOnInstall: true })],
        appliedIds: new Set(),
        freshInstall: true,
      });
      expect(plan.after.map((m) => m.id)).toEqual(['backfill']);
      expect(plan.baseline.map((m) => m.id)).toEqual(['a']);
    });

    /**
     * O caso que o intervalo de versões perderia: a migração é acrescentada depois a uma versão
     * antiga, e o escritório já está numa versão maior. Pela identidade, ela ainda roda.
     */
    it('migração acrescentada a uma versão já instalada continua pendente', () => {
      const plan = planPluginMigrations({
        migrations: [migration({ id: 'esquecida', version: '1.0.0' })],
        appliedIds: new Set(['outra']),
        freshInstall: false,
      });
      expect(plan.after.map((m) => m.id)).toEqual(['esquecida']);
    });

    it('extensão sem migração não planeja nada', () => {
      const plan = planPluginMigrations({ migrations: undefined, appliedIds: new Set(), freshInstall: false });
      expect(plan).toEqual({ before: [], after: [], baseline: [] });
    });
  });

  describe('pendência', () => {
    it('lê o conjunto aplicado do estado gravado', () => {
      expect([...appliedMigrationIds(state({ applied: [applied('a')] }))]).toEqual(['a']);
      expect([...appliedMigrationIds(null)]).toEqual([]);
    });

    it('pendente é o que a fila declara e o escritório não aplicou', () => {
      const migrations = [migration({ id: 'a' }), migration({ id: 'b', version: '1.2.0' })];
      expect(pendingPluginMigrations(migrations, state({ applied: [applied('a')] })).map((m) => m.id)).toEqual(['b']);
    });

    it('só migração obrigatória mantém a extensão fora do boot', () => {
      expect(hasBlockingMigrations([migration()], null)).toBe(true);
      expect(hasBlockingMigrations([migration({ required: false })], null)).toBe(false);
      expect(hasBlockingMigrations([migration()], state({ applied: [applied('um')] }))).toBe(false);
    });

    it('extensão sem migração nunca bloqueia', () => {
      expect(hasBlockingMigrations(undefined, null)).toBe(false);
    });
  });

  describe('reserva de execução', () => {
    it('livre quando não há reserva', () => {
      expect(canClaimMigrationLock(null, NOW)).toBe(true);
    });

    it('ocupada enquanto a reserva é recente', () => {
      const lock = { runId: 'r1', startedAt: NOW, by: 'u1' };
      const staleBefore = new Date(NOW.getTime() - MIGRATION_LOCK_STALE_MS);
      expect(canClaimMigrationLock(state({ lock }), staleBefore)).toBe(false);
    });

    it('reserva abandonada expira — aba fechada no meio não trava a extensão para sempre', () => {
      const lock = { runId: 'r1', startedAt: new Date(NOW.getTime() - 2 * MIGRATION_LOCK_STALE_MS), by: 'u1' };
      const staleBefore = new Date(NOW.getTime() - MIGRATION_LOCK_STALE_MS);
      expect(canClaimMigrationLock(state({ lock }), staleBefore)).toBe(true);
    });
  });

  it('o baseline registra que nada rodou', () => {
    expect(baselineRecords([migration({ id: 'a' })], 'u1', NOW)).toEqual([
      { id: 'a', version: '1.1.0', appliedAt: NOW, appliedBy: 'u1', rounds: 0, changed: 0 },
    ]);
  });
});
