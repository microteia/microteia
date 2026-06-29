import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetUsersUseCase } from '../../../domain/usecases/users/GetUsersUseCase';
import { makeUpdateUserRoleUseCase } from '../../../domain/usecases/users/UpdateUserRoleUseCase';
import type { AppUser, UserRole } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface AccessManagementViewModel {
  isUnauthorized: boolean;
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

export const useAccessManagementViewModel = (): AccessManagementViewModel => {
  const { user, userRole } = useAuth();
  const { userRepository } = useDI();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);

  const isUnauthorized = userRole !== 'SYSTEM';

  const getUsersUseCase = useMemo(() => makeGetUsersUseCase(userRepository), [userRepository]);
  const updateRoleUseCase = useMemo(() => makeUpdateUserRoleUseCase(userRepository), [userRepository]);

  useEffect(() => {
    if (isUnauthorized) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing loading state synchronously when unauthorized is architecturally required
      setLoading(false);
      return;
    }

    setLoading(true);
    getUsersUseCase.execute()
      .then(setUsers)
      .catch(() => setError('Não foi possível carregar os usuários.'))
      .finally(() => setLoading(false));
  }, [getUsersUseCase, isUnauthorized]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Nome ou e-mail...' },
  ], []);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
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
        setError('Erro ao atualizar o perfil do usuário.');
      } finally {
        setSavingUserId(null);
      }
    },
    [updateRoleUseCase],
  );

  const searchTerm = tokenMap['search']?.[0] ?? '';

  return {
    isUnauthorized,
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
