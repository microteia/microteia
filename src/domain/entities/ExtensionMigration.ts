import type { LocalizedMessage } from '../schema/i18n/localizedMessage';

/**
 * Uma migração que JÁ RODOU neste escritório. É a identidade (`id`) que fica gravada, nunca um
 * intervalo de versões: assim uma migração acrescentada depois a uma versão antiga ainda roda, uma
 * que falhou é retentada sem inventar número, e o escritório que salta da 1.5.0 para a 1.10.0 aplica
 * exatamente o que lhe falta.
 */
export interface AppliedMigration {
  id: string;
  version: string;
  appliedAt: Date;
  appliedBy: string;
  /** Quantas rodadas o lote precisou — e `0` quando a instalação apenas carimbou o baseline. */
  rounds: number;
  /** Registros alterados, somando as rodadas. É o que a auditoria da migração tem de mostrar. */
  changed: number;
}

export interface MigrationFailure extends LocalizedMessage {
  migrationId: string;
  at: Date;
}

/**
 * Reserva de execução. Dois admins clicando "Atualizar" ao mesmo tempo (ou o mesmo admin em duas
 * abas) rodariam a mesma migração em paralelo; idempotência salvaria o dado, mas não o desperdício
 * nem os limites do sandbox. A trava expira sozinha — uma aba fechada no meio não pode deixar a
 * extensão travada para sempre.
 */
export interface MigrationLock {
  runId: string;
  startedAt: Date;
  by: string;
}

/**
 * O histórico de migração de uma extensão NESTE escritório, em
 * `tenants/{tenantId}/extension_migrations/{pluginId}`.
 *
 * Coleção própria, e não um campo da cópia instalada, por três razões: o documento da instalação é
 * reescrito INTEIRO a cada atualização (`package` incluso); o histórico precisa SOBREVIVER à
 * desinstalação, porque o dado migrado sobrevive — sem isso, reinstalar depois reexecutaria tudo
 * sobre dado já convertido; e "o que esta extensão fez com os dados do escritório" é uma pergunta
 * cuja resposta vale por si, mesmo quando a extensão já não está mais lá.
 */
export interface ExtensionMigrationState {
  pluginId: string;
  tenantId: string;
  applied: AppliedMigration[];
  lastError?: MigrationFailure | null;
  lock?: MigrationLock | null;
}
