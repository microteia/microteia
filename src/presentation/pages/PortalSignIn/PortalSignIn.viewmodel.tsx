import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import {
  isPortalReturnPath,
  PORTAL_INVITE_PARAM,
  PORTAL_NEXT_PARAM,
  PORTAL_PATH,
  PORTAL_SIGN_IN_CALLBACK_PATH,
  PORTAL_SIGN_IN_STATE_KEY,
  portalSignInUrl,
  portalTenantOf,
  portalTenantPath,
} from '../Portal/portalPaths';
import {
  makeGetPortalSignInOptionsUseCase,
  makeStartPortalSignInUseCase,
} from '../../../domain/usecases/portal/PortalSignInUseCases';

const EMAIL_STORAGE_KEY = 'microteia:portalSignInEmail';

export type PortalSignInMode = 'request' | 'confirm';
export type PortalSignInStatus = 'idle' | 'sending' | 'sent' | 'signing-in' | 'signed-in' | 'failed' | 'redirecting' | 'provider-failed';

export interface PortalSignInViewModel {
  mode: PortalSignInMode;
  status: PortalSignInStatus;
  email: string;
  setEmail: (value: string) => void;
  submit: (event: FormEvent) => Promise<void>;
  /**
   * O link está sendo consumido sozinho — com o e-mail no endereço, não há o que perguntar. A página
   * mostra o progresso, e não o formulário: era ele aparecendo e sumindo que parecia "pedir login".
   */
  processing: boolean;
  /** Os provedores de identidade do escritório — vazio quando não há escritório no endereço ou nenhum configurado. */
  providers: Array<{ id: string; label: string }>;
  /** O link de e-mail vale neste escritório. */
  emailLinkEnabled: boolean;
  signInWithProvider: (providerId: string) => Promise<void>;
}

const readStoredEmail = (): string => {
  try {
    return localStorage.getItem(EMAIL_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

const rememberState = (state: string): void => {
  try {
    sessionStorage.setItem(PORTAL_SIGN_IN_STATE_KEY, state);
  } catch {
    // Sem armazenamento, a volta não tem com o que conferir o `state`, e recusa — falha fechada.
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
  const { portalRepository } = useDI();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  // Para onde a pessoa ia: o registro do aviso que ela abriu. Vem no endereço quando ela volta pelo
  // link de acesso, e no `state` quando a porta do portal a mandou entrar.
  const fromState = (location.state as { from?: unknown } | null)?.from;
  const returnPath = [params.get(PORTAL_NEXT_PARAM), typeof fromState === 'string' ? fromState : null]
    .find(isPortalReturnPath) ?? null;
  // O escritório vem no endereço do convite; sem ele, do destino — quem saiu de um portal que passou a
  // exigir identidade volta aqui com o endereço daquele portal, e precisa ver os provedores DELE.
  const tenantId = params.get('tenant') ?? portalTenantOf(returnPath);
  const invitedEmail = params.get('email');
  const locale = params.get('locale');
  const inviteId = params.get(PORTAL_INVITE_PARAM);
  const uc = useMemo(() => ({
    options: makeGetPortalSignInOptionsUseCase(portalRepository),
    start: makeStartPortalSignInUseCase(portalRepository),
  }), [portalRepository]);
  const [providers, setProviders] = useState<Array<{ id: string; label: string }>>([]);
  const [emailLinkEnabled, setEmailLinkEnabled] = useState(true);

  // Os métodos são do ESCRITÓRIO: sem ele no endereço, vale o link de e-mail, como sempre. A falha ao
  // ler também — o link de e-mail é o que o portal sempre teve.
  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    uc.options.execute(tenantId)
      .then((options) => {
        if (!active) return;
        setProviders(options.providers);
        setEmailLinkEnabled(options.emailLink);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [tenantId, uc.options]);

  const [mode] = useState<PortalSignInMode>(() => (isSignInLink(window.location.href) ? 'confirm' : 'request'));
  const [status, setStatus] = useState<PortalSignInStatus>('idle');
  const [email, setEmail] = useState(() => invitedEmail ?? readStoredEmail());
  const autoStartedRef = useRef(false);

  const target = useMemo(
    () => returnPath ?? (tenantId ? portalTenantPath(tenantId) : PORTAL_PATH),
    [returnPath, tenantId],
  );

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
  //
  // Já conectado COM A CONTA CONVIDADA, não há o que consumir: o link volta a abrir uma sessão que já
  // existe, e é só seguir.
  const alreadyInvitee = !!user && !!invitedEmail && isEmailVerified
    && user.email.trim().toLowerCase() === invitedEmail.trim().toLowerCase();
  useEffect(() => {
    if (mode !== 'confirm' || !invitedEmail || loading || autoStartedRef.current) return;
    autoStartedRef.current = true;
    if (alreadyInvitee) {
      navigate(target, { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consumir o link é um efeito de uma vez só, disparado pelo endereço
    void completeLink(invitedEmail);
  }, [mode, invitedEmail, loading, alreadyInvitee, completeLink, navigate, target]);

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
      await sendSignInLink(
        typed,
        portalSignInUrl(window.location.origin, tenantId ?? '', {
          email: typed,
          locale: locale ?? undefined,
          ...(returnPath ? { next: returnPath } : {}),
        }),
        locale ?? undefined,
      );
      storeEmail(typed);
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  }, [email, mode, completeLink, sendSignInLink, tenantId, locale, returnPath]);

  const signInWithProvider = useCallback(async (providerId: string) => {
    if (!tenantId) return;
    setStatus('redirecting');
    try {
      const { url, state } = await uc.start.execute({
        tenantId,
        providerId,
        redirectUri: `${window.location.origin}${PORTAL_SIGN_IN_CALLBACK_PATH}`,
        next: returnPath ?? portalTenantPath(tenantId),
        inviteId,
      });
      rememberState(state);
      window.location.assign(url);
    } catch {
      setStatus('provider-failed');
    }
  }, [tenantId, uc.start, returnPath, inviteId]);

  const processing = mode === 'confirm' && !!invitedEmail && status !== 'failed';

  return { mode, status, email, setEmail, submit, processing, providers, emailLinkEnabled, signInWithProvider };
};
