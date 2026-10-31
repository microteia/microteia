import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { useRecords } from '../../../../stores/useRecords';
import { useDI } from '../../../../infrastructure/di/useDI';
import {
  makeInvitePortalGuestUseCase,
  makeRevokePortalGuestUseCase,
} from '../../../../domain/usecases/portal/PortalUseCases';
import type { PortalGuest, PortalIdentityInvite, PortalSignInSettingsView } from '../../../../domain/entities/Portal';
import { makeGetPortalSignInSettingsUseCase } from '../../../../domain/usecases/portal/PortalSignInUseCases';
import {
  PORTAL_CLAIM_NORMALIZERS,
  portalAttestedClaims,
  type PortalClaimNormalize,
  type PortalVerifiedIdentity,
} from '../../../../domain/schema/portalIdentity';
import type { ScreenDefinition } from '../../../../domain/entities';
import { parsePortalSubjectKey, portalSubjectKey } from '../../../../domain/schema/portal';
import { portalSubjectRoleOf, type PortalSubjectRole } from '../../../../domain/schema/portalRole';
import { portalSignInUrl } from '../../Portal/portalPaths';
import { useLabel, useT } from '../../../shared/i18n/useT';
import { useOptionalLocale } from '../../../../stores/useLocale';

export interface PortalSubjectChip {
  key: string;
  label: string;
}

export interface PortalGuestRow {
  userId: string;
  name: string;
  email: string;
  subjects: PortalSubjectChip[];
  /** O selo de quem entrou por um provedor: o provedor e o nível. `null` para quem entra pelo e-mail. */
  verified: string | null;
  suspended: boolean;
  /** O link de e-mail só serve a quem entra por ele. */
  canResendLink: boolean;
}

/** Um convite por identidade, como a aba o lista. */
export interface PortalIdentityInviteRow {
  id: string;
  name: string;
  email: string;
  /** A claim exigida, como o escritório a digitou: nome e valor. */
  claim: string;
  subjects: PortalSubjectChip[];
  accepted: boolean;
}

export interface PortalTabViewModel {
  hasSubjectScreens: boolean;
  screenOptions: Array<{ value: string; label: string }>;
  screenId: string;
  setScreenId: (value: string) => void;
  recordOptions: Array<{ value: string; label: string }>;
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
  guests: PortalGuestRow[];
  guestsLoading: boolean;
  resendLink: (guest: PortalGuestRow) => Promise<void>;
  removeSubject: (guest: PortalGuestRow, subjectKey: string) => Promise<void>;
  guestToRevoke: PortalGuestRow | null;
  requestRevoke: (guest: PortalGuestRow) => void;
  confirmRevoke: () => Promise<void>;
  cancelRevoke: () => void;
  identityInvites: PortalIdentityInviteRow[];
  removeInviteSubject: (invite: PortalIdentityInviteRow, subjectKey: string) => Promise<void>;
  inviteToRevoke: PortalIdentityInviteRow | null;
  requestRevokeInvite: (invite: PortalIdentityInviteRow) => void;
  confirmRevokeInvite: () => Promise<void>;
  cancelRevokeInvite: () => void;
  /** A configuração de entrada mudou — as claims que um convite pode exigir também. */
  reloadSignIn: () => void;
}

const collectionOf = (screen: ScreenDefinition): string => screen.dataCollection || screen.id;

const recordTitle = (screen: ScreenDefinition, record: Record<string, unknown>): string => {
  const value = record[screen.titleFieldKey];
  return typeof value === 'string' && value ? value : String(record.id ?? '');
};

export const usePortalTabViewModel = (): PortalTabViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { sendSignInLink } = useAuth();
  const { notify } = useNotification();
  const { definitions } = useScreenDefinitions();
  const { recordsByCollection } = useRecords();
  const { portalRepository } = useDI();
  const { locale } = useOptionalLocale();

  const uc = useMemo(() => ({
    invite: makeInvitePortalGuestUseCase(portalRepository),
    revoke: makeRevokePortalGuestUseCase(portalRepository),
    signIn: makeGetPortalSignInSettingsUseCase(portalRepository),
  }), [portalRepository]);

  const [screenId, setScreenIdState] = useState('');
  const [recordId, setRecordId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [guests, setGuests] = useState<PortalGuest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(true);
  const [guestToRevoke, setGuestToRevoke] = useState<PortalGuestRow | null>(null);
  const [identityInvites, setIdentityInvites] = useState<PortalIdentityInvite[]>([]);
  const [inviteToRevoke, setInviteToRevoke] = useState<PortalIdentityInviteRow | null>(null);
  const [signIn, setSignIn] = useState<PortalSignInSettingsView | null>(null);
  const [signInVersion, setSignInVersion] = useState(0);
  const [claimName, setClaimName] = useState('');
  const [claimValue, setClaimValue] = useState('');
  const [claimNormalize, setClaimNormalize] = useState('');

  const tenantId = currentTenant?.id ?? null;

  useEffect(() => {
    if (!tenantId) return;
    return portalRepository.subscribeIdentityInvites(tenantId, setIdentityInvites, () => setIdentityInvites([]));
  }, [tenantId, portalRepository]);

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

  useEffect(() => {
    if (!tenantId) return;
    return portalRepository.subscribeGuests(
      tenantId,
      (next) => {
        setGuests(next);
        setGuestsLoading(false);
      },
      () => setGuestsLoading(false),
    );
  }, [tenantId, portalRepository]);

  const subjectScreens = useMemo(
    () => definitions.filter((screen) => screen.portal?.subject === 'self'),
    [definitions],
  );

  const screen = useMemo(() => subjectScreens.find((one) => one.id === screenId) ?? null, [subjectScreens, screenId]);

  const recordOptions = useMemo(() => {
    if (!screen) return [];
    return (recordsByCollection[collectionOf(screen)] ?? []).map((record) => ({
      value: record.id,
      label: recordTitle(screen, record),
    }));
  }, [screen, recordsByCollection]);

  const subjectLabel = useCallback((subjectKey: string): string => {
    const parsed = parsePortalSubjectKey(subjectKey);
    if (!parsed) return subjectKey;
    const owner = definitions.find((one) => collectionOf(one) === parsed.collection);
    const record = recordsByCollection[parsed.collection]?.find((one) => one.id === parsed.recordId);
    const title = owner && record ? recordTitle(owner, record) : parsed.recordId;
    return owner ? `${label(owner.titleSingular)}: ${title}` : title;
  }, [definitions, recordsByCollection, label]);

  const subjectWithRole = useCallback((key: string, roles: PortalSubjectRole[]): string => {
    const subjectRole = portalSubjectRoleOf(roles, key);
    return subjectRole ? t('portal.subject.role', { subject: subjectLabel(key), role: subjectRole }) : subjectLabel(key);
  }, [subjectLabel, t]);

  const rows = useMemo<PortalGuestRow[]>(() => guests.map((guest) => ({
    userId: guest.userId,
    name: guest.displayName || guest.email,
    email: guest.email,
    subjects: guest.subjectKeys.map((key) => ({ key, label: subjectWithRole(key, guest.subjectRoles) })),
    verified: verifiedBadge(guest.identity),
    suspended: guest.suspended === true,
    canResendLink: !guest.identity && !identityRequired,
  })), [guests, subjectWithRole, verifiedBadge, identityRequired]);

  const inviteRows = useMemo<PortalIdentityInviteRow[]>(() => identityInvites.map((invite) => ({
    id: invite.id,
    name: invite.displayName || invite.email,
    email: invite.email,
    claim: `${invite.claim.name}: ${invite.claim.value}`,
    subjects: invite.subjectKeys.map((key) => ({ key, label: subjectWithRole(key, invite.subjectRoles) })),
    accepted: invite.accepted,
  })), [identityInvites, subjectWithRole]);

  const sendLink = useCallback(async (target: string) => {
    if (!tenantId) return;
    await sendSignInLink(target, portalSignInUrl(window.location.origin, tenantId, { email: target, locale }), locale);
  }, [tenantId, sendSignInLink, locale]);

  /**
   * O link é OUTRO passo, e pode falhar sozinho: o convite já está gravado quando o Firebase recusa o
   * envio. Dizer só "falhou" fazia parecer que o convite inteiro não existia — e o motivo mais comum,
   * o login por link desligado no projeto, é configuração, não defeito.
   */
  const linkFailureMessage = useCallback((error: unknown, target: string): string =>
    ((error as { code?: string } | null)?.code === 'auth/operation-not-allowed'
      ? t('portal.link.not-enabled', { email: target })
      : t('portal.link.failed', { email: target })), [t]);

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
      await uc.invite.execute(tenantId, typed, portalSubjectKey(collectionOf(screen), recordId), locale, requiredClaim, role.trim() || undefined);
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
      await sendLink(typed);
      notify(t('portal.invited', { email: typed }), 'success');
    } catch (error) {
      notify(linkFailureMessage(error, typed), 'error');
    } finally {
      setIsInviting(false);
    }
  }, [email, tenantId, screen, recordId, uc.invite, sendLink, notify, t, label, linkFailureMessage, locale, claimName, claimValue, claimNormalize, role]);

  const resendLink = useCallback(async (guest: PortalGuestRow) => {
    try {
      await sendLink(guest.email);
      notify(t('portal.link.sent', { email: guest.email }), 'success');
    } catch (error) {
      notify(linkFailureMessage(error, guest.email), 'error');
    }
  }, [sendLink, notify, t, linkFailureMessage]);

  const removeSubject = useCallback(async (guest: PortalGuestRow, subjectKey: string) => {
    if (!tenantId) return;
    try {
      await uc.revoke.execute(tenantId, { userId: guest.userId }, subjectKey);
    } catch {
      notify(t('portal.failed'), 'error');
    }
  }, [tenantId, uc.revoke, notify, t]);

  const confirmRevoke = useCallback(async () => {
    if (!tenantId || !guestToRevoke) return;
    try {
      await uc.revoke.execute(tenantId, { userId: guestToRevoke.userId }, null);
      notify(t('portal.revoked'), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    } finally {
      setGuestToRevoke(null);
    }
  }, [tenantId, guestToRevoke, uc.revoke, notify, t]);

  const removeInviteSubject = useCallback(async (row: PortalIdentityInviteRow, subjectKey: string) => {
    if (!tenantId) return;
    try {
      await uc.revoke.execute(tenantId, { inviteId: row.id }, subjectKey);
    } catch {
      notify(t('portal.failed'), 'error');
    }
  }, [tenantId, uc.revoke, notify, t]);

  const confirmRevokeInvite = useCallback(async () => {
    if (!tenantId || !inviteToRevoke) return;
    try {
      await uc.revoke.execute(tenantId, { inviteId: inviteToRevoke.id }, null);
      notify(t('portal.revoked'), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    } finally {
      setInviteToRevoke(null);
    }
  }, [tenantId, inviteToRevoke, uc.revoke, notify, t]);

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
    guests: rows,
    guestsLoading,
    resendLink,
    removeSubject,
    guestToRevoke,
    requestRevoke: setGuestToRevoke,
    confirmRevoke,
    cancelRevoke: () => setGuestToRevoke(null),
    identityInvites: inviteRows,
    removeInviteSubject,
    inviteToRevoke,
    requestRevokeInvite: setInviteToRevoke,
    confirmRevokeInvite,
    cancelRevokeInvite: () => setInviteToRevoke(null),
    reloadSignIn,
  };
};
