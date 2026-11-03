import { useCallback, useMemo } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useOptionalLocale } from '../../../../stores/useLocale';
import { portalSignInUrl } from '../../Portal/portalPaths';
import { useT } from '../../../shared/i18n/useT';

export interface PortalSignInLink {
  send: (email: string) => Promise<void>;
  /** A mensagem de quando o envio falhou — o convite, esse, já está gravado. */
  failureMessage: (error: unknown, email: string) => string;
}

/** O link de entrada do portal por e-mail: mandado no convite e reenviado pela lista de convidados. */
export const usePortalSignInLink = (): PortalSignInLink => {
  const t = useT('core.tenant');
  const { currentTenant } = useTenant();
  const { sendSignInLink } = useAuth();
  const { locale } = useOptionalLocale();
  const tenantId = currentTenant?.id ?? null;

  const send = useCallback(async (email: string) => {
    if (!tenantId) return;
    await sendSignInLink(email, portalSignInUrl(window.location.origin, tenantId, { email, locale }), locale);
  }, [tenantId, sendSignInLink, locale]);

  /**
   * O link é OUTRO passo, e pode falhar sozinho: o convite já está gravado quando o Firebase recusa o
   * envio. Dizer só "falhou" fazia parecer que o convite inteiro não existia — e o motivo mais comum,
   * o login por link desligado no projeto, é configuração, não defeito.
   */
  const failureMessage = useCallback((error: unknown, email: string): string =>
    ((error as { code?: string } | null)?.code === 'auth/operation-not-allowed'
      ? t('portal.link.not-enabled', { email })
      : t('portal.link.failed', { email })), [t]);

  return useMemo(() => ({ send, failureMessage }), [send, failureMessage]);
};
