import { useState, useCallback } from 'react';
import { useTenant } from '../../../../stores/useTenant';
import { useAuth } from '../../../../stores/useAuth';
import { useNotification } from '../../../../stores/useNotification';
import { useDI } from '../../../../infrastructure/di/useDI';
import { TenantMemberLimitReachedError } from '../../../../domain/errors';
import type { TenantMember, TenantRole } from '../../../../domain/entities';

export const TENANT_ROLE_LABELS: Record<TenantRole, string> = {
  admin: 'Administrador',
  lawyer: 'Advogado',
  secretary: 'Secretário(a)',
  user: 'Usuário',
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
      notify('Limite de membros do escritório atingido.', 'error');
      return;
    }

    const email = addEmail.trim().toLowerCase();
    if (!email) {
      notify('Informe o e-mail do usuário.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('E-mail inválido.', 'error');
      return;
    }

    setIsAddingMember(true);
    try {
      const found = await userRepository.getUserByEmail(email);
      if (!found) {
        notify('Nenhum usuário cadastrado com esse e-mail.', 'error');
        return;
      }
      const alreadyMember = members.some((m) => m.userId === found.id);
      if (alreadyMember) {
        notify('Este usuário já é membro do escritório.', 'error');
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
  }, [canAddMore, addEmail, addRole, addMember, currentTenant, user, members, userRepository, notify]);

  const handleRoleChange = useCallback(async (member: TenantMember, role: TenantRole) => {
    try {
      await updateMemberRole(member.userId, role);
      notify('Permissão atualizada.', 'success');
    } catch {
      notify('Erro ao atualizar permissão.', 'error');
    }
  }, [updateMemberRole, notify]);

  const handleRemoveMember = useCallback((member: TenantMember) => {
    setMemberToRemove(member);
  }, []);

  const confirmRemoveMember = useCallback(async () => {
    if (!memberToRemove) return;
    try {
      await removeMember(memberToRemove.userId);
      notify('Membro removido do escritório.', 'success');
    } catch {
      notify('Erro ao remover membro.', 'error');
    } finally {
      setMemberToRemove(null);
    }
  }, [memberToRemove, removeMember, notify]);

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
