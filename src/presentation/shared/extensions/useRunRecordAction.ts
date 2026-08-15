import { useCallback } from 'react';
import { useActions } from '../../../stores/useActions';
import { useRecords } from '../../../stores/useRecords';
import { useNotification } from '../../../stores/useNotification';
import { storeEvents, StoreEvents } from '../../../infrastructure/events/StoreEventEmitter';
import { dispatchActionOutcome } from '../entityScreen/useScreenActions';
import type { ActionStatusCode, CustomFieldValue } from '../../../domain/entities';

import { useT } from '../i18n/useT';

const STATUS_TONE: Record<ActionStatusCode, 'success' | 'warning' | 'error'> = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

export interface RunRecordActionRequest {
  /**
   * A Action pelo `templateId` do pacote que a instalou. É o endereço ESTÁVEL: o id de uma Action
   * instalada é gerado no escritório, então uma contribuição declarada num manifest só consegue
   * apontar para ela por aqui.
   */
  actionSourceId?: string;
  /** A Action pelo id real, quando quem chama já o tem em mãos. */
  actionId?: string;
  collection: string;
  recordId: string;
  record: Record<string, unknown>;
  /** Parâmetros da Action — o que distingue esta porta do botão pronto de `getCardActions`. */
  params?: Record<string, unknown>;
}

export interface RunRecordActionResult {
  ok: boolean;
  message: string | null;
}

/**
 * Executa uma Action do escritório SOBRE UM REGISTRO, a partir de código de extensão, passando
 * parâmetros. Existe para o gesto que não é um botão: arrastar um cartão para outro dia precisa
 * dizer à Action qual é o dia — e `getCardActions` só devolve `onClick` sem argumentos.
 *
 * Vale para Action de WORKFLOW. Uma Action de comando de tela (`copyLink`, `delete`…) é operação da
 * superfície que a desenha, e chega ao cartão pelo caminho de sempre; aqui ela é recusada com
 * mensagem, em vez de falhar em silêncio.
 */
export const useRunRecordAction = (): ((request: RunRecordActionRequest) => Promise<RunRecordActionResult>) => {
  const { actions, runAction } = useActions();
  const { updateRecord } = useRecords();
  const { notify } = useNotification();
  const t = useT('core.records');

  return useCallback(async (request: RunRecordActionRequest): Promise<RunRecordActionResult> => {
    const { actionSourceId, actionId, collection, recordId, record, params } = request;
    const action = actions.find((candidate) => (
      candidate.enabled && (actionId ? candidate.id === actionId : candidate.sourceId === actionSourceId)
    ));

    if (!action) return { ok: false, message: t('action.not-installed') };
    if (action.command) {
      return { ok: false, message: t('action.screen-command', { title: action.title }) };
    }

    try {
      const response = await runAction({
        actionId: action.id,
        source: collection,
        context: record,
        recordId,
        isNew: false,
        params,
      });

      if (response.error || !response.outcome) {
        const message = response.error ?? t('action.run-failed');
        notify(message, 'error');
        return { ok: false, message };
      }

      const { status } = response.outcome;
      if (status.message) notify(status.message, STATUS_TONE[status.code]);

      await dispatchActionOutcome(response.outcome, record as Record<string, CustomFieldValue>, {
        save: (override) => updateRecord(collection, recordId, override ?? (record as Record<string, CustomFieldValue>)),
        refresh: () => storeEvents.emit(StoreEvents.RECORDS_UPDATED),
      });

      return { ok: status.code !== 'ERROR', message: status.message || null };
    } catch (error) {
      console.error('[useRunRecordAction]', error);
      notify(t('action.run-failed'), 'error');
      return { ok: false, message: t('action.run-failed') };
    }
  }, [actions, runAction, updateRecord, notify, t]);
};
