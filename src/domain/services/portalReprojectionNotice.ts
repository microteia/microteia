import { isPortalReprojectionStalled } from '../schema/portalReprojection';
import type { PortalReprojectionState } from '../schema/portalReprojection';

/**
 * O que o escritório vê sobre as passadas que atualizam o portal. É INFORMAÇÃO, nunca um gesto: o
 * servidor retoma sozinho o que é dele, e só aparece o que explica o que o convidado vê agora.
 *
 * O andamento é UM só, da leva inteira — as coleções andam uma por vez, e o escritório quer saber quando
 * o portal fica em dia, não a ordem da fila. Por coleção só sai o que pede atenção: a passada parada e a
 * que terminou com falha.
 */
export interface PortalReprojectionProgress {
  /** Chave no catálogo `core.records`. */
  messageKey: string;
  processed: number;
  /** `null` quando alguma contagem falhou ao abrir a passada. */
  total: number | null;
  /** De 0 a 1; `null` sem o total. */
  ratio: number | null;
}

export interface PortalReprojectionWarning {
  collection: string;
  /** Chave no catálogo `core.records`. */
  messageKey: string;
  /** Números crus — quem exibe os formata no idioma de quem lê. */
  counts: { processed: number; failed: number };
}

export interface PortalReprojectionSummary {
  progress: PortalReprojectionProgress | null;
  warnings: PortalReprojectionWarning[];
}

const inFlight = (state: PortalReprojectionState): boolean => state.status === 'running' || state.status === 'queued';

/**
 * A leva é o que está na fila ou andando, mais o que terminou depois que a passada mais antiga dela foi
 * aberta: sem isso, a coleção que termina sairia da soma e o andamento andaria para trás.
 */
const progressOf = (states: readonly PortalReprojectionState[]): PortalReprojectionProgress | null => {
  const pending = states.filter(inFlight);
  if (pending.length === 0) return null;
  const since = Math.min(...pending.map((state) => state.openedAt));
  const wave = states.filter((state) => inFlight(state) || state.touchedAt >= since);

  const processed = wave.reduce((sum, state) => sum + state.processed, 0);
  // Registro criado durante a passada também é percorrido, e o contado ao abrir fica para trás.
  const total = wave.some((state) => state.total === null)
    ? null
    : wave.reduce((sum, state) => sum + Math.max(state.total ?? 0, state.processed), 0);
  if (total === 0) return null;
  return {
    messageKey: total === null ? 'portal.reprojection.progress.count' : 'portal.reprojection.progress',
    processed,
    total,
    ratio: total === null ? null : Math.min(processed / total, 1),
  };
};

const warningOf = (collection: string, state: PortalReprojectionState, now: number): PortalReprojectionWarning | null => {
  const counts = { processed: state.processed, failed: state.failed };
  if (isPortalReprojectionStalled(state, now)) return { collection, messageKey: 'portal.reprojection.stalled', counts };
  if (state.status === 'done' && state.failed > 0) return { collection, messageKey: 'portal.reprojection.failed', counts };
  return null;
};

export const portalReprojectionSummary = (
  states: ReadonlyMap<string, PortalReprojectionState>,
  now: number,
): PortalReprojectionSummary => ({
  progress: progressOf([...states.values()]),
  warnings: [...states.entries()].flatMap(([collection, state]) => {
    const warning = warningOf(collection, state, now);
    return warning ? [warning] : [];
  }),
});
