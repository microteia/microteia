import { createContext, useContext } from 'react';
import type { Role } from '../domain/entities/Role';
import type { PermissionCatalog } from '../domain/schema/access';
import type { RoleDraft } from '../domain/usecases/roles/RoleUseCases';

export interface RoleStoreState {
  roles: Role[];
  isLoading: boolean;
  getRole: (roleId: string) => Role | undefined;
  createRole: (catalog: PermissionCatalog, draft: RoleDraft) => Promise<Role>;
  updateRole: (role: Role, catalog: PermissionCatalog, draft: RoleDraft) => Promise<void>;
  deleteRole: (role: Role) => Promise<void>;
  /**
   * Recompõe as permissões efetivas de todos os membros. Devolve quantos mudaram. Quem a chama é o
   * `AuthorizationStore`, quando a digital carimbada no membro diverge da do código — não uma pessoa.
   */
  syncPermissions: () => Promise<number>;
  refresh: () => Promise<void>;
}

export const RoleContext = createContext<RoleStoreState | null>(null);

export const useRoles = (): RoleStoreState => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRoles must be used within RoleStoreProvider');
  return ctx;
};
