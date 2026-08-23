import type { PluginDiagnostic } from '../../schema/plugin/diagnostics';
import { error, hasErrors } from '../../schema/plugin/diagnostics';
import type { PermissionCatalog } from '../../schema/access';
import { resolveEffective } from '../../schema/access';
import type { Role, RoleInput } from '../../entities/Role';
import type { IRoleRepository, RoleActor } from '../../repositories/IRoleRepository';
import { LocalizedError } from '../../errors/LocalizedError';

export interface RoleDraft {
  name: string;
  description?: string | null;
  permissions: string[];
}

/**
 * O que impede um perfil de ser gravado inconsistente.
 *
 * A tela já trava as dependências, mas travar na tela não é garantir: um perfil chega aqui por
 * importação, por outra aba aberta há uma hora sobre um catálogo antigo, ou por uma extensão
 * desinstalada no meio da edição. A checagem é a mesma que a autorização faz depois — se o conjunto
 * não resolve, ele não é gravado.
 */
export const validateRoleDraft = (catalog: PermissionCatalog, draft: RoleDraft): PluginDiagnostic[] => {
  const diagnostics: PluginDiagnostic[] = [];

  if (!draft.name?.trim()) {
    diagnostics.push(
      error({ code: 'manifest.field.missing', message: '@core.access/role.name.required', path: 'name' }),
    );
  }

  diagnostics.push(...resolveEffective(catalog, draft.permissions ?? []).diagnostics);
  return diagnostics;
};

const assertValid = (catalog: PermissionCatalog, draft: RoleDraft): void => {
  const diagnostics = validateRoleDraft(catalog, draft);
  if (!hasErrors(diagnostics)) return;
  const first = diagnostics[0];
  throw new LocalizedError(first.message, first.messageParams);
};

const assertNotSystem = (role: Role | undefined): void => {
  if (role?.system) throw new LocalizedError('@core.access/role.system.protected');
};

export type CreateRoleUseCase = {
  execute: (tenantId: string, catalog: PermissionCatalog, draft: RoleDraft, actor: RoleActor) => Promise<Role>;
};

export const makeCreateRoleUseCase = (repo: IRoleRepository): CreateRoleUseCase => ({
  // `async` de propósito: a recusa precisa chegar como promessa rejeitada, e não como exceção
  // síncrona — quem chama está num handler `await`, e uma das duas formas passaria batida por ele.
  execute: async (tenantId, catalog, draft, actor) => {
    assertValid(catalog, draft);
    const input: RoleInput = {
      name: draft.name.trim(),
      description: draft.description ?? null,
      permissions: [...new Set(draft.permissions)].sort(),
    };
    return repo.create(tenantId, input, actor);
  },
});

export type UpdateRoleUseCase = {
  execute: (
    tenantId: string,
    role: Role,
    catalog: PermissionCatalog,
    draft: RoleDraft,
    actor: RoleActor,
  ) => Promise<void>;
};

export const makeUpdateRoleUseCase = (repo: IRoleRepository): UpdateRoleUseCase => ({
  execute: async (tenantId, role, catalog, draft, actor) => {
    assertNotSystem(role);
    assertValid(catalog, draft);
    return repo.update(
      tenantId,
      role.id,
      {
        name: draft.name.trim(),
        description: draft.description ?? null,
        permissions: [...new Set(draft.permissions)].sort(),
      },
      actor,
    );
  },
});

export type DeleteRoleUseCase = {
  execute: (tenantId: string, role: Role) => Promise<void>;
};

/**
 * Excluir um perfil é CASCATA: quem o tinha precisa deixar de tê-lo, senão sobra no membro uma
 * referência para um documento que não existe mais — e a materialização de permissões passaria a
 * carregar um id órfão para sempre.
 */
export const makeDeleteRoleUseCase = (repo: IRoleRepository): DeleteRoleUseCase => ({
  execute: async (tenantId, role) => {
    assertNotSystem(role);
    await repo.detachFromMembers(tenantId, role.id);
    await repo.delete(tenantId, role.id);
  },
});

export type SubscribeRolesUseCase = {
  execute: (tenantId: string, onUpdate: (roles: Role[]) => void) => () => void;
};

export const makeSubscribeRolesUseCase = (repo: IRoleRepository): SubscribeRolesUseCase => ({
  execute: (tenantId, onUpdate) => repo.subscribeToRoles(tenantId, onUpdate),
});
