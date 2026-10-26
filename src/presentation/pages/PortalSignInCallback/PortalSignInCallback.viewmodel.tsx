import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeCompletePortalSignInUseCase } from '../../../domain/usecases/portal/PortalSignInUseCases';
import { PORTAL_SIGN_IN_PATH, PORTAL_SIGN_IN_STATE_KEY, isPortalReturnPath, portalTenantPath } from '../Portal/portalPaths';

export interface PortalSignInCallbackViewModel {
  /** A frase da recusa (uma referência `@`), ou `null` enquanto a entrada anda. */
  failure: string | null;
  signInPath: string;
}

const takeRememberedState = (): string | null => {
  try {
    const value = sessionStorage.getItem(PORTAL_SIGN_IN_STATE_KEY);
    sessionStorage.removeItem(PORTAL_SIGN_IN_STATE_KEY);
    return value;
  } catch {
    return null;
  }
};

/**
 * A volta do provedor de identidade. Confere que o `state` é o da entrada que ESTE navegador começou
 * — sem isso, alguém mandaria aqui a volta da entrada DELE e a pessoa trabalharia, sem saber, na conta
 * de outro —, troca o código no servidor e abre a sessão com o token que ele emitir.
 *
 * O código vale uma vez só: a guarda por ref impede o segundo disparo do efeito em desenvolvimento.
 */
export const usePortalSignInCallbackViewModel = (): PortalSignInCallbackViewModel => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { signInWithToken } = useAuth();
  const { portalRepository } = useDI();
  const complete = useMemo(() => makeCompletePortalSignInUseCase(portalRepository), [portalRepository]);
  const [failure, setFailure] = useState<string | null>(null);
  const startedRef = useRef(false);

  const code = params.get('code');
  const state = params.get('state');
  const providerError = params.get('error');

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const remembered = takeRememberedState();
    const run = async () => {
      if (providerError || !code || !state) {
        setFailure('@core.tenant/portal.signin.cancelled');
        return;
      }
      if (remembered !== state) {
        setFailure('@core.tenant/portal.signin.state-mismatch');
        return;
      }
      try {
        const result = await complete.execute(state, code);
        await signInWithToken(result.token);
        const target = isPortalReturnPath(result.next) ? result.next : portalTenantPath(result.tenantId);
        navigate(target, { replace: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        setFailure(message.startsWith('@') ? message : '@core.tenant/portal.signin.identity-failed');
      }
    };
    void run();
  }, [code, state, providerError, complete, signInWithToken, navigate]);

  return { failure, signInPath: PORTAL_SIGN_IN_PATH };
};
