import { useEffect, useMemo, useState } from 'react';
import {
  editWindowAllowsDelete,
  editWindowClosesAt,
  isEditWindowOpen,
  readEditWindow,
} from '../../../domain/schema/editWindow';
import { useLocaleFormat, useT } from '../i18n/useT';

/** O maior atraso que `setTimeout` aceita; uma janela mais longa rearma o temporizador ao disparar. */
const MAX_TIMER_DELAY_MS = 2_147_483_647;

/** Com que frequência a LISTA reconfere os prazos — o cartão não precisa do segundo exato. */
const LIST_CLOCK_INTERVAL_MS = 30_000;

export interface EditWindowState {
  minutes: number;
  /** A janela também trava a exclusão (`delete: true`). */
  locksDelete: boolean;
  /** Quando a janela fecha. `null` = registro sem `createdAt` legível, e portanto já fechado. */
  closesAt: Date | null;
  isOpen: boolean;
  /** A exclusão ainda é permitida pela janela (sempre, quando ela não trava a exclusão). */
  canDelete: boolean;
  /** O aviso do formulário, já resolvido: o prazo enquanto aberta, o motivo depois de fechada. */
  notice: string;
}

/**
 * A janela de edição do registro aberto no formulário. `null` quando a tela não declara janela, ou
 * quando o registro ainda não existe — criar nunca é barrado.
 *
 * O instante vive em ESTADO, e um temporizador o renova no momento em que a janela fecha: o formulário
 * trava sozinho, sem que a pessoa precise sair e voltar, e sem ler o relógio no render (o que a regra
 * de pureza do React Compiler proíbe). O relógio do navegador só decide o que a tela MOSTRA — quem
 * decide o que grava é o `firestore.rules`, pelo relógio do servidor.
 */
export const useEditWindow = (
  declaration: unknown,
  createdAt: unknown,
  isNew: boolean,
): EditWindowState | null => {
  const t = useT('core.records');
  const { formatDateTime } = useLocaleFormat();
  const spec = useMemo(() => (isNew ? null : readEditWindow(declaration)), [declaration, isNew]);
  const closesAt = useMemo(() => (spec ? editWindowClosesAt(spec, createdAt) : null), [spec, createdAt]);
  const closesAtMs = closesAt?.getTime() ?? null;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (closesAtMs === null || now.getTime() >= closesAtMs) return undefined;
    const delay = Math.min(closesAtMs - now.getTime(), MAX_TIMER_DELAY_MS);
    const timer = setTimeout(() => setNow(new Date()), delay);
    return () => clearTimeout(timer);
  }, [closesAtMs, now]);

  return useMemo(() => {
    if (!spec) return null;
    const isOpen = isEditWindowOpen(spec, createdAt, now);
    const locksDelete = spec.delete === true;
    const minutes = String(spec.minutes);
    let notice: string;
    if (isOpen && closesAt) {
      notice = t(locksDelete ? 'edit-window.open-with-delete' : 'edit-window.open', { closesAt: formatDateTime(closesAt) });
    } else if (closesAt) {
      notice = t('edit-window.locked', { closesAt: formatDateTime(closesAt), minutes });
    } else {
      notice = t('edit-window.locked-unknown', { minutes });
    }
    return {
      minutes: spec.minutes,
      locksDelete,
      closesAt,
      isOpen,
      canDelete: editWindowAllowsDelete(spec, createdAt, now),
      notice,
    };
  }, [spec, createdAt, closesAt, now, t, formatDateTime]);
};

/**
 * O instante com que a LISTA confere os prazos dos cartões. Só anda quando a tela declara janela — sem
 * ela, nenhum re-render a mais —, a cada meio minuto e ao voltar o foco, que é o mesmo gesto que faz os
 * Stores relerem.
 */
export const useEditWindowClock = (enabled: boolean): Date => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return undefined;
    const refresh = (): void => setNow(new Date());
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') refresh();
    };
    const interval = setInterval(refresh, LIST_CLOCK_INTERVAL_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  return now;
};
