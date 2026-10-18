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
import type { PortalGuest } from '../../../../domain/entities/Portal';
import type { ScreenDefinition } from '../../../../domain/entities';
import { parsePortalSubjectKey, portalSubjectKey } from '../../../../domain/schema/portal';
import { portalSignInUrl } from '../../Portal/portalPaths';
import { useLabel, useT } from '../../../shared/i18n/useT';

export interface PortalSubjectChip {
  key: string;
  label: string;
}

export interface PortalGuestRow {
  userId: string;
  name: string;
  email: string;
  subjects: PortalSubjectChip[];
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

  const uc = useMemo(() => ({
    invite: makeInvitePortalGuestUseCase(portalRepository),
    revoke: makeRevokePortalGuestUseCase(portalRepository),
  }), [portalRepository]);

  const [screenId, setScreenIdState] = useState('');
  const [recordId, setRecordId] = useState('');
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [guests, setGuests] = useState<PortalGuest[]>([]);
  const [guestsLoading, setGuestsLoading] = useState(true);
  const [guestToRevoke, setGuestToRevoke] = useState<PortalGuestRow | null>(null);

  const tenantId = currentTenant?.id ?? null;

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

  const rows = useMemo<PortalGuestRow[]>(() => guests.map((guest) => ({
    userId: guest.userId,
    name: guest.displayName || guest.email,
    email: guest.email,
    subjects: guest.subjectKeys.map((key) => ({ key, label: subjectLabel(key) })),
  })), [guests, subjectLabel]);

  const sendLink = useCallback(async (target: string) => {
    if (!tenantId) return;
    await sendSignInLink(target, portalSignInUrl(window.location.origin, tenantId));
  }, [tenantId, sendSignInLink]);

  const invite = useCallback(async () => {
    const typed = email.trim();
    if (!tenantId || !screen || !recordId || !typed) return;
    setIsInviting(true);
    try {
      await uc.invite.execute(tenantId, typed, portalSubjectKey(collectionOf(screen), recordId));
      await sendLink(typed);
      notify(t('portal.invited', { email: typed }), 'success');
      setEmail('');
      setRecordId('');
    } catch (error) {
      notify(label(error instanceof Error ? error.message : '@core.tenant/portal.failed'), 'error');
    } finally {
      setIsInviting(false);
    }
  }, [email, tenantId, screen, recordId, uc.invite, sendLink, notify, t, label]);

  const resendLink = useCallback(async (guest: PortalGuestRow) => {
    try {
      await sendLink(guest.email);
      notify(t('portal.link.sent', { email: guest.email }), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    }
  }, [sendLink, notify, t]);

  const removeSubject = useCallback(async (guest: PortalGuestRow, subjectKey: string) => {
    if (!tenantId) return;
    try {
      await uc.revoke.execute(tenantId, guest.userId, subjectKey);
    } catch {
      notify(t('portal.failed'), 'error');
    }
  }, [tenantId, uc.revoke, notify, t]);

  const confirmRevoke = useCallback(async () => {
    if (!tenantId || !guestToRevoke) return;
    try {
      await uc.revoke.execute(tenantId, guestToRevoke.userId, null);
      notify(t('portal.revoked'), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    } finally {
      setGuestToRevoke(null);
    }
  }, [tenantId, guestToRevoke, uc.revoke, notify, t]);

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
    canInvite: !!screen && !!recordId && email.trim() !== '' && !isInviting,
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
  };
};
