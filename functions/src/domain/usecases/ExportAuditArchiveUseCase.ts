import type { IAuditRetentionRepository, StoredAuditRetention } from '../repositories/IAuditRetentionRepository';
import type { IAuditArchiveStore } from '../repositories/IAuditArchiveStore';
import type { IAuditLogDaySource } from '../repositories/IAuditLogDaySource';
import type { CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type { DispatchNotificationUseCase } from './DispatchNotificationUseCase';
import type {
  AuditArchiveFailure,
  AuditArchiveProtection,
  AuditArchiveState,
  AuditChainLink,
} from '../schema/auditRetention';
import {
  auditArchivePath,
  auditDayStart,
  isAuditDayStillComplete,
  lastClosedAuditDay,
  nextAuditDay,
} from '../schema/auditRetention';
import { buildAuditArchiveDay, checkAuditArchiveDay } from '../services/auditArchiveChain';
import type { Sha256 } from '../services/auditArchiveChain';
import { auditArchiveFailureLog, auditArchiveFailureNotice } from '../services/auditArchiveNotice';

/** Uma falha que persiste volta a avisar a cada 24 h — nem uma vez só, nem a cada tentativa. */
export const AUDIT_ARCHIVE_REALERT_MS = 24 * 60 * 60 * 1000;

export const AUDIT_ARCHIVE_UNAVAILABLE = '@core.admin/audit.archive.unavailable';
export const AUDIT_ARCHIVE_CONFLICT = '@core.admin/audit.archive.conflict';

export interface ExportAuditArchiveDeps {
  retention: IAuditRetentionRepository;
  logs: IAuditLogDaySource;
  store: IAuditArchiveStore;
  sha256: Sha256;
  now: () => Date;
  audit: CreateAuditLogUseCase;
  dispatch: DispatchNotificationUseCase;
  warn: (message: string, detail?: unknown) => void;
}

export interface ExportAuditArchiveResult {
  tenants: number;
  exported: number;
  failed: number;
  /** Algum escritório ficou com dia por exportar porque o tempo acabou. */
  pending: boolean;
}

export type ExportAuditArchiveUseCase = {
  execute: (input: { outOfTime: () => boolean }) => Promise<ExportAuditArchiveResult>;
};

class AuditArchiveExportError extends Error {}

const addYears = (instant: Date, years: number): Date => {
  const result = new Date(instant.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
};

/**
 * De onde a exportação continua: o dia seguinte ao último exportado — ou, quando o arquivo foi
 * religado depois de um período desligado, o dia em que foi religado. O elo com o último dia
 * exportado vale nos dois casos, e é ele que faz o período desligado aparecer como LACUNA declarada.
 */
const resumePoint = (state: AuditArchiveState, lastClosed: string): { from: string; previous: AuditChainLink | null } => {
  const previous = state.lastDay && state.headHash ? { day: state.lastDay, dayHash: state.headHash } : null;
  const start = state.startDay ?? lastClosed;
  if (!previous) return { from: start, previous: null };
  const afterLast = nextAuditDay(previous.day);
  return { from: afterLast > start ? afterLast : start, previous };
};

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * A exportação diária do arquivo. Visita só os escritórios com o arquivo ligado; para cada um, exporta
 * em ordem todo dia fechado que falta — o que faz a falha de hoje ser refeita na próxima execução, sem
 * fila nenhuma: o que falta é derivado de `lastDay`.
 *
 * Gravar é idempotente. O arquivo de um dia é função das linhas e do elo anterior; se ele já existe com
 * o mesmo conteúdo (a execução anterior gravou e caiu antes de salvar o estado), segue em frente. Se
 * existe com OUTRO, nada é sobrescrito e a exportação daquele escritório PARA, com alerta: alguém mais
 * grava naquele bucket, e seguir encadeando em cima de um arquivo que não fomos nós que escrevemos
 * esconderia isso.
 */
export const makeExportAuditArchiveUseCase = (deps: ExportAuditArchiveDeps): ExportAuditArchiveUseCase => {
  const exportDay = async (
    entry: StoredAuditRetention,
    day: string,
    previous: AuditChainLink | null,
    protection: AuditArchiveProtection | null,
  ): Promise<AuditChainLink> => {
    const start = auditDayStart(day);
    const end = auditDayStart(nextAuditDay(day));
    const logs = await deps.logs.logsBetween(entry.tenantId, start, end);
    const built = buildAuditArchiveDay(
      { tenantId: entry.tenantId, day, previous, logs, complete: isAuditDayStillComplete(day, deps.now()) },
      deps.sha256,
    );
    const retainUntil = protection?.objectRetentionLock ? addYears(end, entry.policy.archive.retentionYears) : null;
    const path = auditArchivePath(entry.tenantId, day);
    const result = await deps.store.put(path, built.content, retainUntil);
    if (result !== 'conflict') return { day, dayHash: built.header.dayHash };

    // O MESMO dia, gravado por uma execução nossa que só diferia em `complete` (ela rodou antes de o
    // dia completar 30 dias; esta, depois). As linhas e o elo são os mesmos: é o nosso arquivo.
    const existing = checkAuditArchiveDay(
      { tenantId: entry.tenantId, day, expected: previous, content: await deps.store.read(path) },
      deps.sha256,
    );
    const sameLines = existing.ok
      && existing.parsed.lines.map((line) => line.hash).join() === built.lines.map((line) => line.hash).join();
    if (existing.ok && sameLines) return { day, dayHash: existing.parsed.header.dayHash };
    throw new AuditArchiveExportError(AUDIT_ARCHIVE_CONFLICT);
  };

  const recordFailure = async (entry: StoredAuditRetention, day: string, error: unknown): Promise<void> => {
    const now = deps.now();
    const previous = entry.state.failure?.day === day ? entry.state.failure : null;
    const alert = !previous || now.getTime() - Date.parse(previous.lastAlertedAt) >= AUDIT_ARCHIVE_REALERT_MS;
    const failure: AuditArchiveFailure = {
      day,
      message: messageOf(error),
      attempts: (previous?.attempts ?? 0) + 1,
      firstFailedAt: previous?.firstFailedAt ?? now.toISOString(),
      lastAlertedAt: alert ? now.toISOString() : previous!.lastAlertedAt,
    };
    await deps.retention.saveState(entry.tenantId, { ...entry.state, failure });
    if (!alert) return;
    // O alerta não pode derrubar a exportação dos outros escritórios: cada um falha sozinho.
    await deps.audit.execute(auditArchiveFailureLog(entry.tenantId, failure))
      .catch((alertError: unknown) => deps.warn('[audit-archive] could not record the alert', alertError));
    await deps.dispatch.execute(auditArchiveFailureNotice(entry.tenantId, failure))
      .catch((alertError: unknown) => deps.warn('[audit-archive] could not send the notice', alertError));
  };

  return {
    execute: async ({ outOfTime }) => {
      const archiving = await deps.retention.listArchiving();
      const result: ExportAuditArchiveResult = { tenants: archiving.length, exported: 0, failed: 0, pending: false };
      if (archiving.length === 0) return result;

      let protection: AuditArchiveProtection | null = null;
      if (deps.store.isConfigured()) {
        protection = await deps.store.protection().catch((error: unknown) => {
          deps.warn('[audit-archive] could not read the bucket protection', error);
          return null;
        });
      }

      for (const entry of archiving) {
        const lastClosed = lastClosedAuditDay(deps.now());
        let { from: day, previous } = resumePoint(entry.state, lastClosed);
        let state = entry.state;

        while (day <= lastClosed) {
          if (outOfTime()) {
            result.pending = true;
            break;
          }
          try {
            if (!deps.store.isConfigured()) throw new AuditArchiveExportError(AUDIT_ARCHIVE_UNAVAILABLE);
            previous = await exportDay({ ...entry, state }, day, previous, protection);
            state = {
              ...state,
              startDay: state.startDay ?? day,
              firstDay: state.firstDay ?? day,
              lastDay: previous.day,
              headHash: previous.dayHash,
              lastExportedAt: deps.now().toISOString(),
              failure: null,
            };
            await deps.retention.saveState(entry.tenantId, state);
            result.exported += 1;
            day = nextAuditDay(day);
          } catch (error) {
            result.failed += 1;
            await recordFailure({ ...entry, state }, day, error);
            break;
          }
        }
      }
      return result;
    },
  };
};
