import type { AppliedMigration, ExtensionMigrationState, MigrationFailure } from '../entities/ExtensionMigration';

/**
 * O histórico de migração das extensões de um escritório
 * (`tenants/{tenantId}/extension_migrations/{pluginId}`).
 *
 * `claim` é a única operação que precisa ser TRANSACIONAL: ela reserva a execução e devolve `false`
 * quando outra já está em curso e ainda não expirou. As demais são acumulativas de propósito —
 * `recordApplied` acrescenta uma migração ao conjunto sem reescrever as anteriores, para que uma
 * falha na terceira migração não apague o registro das duas que passaram.
 */
export interface IExtensionMigrationRepository {
  subscribe(tenantId: string, onChange: (states: ExtensionMigrationState[]) => void): () => void;
  get(tenantId: string, pluginId: string): Promise<ExtensionMigrationState | null>;
  claim(tenantId: string, pluginId: string, runId: string, by: string, staleBefore: Date): Promise<boolean>;
  release(tenantId: string, pluginId: string): Promise<void>;
  recordApplied(tenantId: string, pluginId: string, applied: AppliedMigration[]): Promise<void>;
  recordFailure(tenantId: string, pluginId: string, failure: MigrationFailure | null): Promise<void>;
}
