import type { PortalScreen } from '../repositories/IPortalRepository';
import type { IPortalViewMarks } from '../repositories/IPortalViewMarks';
import { portalViewMarkId } from '../schema/portal';

/**
 * Uma abertura pelo portal que o servidor JÁ conferiu: o convidado está convidado, enxerga o registro, e
 * a tela declara `portal.trackViews`. `document` é `null` na abertura do registro.
 */
export interface PortalViewFact {
  tenantId: string;
  userId: string;
  /** O e-mail do convite — quem o escritório convidou, que é o que ele reconhece. */
  email: string;
  screen: PortalScreen;
  recordId: string;
  document: { id: string; name: string; type: string | null } | null;
  /** O relógio do SERVIDOR. */
  at: Date;
}

/**
 * Registra a abertura: a linha de Auditoria e o evento `<prefixo>.portalViewed`. Quem implementa é a
 * infraestrutura — este módulo só decide SE e QUANDO.
 */
export type PortalViewRecorder = (fact: PortalViewFact) => Promise<void>;

export type PortalViewOutcome = 'recorded' | 'repeated';

/** Registra uma abertura já conferida — salvo se a mesma foi registrada há pouco. */
export type TrackPortalView = (view: Omit<PortalViewFact, 'at'> & { projectionId: string }) => Promise<PortalViewOutcome>;

/**
 * A ordem é a que mantém a promessa de "uma por janela" sem perder nenhuma: a marca é reservada ANTES
 * (duas aberturas simultâneas registram uma vez), e desfeita se o registro falhar — senão a abertura
 * seguinte, dentro da janela, seria tomada como repetição de uma que nunca foi registrada.
 */
export const makeTrackPortalView = (deps: {
  marks: IPortalViewMarks;
  record: PortalViewRecorder;
  now?: () => Date;
}): TrackPortalView => async ({ projectionId, ...view }) => {
  const at = (deps.now ?? (() => new Date()))();
  const markId = portalViewMarkId(view.tenantId, view.userId, projectionId, view.document?.id ?? null);
  if (!(await deps.marks.claim(markId, view.tenantId, at))) return 'repeated';
  try {
    await deps.record({ ...view, at });
  } catch (error) {
    await deps.marks.release(markId, at).catch(() => undefined);
    throw error;
  }
  return 'recorded';
};
