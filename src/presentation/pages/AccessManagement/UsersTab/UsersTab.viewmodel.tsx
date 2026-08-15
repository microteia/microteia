import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../../stores/useAuth';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeGetUsersUseCase } from '../../../../domain/usecases/users/GetUsersUseCase';
import { makeUpdateUserRoleUseCase } from '../../../../domain/usecases/users/UpdateUserRoleUseCase';
import type { AppUser, UserRole } from '../../../../domain/entities';
import type { FilterDef, FilterToken } from '../../../components/ui/CompositeFilter';

import { useT } from '../../../shared/i18n/useT';
export interface UsersTabViewModel {
  loading: boolean;
  error: string | null;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  searchTerm: string;
  filteredUsers: AppUser[];
  totalCount: number;
  savingUserId: string | null;
  currentUserId: string | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  handleRoleChange: (userId: string, role: UserRole) => Promise<void>;
}

export const useUsersTabViewModel = (): UsersTabViewModel => {
  const t = useT('core.admin');
  const { user } = useAuth();
  const { userRepository } = useDI();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const getUsersUseCase = useMemo(() => makeGetUsersUseCase(userRepository), [userRepository]);
  const updateRoleUseCase = useMemo(() => makeUpdateUserRoleUseCase(userRepository), [userRepository]);

  useEffect(() => {
    getUsersUseCase.execute()
      .then(setUsers)
      .catch(() => setError(t('access.users.load-failed')))
      .finally(() => setLoading(false));
  }, [getUsersUseCase, t]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      key: 'search',
      label: t('core.ui/filter.search'),
      type: 'text',
      placeholder: t('access.users.filter.search.placeholder'),
    },
  ], [t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  const filteredUsers = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    if (!searchQ) return users;
    return users.filter(
      (u) =>
        u.displayName.toLowerCase().includes(searchQ) ||
        u.email.toLowerCase().includes(searchQ),
    );
  }, [users, tokenMap]);

  const handleRoleChange = useCallback(
    async (userId: string, role: UserRole) => {
      setSavingUserId(userId);
      try {
        await updateRoleUseCase.execute(userId, role);
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role } : u)),
        );
      } catch {
        setError(t('access.users.role-update-failed'));
      } finally {
        setSavingUserId(null);
      }
    },
    [updateRoleUseCase, t],
  );

  const searchTerm = tokenMap['search']?.[0] ?? '';

  return {
    loading,
    error,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'access-management',
    searchTerm,
    filteredUsers,
    totalCount: users.length,
    savingUserId,
    currentUserId: user?.id ?? null,
    setFilterTokens,
    handleRoleChange,
  };
};
