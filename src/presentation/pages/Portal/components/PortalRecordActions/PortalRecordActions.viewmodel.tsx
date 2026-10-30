import { useCallback, useState } from 'react';
import { usePortalNavigation } from '../../../../../stores/usePortalNavigation';
import { useNotification, type NotificationVariant } from '../../../../../stores/useNotification';
import { useT } from '../../../../shared/i18n/useT';
import { portalRecordDocId } from '../../../../../domain/schema/portal';
import type { PortalRecordAction } from '../../../../../domain/entities/Portal';
import { usePortalRecordActions, type PortalActionResult } from '../../usePortalRecordActions';

export interface PortalRecordActionsProps {
  collection: string;
  /** O id do REGISTRO, não o da projeção. */
  recordId: string;
}

export interface PortalActionButton {
  id: string;
  title: string;
  iconKey: string;
  danger: boolean;
  disabled: boolean;
}

export interface PortalRecordActionsViewModel {
  buttons: PortalActionButton[];
  trigger: (actionId: string) => void;
  /** A pergunta antes de executar — a que o escritório escreveu na ação. */
  confirmation: { isOpen: boolean; title: string; message: string; danger: boolean };
  confirm: () => void;
  cancelConfirm: () => void;
}

const VARIANTS: Record<PortalActionResult['code'], NotificationVariant> = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

/**
 * A barra das ações do escritório no registro aberto (`portal.actions`): os botões e a confirmação. O
 * desfecho vai para o aviso passageiro do portal, e não fica no registro: ele é do momento, e uma frase
 * presa ao registro continuava dizendo o que ia acontecer depois que tinha acontecido. Quem decide quais
 * aparecem, e quais estão apagados, é o servidor — sobre o registro inteiro, que o convidado não vê. Quando a view de extensão do registro desenha as ações ela mesma
 * (`usePortalActions`), a barra sai de cena: o mesmo botão duas vezes seria dois lugares para o mesmo
 * gesto.
 */
export const usePortalRecordActionsViewModel = ({ collection, recordId }: PortalRecordActionsProps): PortalRecordActionsViewModel => {
  const t = useT('core.tenant');
  const { claimedActions } = usePortalNavigation();
  const projectionId = portalRecordDocId(collection, recordId);
  const claimed = claimedActions.includes(projectionId);
  const { actions, running, run } = usePortalRecordActions(collection, recordId, !claimed);
  const { notify } = useNotification();
  const [pending, setPending] = useState<PortalRecordAction | null>(null);

  const execute = useCallback(async (action: PortalRecordAction) => {
    const result = await run(action.id);
    notify(result.message, VARIANTS[result.code]);
  }, [run, notify]);

  const trigger = useCallback((actionId: string) => {
    const action = actions.find((one) => one.id === actionId);
    if (!action || action.disabled || running) return;
    if (action.confirmMessage) setPending(action);
    else void execute(action);
  }, [actions, running, execute]);

  const confirm = useCallback(() => {
    if (!pending) return;
    setPending(null);
    void execute(pending);
  }, [pending, execute]);

  const cancelConfirm = useCallback(() => setPending(null), []);

  const shown = claimed ? [] : actions;
  const asked = pending && shown.some((one) => one.id === pending.id) ? pending : null;

  return {
    buttons: shown.map((action) => ({
      id: action.id,
      title: running === action.id ? t('portal.action.running') : action.title,
      iconKey: action.icon,
      danger: action.danger,
      disabled: action.disabled || running !== null,
    })),
    trigger,
    confirmation: {
      isOpen: asked !== null,
      title: asked?.title ?? '',
      message: asked?.confirmMessage ?? '',
      danger: asked?.danger === true,
    },
    confirm,
    cancelConfirm,
  };
};
