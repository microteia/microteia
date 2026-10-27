import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { TenantContext } from './useTenant';
import type { TenantSecondFactor } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { makeGetTenantsForUserUseCase } from '../domain/usecases/tenants/GetTenantsForUserUseCase';
import { makeGetAllTenantsUseCase } from '../domain/usecases/tenants/GetAllTenantsUseCase';
import {
  makeAddTenantMemberUseCase,
  makeUpdateTenantMemberRolesUseCase,
  makeRemoveTenantMemberUseCase,
  makeGetTenantMembersUseCase,
} from '../domain/usecases/tenants/ManageTenantMembersUseCase';
import { makeUpdateTenantUseCase } from '../domain/usecases/tenants/UpdateTenantUseCase';
import { makeListPortalMembershipsUseCase } from '../domain/usecases/portal/PortalUseCases';
import type { Tenant, TenantMember, TenantUpdate } from '../domain/entities';
import { setDeepLinkTenant } from '../infrastructure/deeplink/deepLinkUtils';
import { sameMfaRequirement } from '../domain/schema/memberMfa';

const TENANT_STORAGE_KEY = 'microteia:lastTenantId';

export const TenantStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userRole, effectiveName, signInWithToken } = useAuth();
  const { tenantRepository, portalRepository, authRepository } = useDI();

  // SYSTEM enxerga e administra todos os escritórios, mesmo sem ser membro.
  const isElevated = userRole === 'SYSTEM';

  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [members, setMembers] = useState<TenantMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [portalOnly, setPortalOnly] = useState(false);
  const [awaitingOrganization, setAwaitingOrganization] = useState(false);
  const [secondFactor, setSecondFactor] = useState<TenantSecondFactor | null>(null);

  const uc = useMemo(() => ({
    getForUser: makeGetTenantsForUserUseCase(tenantRepository),
    getAll: makeGetAllTenantsUseCase(tenantRepository),
    update: makeUpdateTenantUseCase(tenantRepository),
    addMember: makeAddTenantMemberUseCase(tenantRepository),
    updateRoles: makeUpdateTenantMemberRolesUseCase(tenantRepository),
    removeMember: makeRemoveTenantMemberUseCase(tenantRepository),
    getMembers: makeGetTenantMembersUseCase(tenantRepository),
    portalMemberships: makeListPortalMembershipsUseCase(portalRepository),
  }), [tenantRepository, portalRepository]);

  const loadMembers = useCallback(async (tenantId: string) => {
    const list = await uc.getMembers.execute(tenantId);
    setMembers(list);
  }, [uc.getMembers]);

  /**
   * Entrar no escritório é escolher E provar o segundo fator, quando ele exige. As três leituras correm
   * juntas — a exigência (o próprio documento de membro, que as regras liberam antes da prova), a claim
   * da sessão e a lista de membros —, para que quem nunca ligou a política não espere nada a mais.
   *
   * Exigido e não provado, a lista NEM É olhada: as regras a recusam, e a recusa não é falha a mostrar —
   * é a vez do `TenantEntryGate`, que pede o código e chama `completeSecondFactor`.
   *
   * O administrador global não é alcançado por política de escritório, como nas regras.
   */
  const applyTenant = useCallback(async (tenant: Tenant) => {
    setCurrentTenant(tenant);
    localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
    setDeepLinkTenant(tenant.id);
    // Nenhum papel é lido aqui: quem responde o que esta pessoa pode é o `AuthorizationStore`, a
    // partir dos perfis do escritório e do documento de membro que `loadMembers` traz.
    if (!user) return;
    const [requirement, verifiedAt, list] = await Promise.allSettled([
      isElevated ? Promise.resolve(null) : tenantRepository.getSecondFactorRequirement(tenant.id, user.id),
      authRepository.getSecondFactorVerifiedAt(),
      uc.getMembers.execute(tenant.id),
    ]);
    const gate: TenantSecondFactor = {
      tenantId: tenant.id,
      requirement: requirement.status === 'fulfilled' ? requirement.value : null,
      verifiedAt: verifiedAt.status === 'fulfilled' ? verifiedAt.value : null,
    };
    setSecondFactor(gate);
    if (gate.requirement && gate.verifiedAt === null) {
      setMembers([]);
      return;
    }
    if (list.status === 'rejected') throw list.reason;
    setMembers(list.value);
  }, [user, isElevated, tenantRepository, authRepository, uc.getMembers]);

  const selectTenant = useCallback(async (tenantId: string) => {
    const tenant = availableTenants.find((t) => t.id === tenantId) ??
      await tenantRepository.getTenantById(tenantId);
    if (tenant) await applyTenant(tenant);
  }, [availableTenants, tenantRepository, applyTenant]);

  const updateTenant = useCallback(async (data: TenantUpdate) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, data);
    setCurrentTenant((prev) => prev ? { ...prev, ...data } : prev);
    setAvailableTenants((prev) =>
      prev.map((t) => t.id === currentTenant.id ? { ...t, ...data } : t),
    );
  }, [currentTenant, uc.update]);

  const addMember = useCallback(async (member: Omit<TenantMember, 'addedAt' | 'permissions'>) => {
    if (!currentTenant) return;
    await uc.addMember.execute(currentTenant.id, member);
    await loadMembers(currentTenant.id);
  }, [currentTenant, uc.addMember, loadMembers]);

  const updateMemberRoles = useCallback(async (userId: string, roleIds: string[]) => {
    if (!currentTenant || !user) return;
    await uc.updateRoles.execute(currentTenant.id, userId, roleIds, {
      uid: user.id,
      name: effectiveName,
      photoURL: user.photoURL,
    });
    setMembers((prev) => prev.map((m) => m.userId === userId ? { ...m, roleIds } : m));
  }, [currentTenant, user, effectiveName, uc.updateRoles]);

  const removeMember = useCallback(async (userId: string) => {
    if (!currentTenant) return;
    await uc.removeMember.execute(currentTenant.id, userId);
    setMembers((prev) => prev.filter((m) => m.userId !== userId));
  }, [currentTenant, uc.removeMember]);

  const refreshMembers = useCallback(async () => {
    if (currentTenant) await loadMembers(currentTenant.id);
  }, [currentTenant, loadMembers]);

  const completeSecondFactor = useCallback(async (token: string) => {
    await signInWithToken(token);
    const verifiedAt = await authRepository.getSecondFactorVerifiedAt();
    setSecondFactor((prev) => (prev ? { ...prev, verifiedAt } : prev));
    if (currentTenant) await loadMembers(currentTenant.id);
  }, [signInWithToken, authRepository, currentTenant, loadMembers]);

  // A política pode mudar com a tela aberta. Ligada agora para esta pessoa, as regras passam a recusar
  // a sessão que não provou o fator — e a porta tem de aparecer em vez de cada lista falhar sozinha.
  const currentTenantId = currentTenant?.id ?? null;
  useEffect(() => {
    if (!user || !currentTenantId || isElevated) return;
    return tenantRepository.subscribeSecondFactorRequirement(
      currentTenantId,
      user.id,
      (requirement) => setSecondFactor((prev) => {
        if (prev?.tenantId !== currentTenantId) return prev;
        return sameMfaRequirement(prev.requirement, requirement) ? prev : { ...prev, requirement };
      }),
      (error) => console.error('[TenantStore] second factor requirement:', error),
    );
  }, [user, currentTenantId, isElevated, tenantRepository]);

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
      setMembers([]);
      setPortalOnly(false);
      setAwaitingOrganization(false);
      setSecondFactor(null);
      setIsLoading(false);
      return;
    }

    const init = async () => {
      setIsLoading(true);
      setInitError(null);
      setAwaitingOrganization(false);
      try {
        const tenants = isElevated
          ? await uc.getAll.execute()
          : await uc.getForUser.execute(user.id);
        tenants.sort((a, b) => a.name.localeCompare(b.name));

        // O onboarding (users/, userProfiles/ e o tenant próprio) é feito inteiramente
        // pela Cloud Function onUserCreated antes do AuthContext liberar o usuário. Chegar aqui sem
        // nenhum tenant é de quem é só CONVIDADO — o lugar dele é o portal — ou de quem ainda não foi
        // adicionado a escritório nenhum: a instalação que desligou o autocadastro, ou a pessoa que foi
        // removida de todos. Para esse, a tela explica e espera — não é falha a relatar.
        if (tenants.length === 0) {
          const memberships = await uc.portalMemberships.execute(user.id);
          if (memberships.length > 0) {
            setPortalOnly(true);
            return;
          }
          setAwaitingOrganization(true);
          return;
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
          err instanceof Error ? err.message : '@core.workspace/tenant.load-failed',
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
      members,
      isLoading,
      initError,
      portalOnly,
      awaitingOrganization,
      secondFactor,
      completeSecondFactor,
      selectTenant,
      updateTenant,
      addMember,
      updateMemberRoles,
      removeMember,
      refreshMembers,
    }}>
      {children}
    </TenantContext.Provider>
  );
};
