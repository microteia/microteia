import type { AppliedMigration, ExtensionMigrationState } from '../entities/ExtensionMigration';
import type { MigrationPhase, PluginMigration } from '../schema/plugin/migration';
import { isMigrationRequired, migrationPhaseOf, migrationRunsOnInstall, sortMigrations } from '../schema/plugin/migration';

/**
 * Regras PURAS da fila de migração: recebem a fila declarada e o que o escritório já aplicou, e
 * devolvem o que rodar, em que ordem e o que apenas carimbar. Nunca lançam, nunca tocam I/O — o
 * runner orquestra sandbox e repositório em volta disto, do mesmo jeito que os use cases orquestram
 * em volta de `pluginLifecycle`.
 */

/** Tempo após o qual uma reserva de execução é considerada abandonada (aba fechada no meio). */
export const MIGRATION_LOCK_STALE_MS = 5 * 60 * 1000;

export const appliedMigrationIds = (state: ExtensionMigrationState | null | undefined): ReadonlySet<string> =>
  new Set((state?.applied ?? []).map((applied) => applied.id));

export interface MigrationPlan {
  /** Rodam ANTES da convergência dos artefatos — enquanto o campo antigo ainda existe na tela. */
  before: PluginMigration[];
  /** Rodam DEPOIS — o caso normal, com os campos novos já declarados. */
  after: PluginMigration[];
  /**
   * Carimbadas como aplicadas SEM rodar. É a instalação nova: migração conserta dado escrito por uma
   * versão anterior desta extensão, e num escritório que instala agora esse dado não existe.
   */
  baseline: PluginMigration[];
}

export interface MigrationPlanInput {
  migrations: PluginMigration[] | undefined;
  appliedIds: ReadonlySet<string>;
  /** Nenhuma cópia desta extensão existia no escritório antes desta operação. */
  freshInstall: boolean;
}

export const planPluginMigrations = ({ migrations, appliedIds, freshInstall }: MigrationPlanInput): MigrationPlan => {
  const pending = sortMigrations(migrations ?? []).filter((migration) => !appliedIds.has(migration.id));
  const toRun = freshInstall ? pending.filter(migrationRunsOnInstall) : pending;
  const baseline = freshInstall ? pending.filter((migration) => !migrationRunsOnInstall(migration)) : [];
  const ofPhase = (phase: MigrationPhase) => toRun.filter((migration) => migrationPhaseOf(migration) === phase);

  return { before: ofPhase('before'), after: ofPhase('after'), baseline };
};

/** A fila que este escritório ainda deve — o que a tela de Extensões mostra e o runner retenta. */
export const pendingPluginMigrations = (
  migrations: PluginMigration[] | undefined,
  state: ExtensionMigrationState | null | undefined,
): PluginMigration[] => {
  const applied = appliedMigrationIds(state);
  return sortMigrations(migrations ?? []).filter((migration) => !applied.has(migration.id));
};

/**
 * Falta migração OBRIGATÓRIA. É o que mantém a extensão fora do boot — mesma decisão do
 * `backendState`: uma extensão que rodasse sobre dado que ela própria considera inconsistente
 * obrigaria cada tela dela a tolerar os dois formatos para sempre.
 */
export const hasBlockingMigrations = (
  migrations: PluginMigration[] | undefined,
  state: ExtensionMigrationState | null | undefined,
): boolean => pendingPluginMigrations(migrations, state).some(isMigrationRequired);

/**
 * A reserva de execução pode ser tomada: não há nenhuma, ou a que existe começou antes do corte de
 * expiração. Sem a expiração, uma aba fechada no meio travaria a extensão para sempre.
 */
export const canClaimMigrationLock = (
  state: ExtensionMigrationState | null | undefined,
  staleBefore: Date,
): boolean => {
  const lock = state?.lock;
  if (!lock) return true;
  return lock.startedAt.getTime() < staleBefore.getTime();
};

export const baselineRecords = (
  migrations: PluginMigration[],
  userId: string,
  now: Date,
): AppliedMigration[] =>
  migrations.map((migration) => ({
    id: migration.id,
    version: migration.version,
    appliedAt: now,
    appliedBy: userId,
    rounds: 0,
    changed: 0,
  }));
