import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { TenantContext } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { makeGetTenantsForUserUseCase } from '../domain/usecases/tenants/GetTenantsForUserUseCase';
import { makeGetAllTenantsUseCase } from '../domain/usecases/tenants/GetAllTenantsUseCase';
import {
  makeAddTenantMemberUseCase,
  makeUpdateTenantMemberRoleUseCase,
  makeRemoveTenantMemberUseCase,
  makeGetTenantMembersUseCase,
} from '../domain/usecases/tenants/ManageTenantMembersUseCase';
import { makeUpdateTenantUseCase } from '../domain/usecases/tenants/UpdateTenantUseCase';
import type { Tenant, TenantMember, TenantRole } from '../domain/entities';

const TENANT_STORAGE_KEY = 'curatino:lastTenantId';

export const TenantStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole, effectiveName } = useAuth();
  const { tenantRepository } = useDI();

  // SYSTEM e SUPPORT enxergam e administram todos os tenants, mesmo sem ser membro.
  const isElevated = userRole === 'SYSTEM' || userRole === 'SUPPORT';

  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenantRole, setTenantRole] = useState<TenantRole | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const uc = useMemo(() => ({
    getForUser: makeGetTenantsForUserUseCase(tenantRepository),
    getAll: makeGetAllTenantsUseCase(tenantRepository),
    update: makeUpdateTenantUseCase(tenantRepository),
    addMember: makeAddTenantMemberUseCase(tenantRepository),
    updateRole: makeUpdateTenantMemberRoleUseCase(tenantRepository),
    removeMember: makeRemoveTenantMemberUseCase(tenantRepository),
    getMembers: makeGetTenantMembersUseCase(tenantRepository),
  }), [tenantRepository]);

  const loadMembers = useCallback(async (tenantId: string) => {
    const list = await uc.getMembers.execute(tenantId);
    setMembers(list);
  }, [uc.getMembers]);

  const applyTenant = useCallback(async (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
    if (user) {
      const role = isElevated ? 'admin' : await tenantRepository.getMemberRole(tenant.id, user.id);
      setTenantRole(role);
      await loadMembers(tenant.id);
    }
  }, [tenantRepository, user, loadMembers, isElevated]);

  const selectTenant = useCallback(async (tenantId: string) => {
    const tenant = availableTenants.find((t) => t.id === tenantId) ??
      await tenantRepository.getTenantById(tenantId);
    if (tenant) await applyTenant(tenant);
  }, [availableTenants, tenantRepository, applyTenant]);

  const updateTenant = useCallback(async (data: Partial<Omit<Tenant, 'id' | 'ownerId' | 'createdAt'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, data);
    setCurrentTenant((prev) => prev ? { ...prev, ...data } : prev);
    setAvailableTenants((prev) =>
      prev.map((t) => t.id === currentTenant.id ? { ...t, ...data } : t),
    );
  }, [currentTenant, uc.update]);

  const addMember = useCallback(async (member: Omit<TenantMember, 'addedAt'>) => {
    if (!currentTenant) return;
    await uc.addMember.execute(currentTenant.id, member);
    await loadMembers(currentTenant.id);
  }, [currentTenant, uc.addMember, loadMembers]);

  const updateMemberRole = useCallback(async (userId: string, role: TenantRole) => {
    if (!currentTenant || !user) return;
    await uc.updateRole.execute(currentTenant.id, userId, role, {
      uid: user.id,
      name: effectiveName,
      photoURL: user.photoURL,
    });
    setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, role } : m));
  }, [currentTenant, user, effectiveName, uc.updateRole]);

  const removeMember = useCallback(async (userId: string) => {
    if (!currentTenant) return;
    await uc.removeMember.execute(currentTenant.id, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }, [currentTenant, uc.removeMember]);

  const refreshMembers = useCallback(async () => {
    if (currentTenant) await loadMembers(currentTenant.id);
  }, [currentTenant, loadMembers]);

  useEffect(() => {
    const handleStorageSync = (e: StorageEvent) => {
      if (e.key !== TENANT_STORAGE_KEY || !e.newValue) return;
      if (e.newValue !== currentTenant?.id) void selectTenant(e.newValue);
    };
    window.addEventListener('storage', handleStorageSync);
    return () => window.removeEventListener('storage', handleStorageSync);
  }, [currentTenant, selectTenant]);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting all tenant state synchronously when user logs out is architecturally required
      setAvailableTenants([]);
      setCurrentTenant(null);
      setTenantRole(null);
      setMembers([]);
      setIsLoading(false);
      return;
    }

    const init = async () => {
      setIsLoading(true);
      setInitError(null);
      try {
        const tenants = isElevated
          ? await uc.getAll.execute()
          : await uc.getForUser.execute(user.id);
        tenants.sort((a, b) => a.name.localeCompare(b.name));

        // O onboarding (users/, userProfiles/ e o tenant próprio) é feito inteiramente
        // pela Cloud Function onUserCreated antes do AuthContext liberar o usuário —
        // chegar aqui sem nenhum tenant indica falha no provisionamento server-side.
        if (tenants.length === 0) {
          throw new Error('Nenhum escritório encontrado para este usuário. Recarregue a página; se o problema persistir, contate o suporte.');
        }

        setAvailableTenants(tenants);

        const lastId = localStorage.getItem(TENANT_STORAGE_KEY);
        const preferred =
          tenants.find((t) => t.id === lastId) ??
          tenants.find((t) => t.ownerId === user.id) ??
          tenants[0];
        await applyTenant(preferred);
      } catch (err) {
        console.error('[TenantStore] init error:', err);
        setInitError(
          err instanceof Error ? err.message : 'Falha ao carregar dados do escritório.',
        );
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, [user, isElevated]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TenantContext.Provider value={{
      currentTenant,
      availableTenants,
      tenantRole,
      members,
      isLoading,
      initError,
      selectTenant,
      updateTenant,
      addMember,
      updateMemberRole,
      removeMember,
      refreshMembers,
    }}>
      {children}
    </TenantContext.Provider>
  );
};
