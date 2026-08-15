import { useState, useCallback } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { useDI } from '../../../../infrastructure/di/useDI';
import { TenantMemberLimitReachedError } from '../../../../domain/errors';
import type { TenantMember, TenantRole } from '../../../../domain/entities';

import { useT } from '../../../shared/i18n/useT';
/** O nome de cada perfil como CHAVE do namespace `core.admin`; quem exibe resolve com `useT`. */
export const TENANT_ROLE_KEYS: Record<TenantRole, string> = {
  admin: 'role.admin',
  lawyer: 'role.lawyer',
  secretary: 'role.secretary',
  user: 'role.user',
};

export interface MembersTabViewModel {
  members: TenantMember[];
  isLoading: boolean;
  tenantOwnerId: string;
  currentUserId: string;
  addEmail: string;
  addRole: TenantRole;
  isAddingMember: boolean;
  memberToRemove: TenantMember | null;
  memberLimit: number | null;
  memberCount: number;
  canAddMore: boolean;
  setAddEmail: (v: string) => void;
  setAddRole: (v: TenantRole) => void;
  handleAddMember: () => Promise<void>;
  handleRoleChange: (member: TenantMember, role: TenantRole) => Promise<void>;
  handleRemoveMember: (member: TenantMember) => void;
  confirmRemoveMember: () => Promise<void>;
  cancelRemoveMember: () => void;
}

export const useMembersTabViewModel = (): MembersTabViewModel => {
  const t = useT('core.admin');
  const { currentTenant, members, isLoading, addMember, updateMemberRole, removeMember } = useTenant();
  const { user } = useAuth();
  const { notify } = useNotification();
  const { userRepository } = useDI();

  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<TenantRole>('user');
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
        role: addRole,
        displayName: found.displayName,
        email: found.email,
        photoURL: found.photoURL ?? null,
        addedBy: user?.id ?? '',
      });
      notify('Membro adicionado com sucesso!', 'success');
      setAddEmail('');
      setAddRole('user');
    } catch (err) {
      notify(
        err instanceof TenantMemberLimitReachedError ? err.message : 'Erro ao adicionar membro.',
        'error',
      );
    } finally {
      setIsAddingMember(false);
    }
  }, [canAddMore, addEmail, addRole, addMember, currentTenant, user, members, userRepository, notify, t]);

  const handleRoleChange = useCallback(async (member: TenantMember, role: TenantRole) => {
    try {
      await updateMemberRole(member.userId, role);
      notify(t('member.role-updated'), 'success');
    } catch {
      notify(t('member.role-update-failed'), 'error');
    }
  }, [updateMemberRole, notify, t]);

  const handleRemoveMember = useCallback((member: TenantMember) => {
    setMemberToRemove(member);
  }, []);

  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove) return;
    try {
      await removeMember(memberToRemove.userId);
      notify(t('member.removed'), 'success');
    } catch {
      notify('Erro ao remover membro.', 'error');
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
    addRole,
    isAddingMember,
    memberToRemove,
    memberLimit,
    memberCount,
    canAddMore,
    setAddEmail,
    setAddRole,
    handleAddMember,
    handleRoleChange,
    handleRemoveMember,
    confirmRemoveMember,
    cancelRemoveMember,
  };
};
