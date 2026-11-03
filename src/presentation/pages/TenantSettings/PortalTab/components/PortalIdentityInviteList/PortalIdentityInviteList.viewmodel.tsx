import { useCallback, useMemo, useState } from 'react';
import { useTenant } from '../../../../../../stores/useTenant';
import { useNotification } from '../../../../../../stores/useNotification';
import { useDI } from '../../../../../../infrastructure/di/useDI';
import { makeRevokePortalGuestUseCase } from '../../../../../../domain/usecases/portal/PortalUseCases';
import type { PortalIdentityInvite } from '../../../../../../domain/entities/Portal';
import type { PortalSubjectRole } from '../../../../../../domain/schema/portalRole';
import { useT } from '../../../../../shared/i18n/useT';
import { usePortalPagedList, type PortalListSubscriber, type PortalPagedList } from '../../usePortalPagedList';
import type { PortalSubjectChip } from '../PortalAccessRow';

export interface PortalIdentityInviteListProps {
  describeSubject: (subjectKey: string, roles: PortalSubjectRole[]) => string;
}

/** Um convite por identidade, como a aba o lista. */
export interface PortalIdentityInviteRow {
  id: string;
  name: string;
  /** O e-mail e a situação: aceito, ou esperando a primeira entrada. */
  meta: string;
  /** A claim exigida, como o escritório a digitou: nome e valor. */
  claim: string;
  subjects: PortalSubjectChip[];
}

export interface PortalIdentityInviteListViewModel {
  /** Sem convite nenhum, a lista nem aparece — o escritório que não usa provedor não a vê. */
  visible: boolean;
  list: PortalPagedList<PortalIdentityInvite> & { count: number };
  rows: PortalIdentityInviteRow[];
  removeSubject: (row: PortalIdentityInviteRow, subjectKey: string) => Promise<void>;
  inviteToRevoke: PortalIdentityInviteRow | null;
  requestRevoke: (row: PortalIdentityInviteRow) => void;
  confirmRevoke: () => Promise<void>;
  cancelRevoke: () => void;
}

export const usePortalIdentityInviteListViewModel = ({
  describeSubject,
}: PortalIdentityInviteListProps): PortalIdentityInviteListViewModel => {
  const t = useT('core.tenant');
  const { currentTenant } = useTenant();
  const { notify } = useNotification();
  const { portalRepository } = useDI();
  const tenantId = currentTenant?.id ?? null;
  const revoke = useMemo(() => makeRevokePortalGuestUseCase(portalRepository), [portalRepository]);
  const [inviteToRevoke, setInviteToRevoke] = useState<PortalIdentityInviteRow | null>(null);

  const subscribe = useMemo<PortalListSubscriber<PortalIdentityInvite> | null>(
    () => (tenantId
      ? (page, onUpdate, onError) => portalRepository.subscribeIdentityInvites(tenantId, page, onUpdate, onError)
      : null),
    [tenantId, portalRepository],
  );
  const list = usePortalPagedList(subscribe);

  const rows = useMemo<PortalIdentityInviteRow[]>(() => list.items.map((invite) => ({
    id: invite.id,
    name: invite.displayName || invite.email,
    meta: `${invite.email} · ${invite.accepted ? t('portal.identity-invite.accepted') : t('portal.identity-invite.pending')}`,
    claim: `${invite.claim.name}: ${invite.claim.value}`,
    subjects: invite.subjectKeys.map((key) => ({ key, label: describeSubject(key, invite.subjectRoles) })),
  })), [list.items, describeSubject, t]);

  const removeSubject = useCallback(async (row: PortalIdentityInviteRow, subjectKey: string) => {
    if (!tenantId) return;
    try {
      await revoke.execute(tenantId, { inviteId: row.id }, subjectKey);
    } catch {
      notify(t('portal.failed'), 'error');
    }
  }, [tenantId, revoke, notify, t]);

  const confirmRevoke = useCallback(async () => {
    if (!tenantId || !inviteToRevoke) return;
    try {
      await revoke.execute(tenantId, { inviteId: inviteToRevoke.id }, null);
      notify(t('portal.revoked'), 'success');
    } catch {
      notify(t('portal.failed'), 'error');
    } finally {
      setInviteToRevoke(null);
    }
  }, [tenantId, inviteToRevoke, revoke, notify, t]);

  return {
    visible: !list.isEmpty && (!list.loading || list.page > 1 || list.term !== ''),
    list: { ...list, count: rows.length },
    rows,
    removeSubject,
    inviteToRevoke,
    requestRevoke: setInviteToRevoke,
    confirmRevoke,
    cancelRevoke: () => setInviteToRevoke(null),
  };
};
