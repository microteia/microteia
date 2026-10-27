import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDI } from '../../../infrastructure/di/useDI';
import { useLabel } from '../../shared/i18n/useT';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';
import type { NotificationOptOutState } from '../../../domain/repositories/INotificationRepositories';
import {
  makeChangeNotificationOptOutUseCase,
  makeGetNotificationOptOutUseCase,
} from '../../../domain/usecases/notifications/NotificationOptOutUseCases';

export interface NotificationOptOutViewModel {
  isLoading: boolean;
  isSaving: boolean;
  /** A frase da recusa, já resolvida, ou `null`. */
  failure: string | null;
  /** O que a pessoa lê sobre o endereço — recebendo, ou não mais. */
  statement: string;
  optedOut: boolean;
  saved: boolean;
  toggle: () => void;
}

const MESSAGES = {
  email: {
    receiving: '@core.automation/notifications.opt-out.email.receiving',
    stopped: '@core.automation/notifications.opt-out.email.stopped',
  },
  sms: {
    receiving: '@core.automation/notifications.opt-out.sms.receiving',
    stopped: '@core.automation/notifications.opt-out.sms.stopped',
  },
} as const;

/**
 * A página do link de descadastro. Abrir só CONSULTA: os filtros de e-mail das empresas abrem todo link
 * de uma mensagem para conferi-lo, e uma visita que descadastrasse tiraria da lista quem nunca pediu.
 * A decisão é o botão — e o mesmo botão a desfaz.
 */
export const useNotificationOptOutViewModel = (): NotificationOptOutViewModel => {
  const { tenantId = '', ticket = '' } = useParams();
  const { notificationOptOutService } = useDI();
  const label = useLabel();
  const getState = useMemo(() => makeGetNotificationOptOutUseCase(notificationOptOutService), [notificationOptOutService]);
  const change = useMemo(() => makeChangeNotificationOptOutUseCase(notificationOptOutService), [notificationOptOutService]);

  const [state, setState] = useState<NotificationOptOutState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fail = useCallback((error: unknown) => {
    const message = error instanceof Error && error.message.startsWith('@')
      ? error.message
      : '@core.automation/notifications.opt-out.failed';
    setFailure(label(message, errorParamsOf(error)));
  }, [label]);

  useEffect(() => {
    let cancelled = false;
    getState.execute(tenantId, ticket)
      .then((loaded) => { if (!cancelled) setState(loaded); })
      .catch((error) => { if (!cancelled) fail(error); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [tenantId, ticket, getState, fail]);

  const toggle = useCallback(() => {
    if (!state) return;
    setIsSaving(true);
    setFailure(null);
    change.execute(tenantId, ticket, !state.optedOut)
      .then((next) => {
        setState(next);
        setSaved(true);
      })
      .catch(fail)
      .finally(() => setIsSaving(false));
  }, [state, change, tenantId, ticket, fail]);

  const statement = state
    ? label(MESSAGES[state.channel][state.optedOut ? 'stopped' : 'receiving'], { tenant: state.tenant, address: state.address })
    : '';

  return {
    isLoading,
    isSaving,
    failure,
    statement,
    optedOut: state?.optedOut ?? false,
    saved: saved && !!state,
    toggle,
  };
};
