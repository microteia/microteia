import { portalReferenceLabels, portalScreenOf, type PortalScreenLike } from './portal';

/**
 * A passada que refaz as projeções de UMA coleção do portal depois que uma declaração mudou — o estado
 * gravado em `portal_reprojections/{coleção}`. Quem anda com ela é o servidor, por rodadas: cada uma
 * reserva o job, processa uma página a partir do `cursor` e fecha gravando o cursor novo, e é essa
 * gravação que dispara a rodada seguinte. O app só a lê, para mostrar o andamento.
 *
 * Num escritório anda UMA passada por vez: as outras esperam em `queued`, e a que termina chama a
 * próxima. Cada projeção gravada acorda os gatilhos que escutam o tenant inteiro, e passadas em paralelo
 * somavam instâncias até esgotar a cota de CPU da região — e aí caía tudo, inclusive o que nada tinha com
 * o portal.
 */
/**
 * A revisão da FORMA como o kernel projeta. Sobe quando o kernel passa a projetar diferente uma
 * declaração que ficou igual — uma correção na corrente, no rótulo, no filtro. A reprojeção por
 * declaração não percebe essa mudança (a declaração é a mesma); a coleção do portal cuja última passada
 * foi aberta com uma revisão anterior ganha uma passada nova, sozinha, uma vez.
 *
 * - 1: o vínculo chega à tela que está no portal para a coleção (`portalTargetScreen`).
 * - 2: o título que é referência sai pelo rótulo dela, nunca como o id gravado; e o rótulo acompanha o
 *   título do apontado — a projeção feita antes ficava com o id, ou com o nome antigo (EV-24).
 * - 3: o rótulo da referência a um registro cujo título é OUTRA referência é o título que ele mostra
 *   (o domicílio pelo contribuinte), e não vazio (EV-40). Só as coleções que têm esse rótulo.
 */
export const PORTAL_PROJECTION_REVISION = 3;

/**
 * Até onde chega a revisão que não alcança todas as coleções. A correção de um caso raro não abre
 * passada no portal inteiro de todo escritório: a passada lê cada registro, e quem não tem o caso
 * pagaria por nada. A revisão sem entrada aqui alcança todas.
 */
const PORTAL_PROJECTION_REVISION_REACH: Readonly<Record<number, (screens: readonly PortalScreenLike[], collection: string) => boolean>> = {
  3: (screens, collection) => {
    const screen = portalScreenOf(screens, collection);
    return !!screen && portalReferenceLabels(screens, screen).some((label) => !!label.through);
  },
};

/** A coleção projetada pela revisão `from` precisa de uma passada nova: alguma revisão posterior a alcança. */
export const isPortalProjectionBehind = (
  from: number,
  screens: readonly PortalScreenLike[],
  collection: string,
): boolean => {
  for (let revision = from + 1; revision <= PORTAL_PROJECTION_REVISION; revision += 1) {
    const reach = PORTAL_PROJECTION_REVISION_REACH[revision];
    if (!reach || reach(screens, collection)) return true;
  }
  return false;
};

export interface PortalReprojectionState {
  status: 'queued' | 'running' | 'done';
  /** Sobe a cada passada nova: a rodada de uma passada abandonada é descartada ao fechar. */
  generation: number;
  round: number;
  /** O id do último registro (ou projeção) processado; `null` = do começo. */
  cursor: string | null;
  /** Até quando a rodada em curso é dona do job — em ms. */
  leaseUntil: number | null;
  /** A última gravação no job, em ms: passada sem gravação há muito tempo está parada. */
  touchedAt: number;
  /** Quando a passada foi aberta, em ms — é a ordem da fila, e o que junta as passadas de uma mesma leva no andamento. */
  openedAt: number;
  /** Quantos a passada tem a percorrer, contados ao abri-la; `null` quando a contagem falhou. */
  total: number | null;
  processed: number;
  failed: number;
  failedIds: string[];
  /** Quantas vezes a passada recomeçou por falha. */
  attempts: number;
  /** A `PORTAL_PROJECTION_REVISION` com que a passada foi aberta; `0` = antes de existir. */
  revision: number;
}

/** Passada em curso sem gravação no job há mais que isto está parada — e a próxima conferência a acorda. */
export const PORTAL_REPROJECTION_STALL_MS = 10 * 60_000;

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** O documento lido com desconfiança: o que faltar vale o começo de uma passada encerrada. */
export const readPortalReprojectionState = (data: Record<string, unknown>): PortalReprojectionState => ({
  status: data.status === 'running' || data.status === 'queued' ? data.status : 'done',
  generation: numberOr(data.generation, 0),
  round: numberOr(data.round, 0),
  cursor: typeof data.cursor === 'string' && data.cursor !== '' ? data.cursor : null,
  leaseUntil: typeof data.leaseUntil === 'number' ? data.leaseUntil : null,
  touchedAt: numberOr(data.touchedAt, 0),
  openedAt: numberOr(data.openedAt, numberOr(data.touchedAt, 0)),
  total: typeof data.total === 'number' && Number.isFinite(data.total) ? data.total : null,
  processed: numberOr(data.processed, 0),
  failed: numberOr(data.failed, 0),
  failedIds: Array.isArray(data.failedIds) ? data.failedIds.filter((id): id is string => typeof id === 'string') : [],
  attempts: numberOr(data.attempts, 0),
  revision: numberOr(data.revision, 0),
});

/** Parada: em curso, sem gravação há mais que `PORTAL_REPROJECTION_STALL_MS` e sem reserva válida. */
export const isPortalReprojectionStalled = (state: PortalReprojectionState, now: number): boolean =>
  state.status === 'running'
  && now - state.touchedAt > PORTAL_REPROJECTION_STALL_MS
  && (state.leaseUntil === null || state.leaseUntil <= now);
