import { isPortalReprojectionStalled } from '../schema/portalReprojection';
import type { PortalReprojectionState } from '../schema/portalReprojection';

/**
 * O aviso sobre a passada que atualiza o portal de UMA coleção — ou nenhum. É INFORMAÇÃO, nunca um
 * gesto: o servidor retoma sozinho o que é dele, e só aparece o que explica o que o convidado vê
 * agora. A passada que terminou sem falha não diz nada — o portal está em dia.
 *
 * A ordem é a do que pede atenção primeiro: a parada explica por que o andamento não anda; a falha
 * conta o que ficou para trás; o andamento só explica a espera.
 */
export interface PortalReprojectionNotice {
  /** Chave no catálogo `core.records`. */
  messageKey: string;
  /** Números crus — quem exibe os formata no idioma de quem lê. */
  counts: { processed: number; total: number | null; failed: number };
  variant: 'info' | 'warning';
}

export const portalReprojectionNotice = (
  state: PortalReprojectionState | null,
  now: number,
): PortalReprojectionNotice | null => {
  if (!state) return null;
  // Registro criado durante a passada também é percorrido, e o contado ao abrir fica para trás.
  const total = state.total === null ? null : Math.max(state.total, state.processed);
  const counts = { processed: state.processed, total, failed: state.failed };

  if (isPortalReprojectionStalled(state, now)) {
    return { messageKey: 'portal.reprojection.stalled', counts, variant: 'warning' };
  }
  if (state.status === 'running') {
    return {
      messageKey: total === null ? 'portal.reprojection.running.count' : 'portal.reprojection.running',
      counts,
      variant: 'info',
    };
  }
  if (state.failed > 0) return { messageKey: 'portal.reprojection.failed', counts, variant: 'warning' };
  return null;
};
