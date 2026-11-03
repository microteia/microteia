import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useNotification } from '../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeInvitePortalGuestUseCase } from '../../../../domain/usecases/portal/PortalUseCases';
import type { PortalSignInSettingsView } from '../../../../domain/entities/Portal';
import { makeGetPortalSignInSettingsUseCase } from '../../../../domain/usecases/portal/PortalSignInUseCases';
import {
  PORTAL_CLAIM_NORMALIZERS,
  portalAttestedClaims,
  type PortalClaimNormalize,
  type PortalVerifiedIdentity,
} from '../../../../domain/schema/portalIdentity';
import { portalSubjectKey } from '../../../../domain/schema/portal';
import type { PortalSubjectRole } from '../../../../domain/schema/portalRole';
import { screenDataCollection } from '../../../../domain/services/screenDataCollection';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { useOptionalLocale } from '../../../../stores/useLocale';
import { usePortalSubjects } from './usePortalSubjects';
import { usePortalSignInLink } from './usePortalSignInLink';

export interface PortalTabViewModel {
  hasSubjectScreens: boolean;
  screenOptions: Array<{ value: string; label: string }>;
  screenId: string;
  setScreenId: (value: string) => void;
  recordOptions: Array<{ value: string; label: string; meta?: string }>;
  recordId: string;
  setRecordId: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  /** O papel do convidado no registro — uma chave que as condições do portal comparam. Vazio, nenhum. */
  role: string;
  setRole: (value: string) => void;
  /** As claims que algum provedor do escritório atesta — vazio, o convite é só pelo e-mail. */
  claimOptions: Array<{ value: string; label: string }>;
  claimName: string;
  setClaimName: (value: string) => void;
  claimValue: string;
  setClaimValue: (value: string) => void;
  normalizeOptions: Array<{ value: string; label: string }>;
  claimNormalize: string;
  setClaimNormalize: (value: string) => void;
  /** O escritório desligou o link de e-mail: todo convite exige uma claim. */
  identityRequired: boolean;
  canInvite: boolean;
  isInviting: boolean;
  invite: () => Promise<void>;
  /** "Tela: título do registro" de um sujeito, com o papel quando há um — para as duas listas. */
  describeSubject: (subjectKey: string, roles: PortalSubjectRole[]) => string;
  /** O selo de quem entrou por um provedor: o provedor e o nível. `null` para quem entra pelo e-mail. */
  verifiedBadge: (identity: PortalVerifiedIdentity | undefined) => string | null;
  /** A configuração de entrada mudou — as claims que um convite pode exigir também. */
  reloadSignIn: () => void;
}

export const usePortalTabViewModel = (): PortalTabViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const { definitions } = useScreenDefinitions();
  const { portalRepository } = useDI();
  const { locale } = useOptionalLocale();
  const subjects = usePortalSubjects();
  const link = usePortalSignInLink();

  const uc = useMemo(() => ({
    invite: makeInvitePortalGuestUseCase(portalRepository),
    signIn: makeGetPortalSignInSettingsUseCase(portalRepository),
  }), [portalRepository]);

  const [screenId, setScreenIdState] = useState('');
  const [recordId, setRecordId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [signIn, setSignIn] = useState<PortalSignInSettingsView | null>(null);
  const [signInVersion, setSignInVersion] = useState(0);
  const [claimName, setClaimName] = useState('');
  const [claimValue, setClaimValue] = useState('');
  const [claimNormalize, setClaimNormalize] = useState('');

  const tenantId = currentTenant?.id ?? null;

  // A configuração de entrada diz quais claims um convite pode exigir, e se o link de e-mail vale.
  // Sem ela (a leitura falhou), o convite fica como sempre foi: pelo e-mail.
  useEffect(() => {
    if (!tenantId) return;
    let active = true;
    uc.signIn.execute(tenantId)
      .then((view) => { if (active) setSignIn(view); })
      .catch(() => { if (active) setSignIn(null); });
    return () => { active = false; };
  }, [tenantId, uc.signIn, signInVersion]);

  const reloadSignIn = useCallback(() => setSignInVersion((version) => version + 1), []);
  const attestedClaims = useMemo(() => (signIn ? portalAttestedClaims(signIn) : []), [signIn]);
  const identityRequired = signIn ? !signIn.emailLink : false;

  const verifiedBadge = useCallback((identity: PortalVerifiedIdentity | undefined): string | null => {
    if (!identity) return null;
    const provider = signIn?.providers.find((one) => one.id === identity.provider)?.label ?? identity.provider;
    return identity.level
      ? t('portal.guest.verified-level', { provider, level: identity.level })
      : t('portal.guest.verified', { provider });
  }, [signIn, t]);

  const subjectScreens = useMemo(
    () => definitions.filter((screen) => screen.portal?.subject === 'self'),
    [definitions],
  );

  const screen = useMemo(() => subjectScreens.find((one) => one.id === screenId) ?? null, [subjectScreens, screenId]);

  const recordOptions = useMemo(
    () => (screen ? subjects.recordOptionsOf(screenDataCollection(screen)) : []),
    [screen, subjects],
  );

  const invite = useCallback(async () => {
    const typed = email.trim();
    if (!tenantId || !screen || !recordId || !typed) return;
    setIsInviting(true);
    const requiredClaim = claimName
      ? {
        name: claimName,
        value: claimValue,
        ...(PORTAL_CLAIM_NORMALIZERS.includes(claimNormalize as PortalClaimNormalize)
          ? { normalize: claimNormalize as PortalClaimNormalize }
          : {}),
      }
      : undefined;
    try {
      await uc.invite.execute(tenantId, typed, portalSubjectKey(screenDataCollection(screen), recordId), locale, requiredClaim, role.trim() || undefined);
    } catch (error) {
      notify(label(error instanceof Error ? error.message : '@core.tenant/portal.failed'), 'error');
      setIsInviting(false);
      return;
    }
    setEmail('');
    setRecordId('');
    setRole('');
    setClaimValue('');
    // O convite por identidade não abre conta pelo e-mail — mandar o link seria abrir a porta que ele
    // existe para fechar. A pessoa entra pela página do portal, pelo provedor.
    if (requiredClaim) {
      notify(t('portal.invited-identity', { email: typed }), 'success');
      setIsInviting(false);
      return;
    }
    try {
      await link.send(typed);
      notify(t('portal.invited', { email: typed }), 'success');
    } catch (error) {
      notify(link.failureMessage(error, typed), 'error');
    } finally {
      setIsInviting(false);
    }
  }, [email, tenantId, screen, recordId, uc.invite, link, notify, t, label, locale, claimName, claimValue, claimNormalize, role]);

  const setScreenId = useCallback((value: string) => {
    setScreenIdState(value);
    setRecordId('');
  }, []);

  return {
    hasSubjectScreens: subjectScreens.length > 0,
    screenOptions: subjectScreens.map((one) => ({ value: one.id, label: label(one.titlePlural) })),
    screenId,
    setScreenId,
    recordOptions,
    recordId,
    setRecordId,
    email,
    setEmail,
    role,
    setRole,
    claimOptions: attestedClaims.length > 0
      ? [{ value: '', label: t('portal.claim.none') }, ...attestedClaims.map((claim) => ({ value: claim, label: claim }))]
      : [],
    claimName,
    setClaimName,
    claimValue,
    setClaimValue,
    normalizeOptions: [
      { value: '', label: t('portal.claim.normalize.exact') },
      { value: 'digits', label: t('portal.claim.normalize.digits') },
      { value: 'lowercase', label: t('portal.claim.normalize.lowercase') },
    ],
    claimNormalize,
    setClaimNormalize,
    identityRequired,
    canInvite: !!screen && !!recordId && email.trim() !== '' && !isInviting
      && (claimName ? claimValue.trim() !== '' : !identityRequired),
    isInviting,
    invite,
    describeSubject: subjects.describe,
    verifiedBadge,
    reloadSignIn,
  };
};
