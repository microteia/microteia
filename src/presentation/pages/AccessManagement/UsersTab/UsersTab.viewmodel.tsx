import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../../../stores/useAuth';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeGetUsersUseCase } from '../../../../domain/usecases/users/GetUsersUseCase';
import { makeUpdateUserRoleUseCase } from '../../../../domain/usecases/users/UpdateUserRoleUseCase';
import { makeGetRegistrationPolicyUseCase } from '../../../../domain/usecases/registration/GetRegistrationPolicyUseCase';
import { makeUpdateRegistrationPolicyUseCase } from '../../../../domain/usecases/registration/UpdateRegistrationPolicyUseCase';
import { useNotification } from '../../../../stores/useNotification';
import type { AppUser, UserRole } from '../../../../domain/entities';
import type { RegistrationPolicy } from '../../../../domain/schema/registration';
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
  /** O que a instalação faz com quem chega pela primeira vez; `null` enquanto carrega ou se não foi lido. */
  blockNewAccounts: boolean | null;
  blockAutomaticOrganizations: boolean | null;
  savingRegistration: boolean;
  setBlockNewAccounts: (block: boolean) => Promise<void>;
  setBlockAutomaticOrganizations: (block: boolean) => Promise<void>;
}

export const useUsersTabViewModel = (): UsersTabViewModel => {
  const t = useT('core.admin');
  const { user } = useAuth();
  const { userRepository, registrationPolicyRepository } = useDI();
  const { notify } = useNotification();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<RegistrationPolicy | null>(null);
  const [savingRegistration, setSavingRegistration] = useState(false);

  const getUsersUseCase = useMemo(() => makeGetUsersUseCase(userRepository), [userRepository]);
  const updateRoleUseCase = useMemo(() => makeUpdateUserRoleUseCase(userRepository), [userRepository]);
  const getRegistrationPolicyUseCase = useMemo(
    () => makeGetRegistrationPolicyUseCase(registrationPolicyRepository),
    [registrationPolicyRepository],
  );
  const updateRegistrationPolicyUseCase = useMemo(
    () => makeUpdateRegistrationPolicyUseCase(registrationPolicyRepository),
    [registrationPolicyRepository],
  );

  useEffect(() => {
    getRegistrationPolicyUseCase.execute()
      .then(setPolicy)
      .catch(() => notify(t('access.registration.load-failed'), 'error'));
  }, [getRegistrationPolicyUseCase, notify, t]);

  const changePolicy = useCallback(async (change: Partial<RegistrationPolicy>, doneKey: string) => {
    if (!user) return;
    setSavingRegistration(true);
    try {
      await updateRegistrationPolicyUseCase.execute(change, user.id);
      setPolicy((current) => (current ? { ...current, ...change } : current));
      notify(t(doneKey), 'success');
    } catch {
      notify(t('access.registration.update-failed'), 'error');
    } finally {
      setSavingRegistration(false);
    }
  }, [updateRegistrationPolicyUseCase, user, notify, t]);

  const setBlockNewAccounts = useCallback(
    (block: boolean) => changePolicy(
      { acceptNewAccounts: !block },
      block ? 'access.registration.blocked' : 'access.registration.opened',
    ),
    [changePolicy],
  );

  const setBlockAutomaticOrganizations = useCallback(
    (block: boolean) => changePolicy(
      { selfServiceTenants: !block },
      block ? 'access.registration.organizations.blocked' : 'access.registration.organizations.opened',
    ),
    [changePolicy],
  );

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
    blockNewAccounts: policy ? !policy.acceptNewAccounts : null,
    blockAutomaticOrganizations: policy ? !policy.selfServiceTenants : null,
    savingRegistration,
    setBlockNewAccounts,
    setBlockAutomaticOrganizations,
  };
};
