import { useState, useCallback } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { useDI } from '../../../../infrastructure/di/useDI';
import { TenantMemberLimitReachedError } from '../../../../domain/errors';
import type { TenantMember } from '../../../../domain/entities';
import type { Role } from '../../../../domain/entities/Role';
import { useRoles } from '../../../../stores/useRoles';

import { useT, useLabel } from '../../../shared/i18n/useT';

export interface MembersTabViewModel {
  members: TenantMember[];
  isLoading: boolean;
  tenantOwnerId: string;
  currentUserId: string;
  addEmail: string;
  roles: Role[];
  addRoleIds: string[];
  isAddingMember: boolean;
  memberToRemove: TenantMember | null;
  memberLimit: number | null;
  memberCount: number;
  canAddMore: boolean;
  setAddEmail: (v: string) => void;
  setAddRoleIds: (v: string[]) => void;
  handleAddMember: () => Promise<void>;
  handleRolesChange: (member: TenantMember, roleIds: string[]) => Promise<void>;
  /** Os nomes dos perfis de um membro, já resolvidos — para quem só exibe. */
  memberRoleNames: (member: TenantMember) => string[];
  handleRemoveMember: (member: TenantMember) => void;
  confirmRemoveMember: () => Promise<void>;
  cancelRemoveMember: () => void;
}

export const useMembersTabViewModel = (): MembersTabViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { currentTenant, members, isLoading, addMember, updateMemberRoles, removeMember } = useTenant();
  const { roles } = useRoles();
  const { user } = useAuth();
  const { notify } = useNotification();
  const { userRepository } = useDI();

  const [addEmail, setAddEmail] = useState('');
  const [addRoleIds, setAddRoleIds] = useState<string[]>([]);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TenantMember | null>(null);

  const memberLimit = currentTenant?.memberLimit ?? null;
  const memberCount = members.length;
  const canAddMore = memberLimit === null || memberCount < memberLimit;

  const handleAddMember = useCallback(async () => {
    if (!canAddMore) {
      notify(t('member.limit-reached'), 'error');
      return;
    }

    const email = addEmail.trim().toLowerCase();
    if (!email) {
      notify(t('member.email-required'), 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify(t('member.email-invalid'), 'error');
      return;
    }

    setIsAddingMember(true);
    try {
      const found = await userRepository.getUserByEmail(email);
      if (!found) {
        notify(t('member.not-found'), 'error');
        return;
      }
      const alreadyMember = members.some((m) => m.userId === found.id);
      if (alreadyMember) {
        notify(t('member.already-member'), 'error');
        return;
      }
      await addMember({
        userId: found.id,
        tenantId: currentTenant?.id ?? '',
        roleIds: addRoleIds,
        displayName: found.displayName,
        email: found.email,
        photoURL: found.photoURL ?? null,
        addedBy: user?.id ?? '',
      });
      notify(t('member.added'), 'success');
      setAddEmail('');
      setAddRoleIds([]);
    } catch (err) {
      notify(
        err instanceof TenantMemberLimitReachedError ? label(err.message) : t('member.add-failed'),
        'error',
      );
    } finally {
      setIsAddingMember(false);
    }
  }, [canAddMore, addEmail, addRoleIds, addMember, currentTenant, user, members, userRepository, notify, t, label]);

  const handleRolesChange = useCallback(async (member: TenantMember, roleIds: string[]) => {
    try {
      await updateMemberRoles(member.userId, roleIds);
      notify(t('member.role-updated'), 'success');
    } catch {
      notify(t('member.role-update-failed'), 'error');
    }
  }, [updateMemberRoles, notify, t]);

  const memberRoleNames = useCallback(
    (member: TenantMember): string[] =>
      member.roleIds
        .map((roleId) => roles.find((role) => role.id === roleId))
        .filter((role): role is Role => !!role)
        .map((role) => label(role.name)),
    [roles, label],
  );

  const handleRemoveMember = useCallback((member: TenantMember) => {
    setMemberToRemove(member);
  }, []);

  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove) return;
    try {
      await removeMember(memberToRemove.userId);
      notify(t('member.removed'), 'success');
    } catch {
      notify(t('member.remove-failed'), 'error');
    } finally {
      setMemberToRemove(null);
    }
  }, [memberToRemove, removeMember, notify, t]);

  const cancelRemoveMember = useCallback(() => setMemberToRemove(null), []);

  return {
    members,
    isLoading,
    tenantOwnerId: currentTenant?.ownerId ?? '',
    currentUserId: user?.id ?? '',
    addEmail,
    roles,
    addRoleIds,
    isAddingMember,
    memberToRemove,
    memberLimit,
    memberCount,
    canAddMore,
    setAddEmail,
    setAddRoleIds,
    handleAddMember,
    handleRolesChange,
    memberRoleNames,
    handleRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,
  };
};
