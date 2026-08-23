import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RoleContext } from './useRoles';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { Role } from '../domain/entities/Role';
import type { PermissionCatalog } from '../domain/schema/access';
import type { RoleDraft } from '../domain/usecases/roles/RoleUseCases';
import {
  makeCreateRoleUseCase,
  makeDeleteRoleUseCase,
  makeSubscribeRolesUseCase,
  makeUpdateRoleUseCase,
} from '../domain/usecases/roles/RoleUseCases';
import { LocalizedError } from '../domain/errors/LocalizedError';

/**
 * Os perfis de acesso do escritório corrente.
 *
 * O store guarda o DADO (o que o administrador marcou); quem responde "pode?" é o
 * `AuthorizationStore`, que resolve as dependências por cima disto. Separar os dois é o que impede
 * a tela de perguntar por perfil.
 */
export const RoleStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { roleRepository } = useDI();

  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeRolesUseCase(roleRepository),
    create: makeCreateRoleUseCase(roleRepository),
    update: makeUpdateRoleUseCase(roleRepository),
    delete: makeDeleteRoleUseCase(roleRepository),
  }), [roleRepository]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setRoles(await roleRepository.getAll(currentTenant.id));
  }, [currentTenant, roleRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa o cache ao sair do escritório
      setRoles([]);
      return;
    }
    setIsLoading(true);
    const unsub = uc.subscribe.execute(currentTenant.id, (list) => {
      setRoles(list);
      setIsLoading(false);
    });
    return () => unsub();
  }, [currentTenant, uc.subscribe]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.ROLES_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const getRole = useCallback((roleId: string) => roles.find((role) => role.id === roleId), [roles]);

  const requireContext = useCallback(() => {
    if (!currentTenant) throw new LocalizedError('@core.ui/tenant.none-selected');
    if (!user) throw new LocalizedError('@core.ui/tenant.none-selected');
    return { tenantId: currentTenant.id, actor: { uid: user.id } };
  }, [currentTenant, user]);

  const createRole = useCallback(async (catalog: PermissionCatalog, draft: RoleDraft) => {
    const { tenantId, actor } = requireContext();
    const created = await uc.create.execute(tenantId, catalog, draft, actor);
    storeEvents.emit(StoreEvents.ROLES_UPDATED);
    return created;
  }, [requireContext, uc.create]);

  const updateRole = useCallback(async (role: Role, catalog: PermissionCatalog, draft: RoleDraft) => {
    const { tenantId, actor } = requireContext();
    await uc.update.execute(tenantId, role, catalog, draft, actor);
    storeEvents.emit(StoreEvents.ROLES_UPDATED);
  }, [requireContext, uc.update]);

  const deleteRole = useCallback(async (role: Role) => {
    const { tenantId } = requireContext();
    await uc.delete.execute(tenantId, role);
    storeEvents.emit(StoreEvents.ROLES_UPDATED);
  }, [requireContext, uc.delete]);

  const value = useMemo(
    () => ({ roles, isLoading, getRole, createRole, updateRole, deleteRole, refresh }),
    [roles, isLoading, getRole, createRole, updateRole, deleteRole, refresh],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};
