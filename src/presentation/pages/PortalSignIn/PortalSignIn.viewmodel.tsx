import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { PORTAL_PATH, portalSignInUrl, portalTenantPath } from '../Portal/portalPaths';

const EMAIL_STORAGE_KEY = 'microteia:portalSignInEmail';

export type PortalSignInMode = 'request' | 'confirm';
export type PortalSignInStatus = 'idle' | 'sending' | 'sent' | 'signing-in' | 'failed';

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

  const [mode] = useState<PortalSignInMode>(() => (isSignInLink(window.location.href) ? 'confirm' : 'request'));
  const [status, setStatus] = useState<PortalSignInStatus>('idle');
  const [email, setEmail] = useState(readStoredEmail);

  const target = useMemo(() => (tenantId ? portalTenantPath(tenantId) : PORTAL_PATH), [tenantId]);

  useEffect(() => {
    if (!loading && user && isEmailVerified) navigate(target, { replace: true });
  }, [loading, user, isEmailVerified, navigate, target]);

  const submit = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const typed = email.trim();
    if (!typed) return;
    try {
      if (mode === 'confirm') {
        setStatus('signing-in');
        await signInWithLink(typed, window.location.href);
        storeEmail(null);
        return;
      }
      setStatus('sending');
      await sendSignInLink(typed, portalSignInUrl(window.location.origin, tenantId ?? ''));
      storeEmail(typed);
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  }, [email, mode, signInWithLink, sendSignInLink, tenantId]);

  return { mode, status, email, setEmail, submit };
};
