import type { Role, RoleInput } from '../entities/Role';

export interface RoleActor {
  uid: string;
}

export interface IRoleRepository {
  getAll(tenantId: string): Promise<Role[]>;
  subscribeToRoles(tenantId: string, onUpdate: (roles: Role[]) => void): () => void;
  create(tenantId: string, data: RoleInput, actor: RoleActor): Promise<Role>;
  update(tenantId: string, roleId: string, data: Partial<RoleInput>, actor: RoleActor): Promise<void>;
  delete(tenantId: string, roleId: string): Promise<void>;
  /** Tira o perfil de todos que o tinham. Ver `DeleteRoleUseCase` — exclusão é cascata. */
  detachFromMembers(tenantId: string, roleId: string): Promise<void>;
  /**
   * Recalcula as permissões efetivas de todos os membros. Necessário quando o CATÁLOGO muda por
   * código (uma versão nova do kernel altera a dependência de uma permissão) — os gatilhos do
   * Firestore só acordam com escrita no banco. Devolve quantos membros mudaram.
   */
  syncPermissions(tenantId: string): Promise<number>;
}
