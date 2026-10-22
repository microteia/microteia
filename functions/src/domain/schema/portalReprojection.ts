// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/portalReprojection.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A passada que refaz as projeções de UMA coleção do portal depois que uma declaração mudou — o estado
 * gravado em `portal_reprojections/{coleção}`. Quem anda com ela é o servidor, por rodadas: cada uma
 * reserva o job, processa uma página a partir do `cursor` e fecha gravando o cursor novo, e é essa
 * gravação que dispara a rodada seguinte. O app só a lê, para mostrar o andamento.
 */
export interface PortalReprojectionState {
  status: 'running' | 'done';
  /** Sobe a cada passada nova: a rodada de uma passada abandonada é descartada ao fechar. */
  generation: number;
  round: number;
  /** O id do último registro (ou projeção) processado; `null` = do começo. */
  cursor: string | null;
  /** Até quando a rodada em curso é dona do job — em ms. */
  leaseUntil: number | null;
  /** A última gravação no job, em ms: passada sem gravação há muito tempo está parada. */
  touchedAt: number;
  /** Quantos a passada tem a percorrer, contados ao abri-la; `null` quando a contagem falhou. */
  total: number | null;
  processed: number;
  failed: number;
  failedIds: string[];
  /** Quantas vezes a passada recomeçou por falha. */
  attempts: number;
}

/** Passada em curso sem gravação no job há mais que isto está parada — e a próxima conferência a acorda. */
export const PORTAL_REPROJECTION_STALL_MS = 10 * 60_000;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** O documento lido com desconfiança: o que faltar vale o começo de uma passada encerrada. */
export const readPortalReprojectionState = (data: Record<string, unknown>): PortalReprojectionState => ({
  status: data.status === 'running' ? 'running' : 'done',
  generation: numberOr(data.generation, 0),
  round: numberOr(data.round, 0),
  cursor: typeof data.cursor === 'string' && data.cursor !== '' ? data.cursor : null,
  leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  touchedAt: numberOr(data.touchedAt, 0),
  total: typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : null,
  processed: numberOr(data.processed, 0),
  failed: numberOr(data.failed, 0),
  failedIds: Array.isArray(data.failedIds) ? data.failedIds.filter((id): id is string => typeof id === 'string') : [],
  attempts: numberOr(data.attempts, 0),
});

/** Parada: em curso, sem gravação há mais que `PORTAL_REPROJECTION_STALL_MS` e sem reserva válida. */
export const isPortalReprojectionStalled = (state: PortalReprojectionState, now: number): boolean =>
  state.status === 'running'
  && now - state.touchedAt > PORTAL_REPROJECTION_STALL_MS
  && (state.leaseUntil === null || state.leaseUntil <= now);
