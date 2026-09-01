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
   * Recompõe as permissões efetivas de todos os membros. Necessária quando o CATÁLOGO muda por
   * código (uma versão nova do kernel altera a dependência de uma permissão) — os gatilhos do
   * Firestore só acordam com escrita no banco. Devolve quantos membros mudaram.
   *
   * Quem decide chamá-la é o app, comparando a digital carimbada no membro com a do código: um botão
   * dependeria de alguém saber que houve upgrade, que ele mexeu numa dependência, e que a
   * consequência era um botão. Ver `KERNEL_CATALOG_FINGERPRINT`.
   */
  syncPermissions(tenantId: string): Promise<number>;
}
