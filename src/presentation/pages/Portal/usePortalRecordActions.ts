import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePortal } from '../../../stores/usePortal';
import { useLabel, useT } from '../../shared/i18n/useT';
import { portalRecordDocId } from '../../../domain/schema/portal';
import type { PortalActionOutcome, PortalRecordAction } from '../../../domain/entities/Portal';

/** O desfecho de uma ação, com a mensagem já pronta no idioma do convidado — nunca vazia. */
export interface PortalActionResult {
  code: PortalActionOutcome['status']['code'];
  message: string;
}

export interface PortalRecordActionsState {
  actions: PortalRecordAction[];
  loading: boolean;
  /** A ação que está rodando — enquanto houver uma, nenhuma outra dispara. */
  running: string | null;
  /** Dispara a ação SEM perguntar: a confirmação (`confirmMessage`) é de quem desenha o botão. */
  run: (actionId: string) => Promise<PortalActionResult>;
}

/**
 * As ações do escritório num registro do portal (`portal.actions`): os botões, pedidos ao servidor, e o
 * gesto de disparar um deles. Uma lógica só para a casca (`PortalRecordActions`) e para as views de
 * extensão (`usePortalActions`), para que as duas digam o mesmo, do mesmo jeito.
 *
 * Os botões são pedidos de novo quando a projeção do registro muda — o registro gravado de novo pode ter
 * ligado ou desligado um deles —, e voltam refeitos do servidor depois de cada execução. `enabled: false`
 * não pede nada: é a casca quando a view já desenha as ações.
 */
export const usePortalRecordActions = (
  collection: string,
  recordId: string,
  enabled = true,
): PortalRecordActionsState => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { context, recordsByCollection, listRecordActions, runRecordAction } = usePortal();
  const projectionId = portalRecordDocId(collection, recordId);
  const offers = enabled && !!context?.screens.some((screen) => screen.collection === collection && screen.actions);
  const revision = useMemo(
    () => (recordsByCollection[collection] ?? []).find((record) => record.id === projectionId)?.updatedAt?.getTime() ?? 0,
    [recordsByCollection, collection, projectionId],
  );
  const [loaded, setLoaded] = useState<{ projectionId: string; actions: PortalRecordAction[] } | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  useEffect(() => {
    if (!offers) return;
    let active = true;
    listRecordActions(projectionId)
      .then((actions) => { if (active) setLoaded({ projectionId, actions }); })
      .catch(() => { if (active) setLoaded({ projectionId, actions: [] }); });
    return () => { active = false; };
  }, [offers, projectionId, revision, listRecordActions]);

  const current = offers && loaded?.projectionId === projectionId ? loaded : null;
  const actions = useMemo(() => current?.actions ?? [], [current]);

  const run = useCallback(async (actionId: string): Promise<PortalActionResult> => {
    const action = actions.find((one) => one.id === actionId);
    const failed = t('portal.action.failed', { name: action?.title ?? '' });
    if (!action || action.disabled || running) return { code: 'ERROR', message: t('portal.action.unavailable') };
    setRunning(actionId);
    try {
      const outcome = await runRecordAction(projectionId, actionId);
      setLoaded({ projectionId, actions: outcome.actions });
      const fallback = outcome.status.code === 'SUCCESS' ? t('portal.action.done') : failed;
      return { code: outcome.status.code, message: outcome.status.message || fallback };
    } catch (err) {
      listRecordActions(projectionId)
        .then((refreshed) => setLoaded({ projectionId, actions: refreshed }))
        .catch(() => setLoaded({ projectionId, actions: [] }));
      // A recusa do servidor é uma referência do catálogo (`@core.tenant/...`) — traduzida aqui.
      return { code: 'ERROR', message: err instanceof Error && err.message ? label(err.message) : failed };
    } finally {
      setRunning(null);
    }
  }, [actions, running, projectionId, runRecordAction, listRecordActions, label, t]);

  return { actions, loading: offers && !current, running, run };
};
