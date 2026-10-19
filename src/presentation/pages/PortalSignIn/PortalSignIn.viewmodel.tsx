import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { PORTAL_PATH, portalSignInUrl, portalTenantPath } from '../Portal/portalPaths';

const EMAIL_STORAGE_KEY = 'microteia:portalSignInEmail';

export type PortalSignInMode = 'request' | 'confirm';
export type PortalSignInStatus = 'idle' | 'sending' | 'sent' | 'signing-in' | 'signed-in' | 'failed';

export interface PortalSignInViewModel {
  mode: PortalSignInMode;
  status: PortalSignInStatus;
  email: string;
  setEmail: (value: string) => void;
  submit: (event: FormEvent) => Promise<void>;
}

const readStoredEmail = (): string => {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const storeEmail = (email: string | null): void => {
  try {
    if (email) localStorage.setItem(EMAIL_STORAGE_KEY, email);
    else localStorage.removeItem(EMAIL_STORAGE_KEY);
  } catch {
    // Sem armazenamento, a pessoa digita o e-mail de novo ao voltar pelo link — e é só isso.
  }
};

export const usePortalSignInViewModel = (): PortalSignInViewModel => {
  const { user, isEmailVerified, loading, isSignInLink, signInWithLink, sendSignInLink } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tenantId = params.get('tenant');
  const invitedEmail = params.get('email');
  const lang = params.get('lang');

  const [mode] = useState<PortalSignInMode>(() => (isSignInLink(window.location.href) ? 'confirm' : 'request'));
  const [status, setStatus] = useState<PortalSignInStatus>('idle');
  const [email, setEmail] = useState(() => invitedEmail ?? readStoredEmail());
  const autoStartedRef = useRef(false);

  const target = useMemo(() => (tenantId ? portalTenantPath(tenantId) : PORTAL_PATH), [tenantId]);

  /**
   * Segue para o portal só depois de CONSUMIR o link. Enquanto ele não foi usado, a sessão aberta é
   * de outra pessoa — tipicamente a conta do escritório de quem testa o convite no mesmo navegador —, e
   * seguir com ela abria o portal na conta errada, que naturalmente não tinha convite nenhum.
   */
  const ready = mode === 'request' || status === 'signed-in';
  useEffect(() => {
    if (ready && !loading && user && isEmailVerified) navigate(target, { replace: true });
  }, [ready, loading, user, isEmailVerified, navigate, target]);

  const completeLink = useCallback(async (typed: string) => {
    setStatus('signing-in');
    try {
      await signInWithLink(typed, window.location.href);
      storeEmail(null);
      setStatus('signed-in');
    } catch {
      setStatus('failed');
    }
  }, [signInWithLink]);

  // O link traz o e-mail convidado: não há o que perguntar, e o acesso conclui sozinho — trocando a
  // sessão, se havia outra aberta. A guarda é por ref porque o link só vale UMA vez: o segundo
  // disparo do efeito em desenvolvimento o encontraria já usado.
  useEffect(() => {
    if (mode !== 'confirm' || !invitedEmail || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void completeLink(invitedEmail);
  }, [mode, invitedEmail, completeLink]);

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const typed = email.trim();
    if (!typed) return;
    if (mode === 'confirm') {
      await completeLink(typed);
      return;
    }
    try {
      setStatus('sending');
      await sendSignInLink(typed, portalSignInUrl(window.location.origin, tenantId ?? '', { email: typed, lang: lang ?? undefined }));
      storeEmail(typed);
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  }, [email, mode, completeLink, sendSignInLink, tenantId, lang]);

  return { mode, status, email, setEmail, submit };
};
