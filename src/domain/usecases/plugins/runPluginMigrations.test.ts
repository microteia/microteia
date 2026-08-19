import { describe, expect, it, vi } from 'vitest';
import {
  claimMigrationRun,
  recordMigrationBaseline,
  runMigrationQueue,
  type MigrationRunContext,
  type MigrationRunnerDeps,
} from './runPluginMigrations';
import { MIGRATION_LOCK_STALE_MS } from '../../services/pluginMigrations';
import type { AppliedMigration, ExtensionMigrationState, MigrationFailure } from '../../entities/ExtensionMigration';
import type { IExtensionMigrationRepository } from '../../repositories/IExtensionMigrationRepository';
import type { PluginMigration } from '../../schema/plugin/migration';
import type { RunScriptResult } from '../../repositories/IScriptRepository';

const NOW = new Date('2026-08-19T12:00:00.000Z');

const ctx: MigrationRunContext = {
  pluginId: 'com.acme.x',
  toVersion: '1.2.0',
  fromVersion: '1.0.0',
  collections: { produto: 'produto2' },
  actor: { tenantId: 't1', userId: 'u1', now: NOW },
};

const migration = (overrides: Partial<PluginMigration> = {}): PluginMigration => ({
  id: 'um',
  version: '1.1.0',
  name: 'Uma migração',
  sourceTs: 'main()',
  ...overrides,
});

const okResult = (outputs: Record<string, unknown>): RunScriptResult => ({ outputs, logs: [], error: null });

interface Recorder {
  applied: AppliedMigration[];
  failures: (MigrationFailure | null)[];
  repository: IExtensionMigrationRepository;
}

const recorder = (state: ExtensionMigrationState | null = null): Recorder => {
  const applied: AppliedMigration[] = [];
  const failures: (MigrationFailure | null)[] = [];
  return {
    applied,
    failures,
    repository: {
      subscribe: () => () => undefined,
      get: () => Promise.resolve(state),
      claim: () => Promise.resolve(true),
      release: () => Promise.resolve(),
      recordApplied: (_t, _p, records) => { applied.push(...records); return Promise.resolve(); },
      recordFailure: (_t, _p, failure) => { failures.push(failure); return Promise.resolve(); },
    },
  };
};

const deps = (
  run: MigrationRunnerDeps['run'],
  repository: IExtensionMigrationRepository,
): MigrationRunnerDeps => ({
  transpile: (sourceTs) => ({ compiledJs: sourceTs }),
  run,
  repository,
});

describe('execução da fila de migração', () => {
  it('roda em lote até `remaining` zerar e soma o que mudou', async () => {
    const remaining = [40, 20, 0];
    const run = vi.fn(() => Promise.resolve(okResult({ remaining: remaining.shift(), changed: 20 })));
    const rec = recorder();

    const outcome = await runMigrationQueue(deps(run, rec.repository), [migration()], ctx);

    expect(outcome.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(3);
    expect(rec.applied).toEqual([
      { id: 'um', version: '1.1.0', appliedAt: NOW, appliedBy: 'u1', rounds: 3, changed: 60 },
    ]);
  });

  it('a rodada, as versões e o mapa de coleções chegam ao script', async () => {
    const run = vi.fn(() => Promise.resolve(okResult({ remaining: 0 })));
    await runMigrationQueue(deps(run, recorder().repository), [migration()], ctx);
    expect(run).toHaveBeenCalledWith('main()', {
      round: 0,
      pluginId: 'com.acme.x',
      migrationId: 'um',
      fromVersion: '1.0.0',
      toVersion: '1.2.0',
      collections: { produto: 'produto2' },
    });
  });

  it('sem `remaining` a migração termina na primeira rodada', async () => {
    const run = vi.fn(() => Promise.resolve(okResult({})));
    const outcome = await runMigrationQueue(deps(run, recorder().repository), [migration()], ctx);
    expect(outcome.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('para na primeira que falha, e preserva o registro das que já passaram', async () => {
    const run = vi.fn()
      .mockResolvedValueOnce(okResult({ remaining: 0, changed: 1 }))
      .mockResolvedValueOnce({ outputs: null, logs: [], error: 'boom' } satisfies RunScriptResult);
    const rec = recorder();

    const outcome = await runMigrationQueue(
      deps(run, rec.repository),
      [migration({ id: 'a' }), migration({ id: 'b', version: '1.2.0' }), migration({ id: 'c', version: '1.3.0' })],
      ctx,
    );

    expect(outcome.ok).toBe(false);
    expect(run).toHaveBeenCalledTimes(2);
    expect(rec.applied.map((a) => a.id)).toEqual(['a']);
    if (!outcome.ok) {
      expect(outcome.failure.migrationId).toBe('b');
      expect(outcome.failure.message).toBe('@core.marketplace/migration.error.failed');
      expect(outcome.failure.messageParams?.detail).toBe('boom');
    }
  });

  /** O sandbox devolve referência de mensagem; interpolá-la deixaria o `@…` visível na tela. */
  it('erro que já é referência de mensagem passa intacto', async () => {
    const run = () => Promise.resolve({ outputs: null, logs: [], error: '@core.automation/script.timeout' } satisfies RunScriptResult);
    const outcome = await runMigrationQueue(deps(run, recorder().repository), [migration()], ctx);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.message).toBe('@core.automation/script.timeout');
  });

  it('falha de transpilação nem chega ao servidor', async () => {
    const run = vi.fn();
    const failing: MigrationRunnerDeps = {
      ...deps(run, recorder().repository),
      transpile: () => ({ error: '@core.automation/script.error.no-modules' }),
    };
    const outcome = await runMigrationQueue(failing, [migration()], ctx);
    expect(run).not.toHaveBeenCalled();
    expect(outcome.ok).toBe(false);
  });

  it('lote preso — diz que falta e não anda — vira erro, não laço infinito', async () => {
    const run = vi.fn(() => Promise.resolve(okResult({ remaining: 10, changed: 0 })));
    const outcome = await runMigrationQueue(deps(run, recorder().repository), [migration()], ctx);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.message).toBe('@core.marketplace/migration.error.no-progress');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('estourar o teto de rodadas é erro — o dado ficou pela metade', async () => {
    let remaining = 100;
    const run = vi.fn(() => Promise.resolve(okResult({ remaining: (remaining -= 1), changed: 1 })));
    const outcome = await runMigrationQueue(deps(run, recorder().repository), [migration({ maxRounds: 3 })], ctx);
    expect(run).toHaveBeenCalledTimes(3);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.failure.message).toBe('@core.marketplace/migration.error.max-rounds');
  });

  it('a fila que passou inteira limpa o erro anterior', async () => {
    const rec = recorder();
    await runMigrationQueue(deps(() => Promise.resolve(okResult({})), rec.repository), [migration()], ctx);
    expect(rec.failures).toEqual([null]);
  });

  it('fila vazia não escreve nada', async () => {
    const rec = recorder();
    const outcome = await runMigrationQueue(deps(() => Promise.resolve(okResult({})), rec.repository), [], ctx);
    expect(outcome).toEqual({ ok: true, applied: [] });
    expect(rec.applied).toEqual([]);
    expect(rec.failures).toEqual([]);
  });

  it('o baseline grava sem rodar nada', async () => {
    const run = vi.fn();
    const rec = recorder();
    const records = await recordMigrationBaseline(deps(run, rec.repository), [migration()], ctx);
    expect(run).not.toHaveBeenCalled();
    expect(records).toEqual(rec.applied);
    expect(rec.applied[0].rounds).toBe(0);
  });

  it('a reserva de execução usa o corte de expiração', async () => {
    const claim = vi.fn(() => Promise.resolve(true));
    const rec = recorder();
    await claimMigrationRun(deps(() => Promise.resolve(okResult({})), { ...rec.repository, claim }), ctx, 'run-1');
    expect(claim).toHaveBeenCalledWith(
      't1', 'com.acme.x', 'run-1', 'u1', new Date(NOW.getTime() - MIGRATION_LOCK_STALE_MS),
    );
  });
});
