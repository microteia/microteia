import { useCallback, useMemo, useState } from 'react';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useDI } from '../../../../../../infrastructure/di/useDI';
import { makeRevokePortalGuestUseCase } from '../../../../../../domain/usecases/portal/PortalUseCases';
import type { PortalGuest } from '../../../../../../domain/entities/Portal';
import type { PortalVerifiedIdentity } from '../../../../../../domain/schema/portalIdentity';
import type { PortalSubjectRole } from '../../../../../../domain/schema/portalRole';
import { useT } from '../../../../../shared/i18n/useT';
import { usePortalPagedList, type PortalListSubscriber, type PortalPagedList } from '../../usePortalPagedList';
import { usePortalSignInLink } from '../../usePortalSignInLink';
import type { PortalSubjectChip } from '../PortalAccessRow';

export interface PortalGuestListProps {
  describeSubject: (subjectKey: string, roles: PortalSubjectRole[]) => string;
  verifiedBadge: (identity: PortalVerifiedIdentity | undefined) => string | null;
  /** O escritório desligou o link de e-mail — não há o que reenviar. */
  identityRequired: boolean;
}

export interface PortalGuestRow {
  userId: string;
  name: string;
  email: string;
  /** O e-mail embaixo do nome — ausente quando o nome É o e-mail. */
  meta: string | null;
  subjects: PortalSubjectChip[];
  /** O selo de quem entrou por um provedor: o provedor e o nível. `null` para quem entra pelo e-mail. */
  verified: string | null;
  suspended: boolean;
  /** O link de e-mail só serve a quem entra por ele. */
  canResendLink: boolean;
}

export interface PortalGuestListViewModel {
  list: PortalPagedList<PortalGuest> & { count: number };
  rows: PortalGuestRow[];
  resendLink: (row: PortalGuestRow) => Promise<void>;
  removeSubject: (row: PortalGuestRow, subjectKey: string) => Promise<void>;
  guestToRevoke: PortalGuestRow | null;
  requestRevoke: (row: PortalGuestRow) => void;
  confirmRevoke: () => Promise<void>;
  cancelRevoke: () => void;
}

export const usePortalGuestListViewModel = ({
  describeSubject, verifiedBadge, identityRequired,
}: PortalGuestListProps): PortalGuestListViewModel => {
  const t = useT('core.tenant');
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const { portalRepository } = useDI();
  const link = usePortalSignInLink();
  const tenantId = currentTenant?.id ?? null;
  const revoke = useMemo(() => makeRevokePortalGuestUseCase(portalRepository), [portalRepository]);
  const [guestToRevoke, setGuestToRevoke] = useState<PortalGuestRow | null>(null);

  const subscribe = useMemo<PortalListSubscriber<PortalGuest> | null>(
    () => (tenantId
      ? (page, onUpdate, onError) => portalRepository.subscribeGuests(tenantId, page, onUpdate, onError)
      : null),
    [tenantId, portalRepository],
  );
  const list = usePortalPagedList(subscribe);

  const rows = useMemo<PortalGuestRow[]>(() => list.items.map((guest) => {
    const name = guest.displayName || guest.email;
    return {
      userId: guest.userId,
      name,
      email: guest.email,
      meta: name !== guest.email ? guest.email : null,
      subjects: guest.subjectKeys.map((key) => ({ key, label: describeSubject(key, guest.subjectRoles) })),
      verified: verifiedBadge(guest.identity),
      suspended: guest.suspended === true,
      canResendLink: !guest.identity && !identityRequired,
    };
  }), [list.items, describeSubject, verifiedBadge, identityRequired]);

  const resendLink = useCallback(async (row: PortalGuestRow) => {
    try {
      await link.send(row.email);
      notify(t('portal.link.sent', { email: row.email }), 'success');
    } catch (error) {
      notify(link.failureMessage(error, row.email), 'error');
    }
  }, [link, notify, t]);

  const removeSubject = useCallback(async (row: PortalGuestRow, subjectKey: string) => {
    if (!tenantId) return;
    try {
      await revoke.execute(tenantId, { userId: row.userId }, subjectKey);
    } catch {
      notify(t('portal.failed'), 'error');
    }
  }, [tenantId, revoke, notify, t]);

  const confirmRevoke = useCallback(async () => {
    if (!tenantId || !guestToRevoke) return;
    try {
      await revoke.execute(tenantId, { userId: guestToRevoke.userId }, null);
      notify(t('portal.revoked'), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    } finally {
      setGuestToRevoke(null);
    }
  }, [tenantId, guestToRevoke, revoke, notify, t]);

  return {
    list: { ...list, count: rows.length },
    rows,
    resendLink,
    removeSubject,
    guestToRevoke,
    requestRevoke: setGuestToRevoke,
    confirmRevoke,
    cancelRevoke: () => setGuestToRevoke(null),
  };
};
