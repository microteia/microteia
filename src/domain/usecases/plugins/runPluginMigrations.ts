import type { AppliedMigration, MigrationFailure } from '../../entities/ExtensionMigration';
import type { IExtensionMigrationRepository } from '../../repositories/IExtensionMigrationRepository';
import type { RunScriptResult } from '../../repositories/IScriptRepository';
import type { PluginMigration } from '../../schema/plugin/migration';
import { migrationMaxRounds } from '../../schema/plugin/migration';
import type { TranspileScriptResult } from '../../services/scriptSource';
import { MIGRATION_LOCK_STALE_MS, baselineRecords } from '../../services/pluginMigrations';
import type { LifecycleActor } from '../../services/pluginLifecycle';

/**
 * Executa a fila de migração de uma extensão no escritório corrente.
 *
 * O executor é o sandbox QuickJS, pela callable que já existe (`runScript`, que recebe o código
 * compilado no payload) — nenhuma Cloud Function nova, nenhuma lista de deploy, nada a aplicar no
 * projeto Firebase de quem já instalou. Os limites do sandbox (25 gravações, 10s de parede) são o
 * motivo do LOTE: a migração processa um pedaço e devolve `{ remaining, changed }`, e este runner a
 * reinvoca até `remaining` zerar.
 *
 * As portas entram por injeção para que o runner seja testável sem Firebase e sem WebAssembly.
 */
export interface MigrationRunnerDeps {
  transpile: (sourceTs: string) => TranspileScriptResult;
  run: (compiledJs: string, providedParams: Record<string, unknown>) => Promise<RunScriptResult>;
  repository: IExtensionMigrationRepository;
}

export interface MigrationRunContext {
  pluginId: string;
  /** Versão que está sendo instalada — vai ao script para que ele saiba de onde e para onde vai. */
  toVersion: string;
  fromVersion: string | null;
  /**
   * `chaveDeTemplate → coleção instalada`. A migração NÃO pode escrever o nome da coleção à mão: a
   * chave declarada no pacote é reivindicada na instalação e ganha sufixo se o nome já estiver
   * ocupado no escritório de destino — enquanto telas e automações são reescritas na materialização,
   * o código de uma migração é texto opaco, e ninguém o reescreveria. Daí o mapa chegar como dado.
   */
  collections: Record<string, string>;
  actor: LifecycleActor;
}

export type MigrationRunOutcome =
  | { ok: true; applied: AppliedMigration[] }
  | { ok: false; applied: AppliedMigration[]; failure: MigrationFailure };

const numberOf = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * O erro que vem do sandbox já pode ser uma REFERÊNCIA de mensagem (`@core.automation/script.timeout`).
 * Nesse caso ela é usada como está; um erro cru de JavaScript entra como detalhe de uma frase nossa,
 * porque interpolar uma referência dentro de outra deixaria o `@…` visível na tela.
 */
const failureFrom = (migration: PluginMigration, detail: string, at: Date): MigrationFailure =>
  detail.startsWith('@')
    ? { migrationId: migration.id, message: detail, messageParams: { name: migration.name }, at }
    : {
      migrationId: migration.id,
      message: '@core.marketplace/migration.error.failed',
      messageParams: { name: migration.name, detail },
      at,
    };

type RunOneResult = { applied: AppliedMigration } | { failure: MigrationFailure };

const runOne = async (
  deps: MigrationRunnerDeps,
  migration: PluginMigration,
  ctx: MigrationRunContext,
): Promise<RunOneResult> => {
  const { actor } = ctx;
  const compiled = deps.transpile(migration.sourceTs);
  if ('error' in compiled) return { failure: failureFrom(migration, compiled.error, actor.now) };

  const maxRounds = migrationMaxRounds(migration);
  let changedTotal = 0;
  let previousRemaining = Number.POSITIVE_INFINITY;

  for (let round = 0; round < maxRounds; round += 1) {
    const result = await deps.run(compiled.compiledJs, {
      round,
      pluginId: ctx.pluginId,
      migrationId: migration.id,
      fromVersion: ctx.fromVersion ?? '',
      toVersion: ctx.toVersion,
      collections: ctx.collections,
    });
    if (result.error) return { failure: failureFrom(migration, result.error, actor.now) };

    const outputs = result.outputs ?? {};
    const changed = numberOf(outputs.changed);
    const remaining = numberOf(outputs.remaining);
    changedTotal += changed;

    if (remaining <= 0) {
      return {
        applied: {
          id: migration.id,
          version: migration.version,
          appliedAt: actor.now,
          appliedBy: actor.userId,
          rounds: round + 1,
          changed: changedTotal,
        },
      };
    }
    /**
     * Diz que falta e não andou: o lote está preso, e insistir só gastaria as rodadas restantes até
     * o teto. Parar aqui é o que transforma um laço infinito num erro que se lê.
     */
    if (changed <= 0 && remaining >= previousRemaining) {
      return {
        failure: {
          migrationId: migration.id,
          message: '@core.marketplace/migration.error.no-progress',
          messageParams: { name: migration.name, remaining: String(remaining) },
          at: actor.now,
        },
      };
    }
    previousRemaining = remaining;
  }

  return {
    failure: {
      migrationId: migration.id,
      message: '@core.marketplace/migration.error.max-rounds',
      messageParams: { name: migration.name, rounds: String(maxRounds) },
      at: actor.now,
    },
  };
};

/**
 * Roda a fila EM ORDEM e para na primeira que falhar — as seguintes assumem o estado que ela deveria
 * ter deixado. Cada migração que passa é gravada na hora: uma falha na terceira não pode apagar o
 * registro das duas que já converteram dado.
 */
export const runMigrationQueue = async (
  deps: MigrationRunnerDeps,
  migrations: PluginMigration[],
  ctx: MigrationRunContext,
): Promise<MigrationRunOutcome> => {
  const applied: AppliedMigration[] = [];

  for (const migration of migrations) {
    const result = await runOne(deps, migration, ctx);
    if ('failure' in result) {
      await deps.repository.recordFailure(ctx.actor.tenantId, ctx.pluginId, result.failure);
      return { ok: false, applied, failure: result.failure };
    }
    await deps.repository.recordApplied(ctx.actor.tenantId, ctx.pluginId, [result.applied]);
    applied.push(result.applied);
  }

  if (migrations.length > 0) await deps.repository.recordFailure(ctx.actor.tenantId, ctx.pluginId, null);
  return { ok: true, applied };
};

/** Carimba como aplicada a fila que uma instalação NOVA não precisa rodar. */
export const recordMigrationBaseline = async (
  deps: MigrationRunnerDeps,
  migrations: PluginMigration[],
  ctx: MigrationRunContext,
): Promise<AppliedMigration[]> => {
  if (migrations.length === 0) return [];
  const records = baselineRecords(migrations, ctx.actor.userId, ctx.actor.now);
  await deps.repository.recordApplied(ctx.actor.tenantId, ctx.pluginId, records);
  return records;
};

export const claimMigrationRun = (
  deps: MigrationRunnerDeps,
  ctx: MigrationRunContext,
  runId: string,
): Promise<boolean> =>
  deps.repository.claim(
    ctx.actor.tenantId,
    ctx.pluginId,
    runId,
    ctx.actor.userId,
    new Date(ctx.actor.now.getTime() - MIGRATION_LOCK_STALE_MS),
  );

export const releaseMigrationRun = (deps: MigrationRunnerDeps, ctx: MigrationRunContext): Promise<void> =>
  deps.repository.release(ctx.actor.tenantId, ctx.pluginId);
