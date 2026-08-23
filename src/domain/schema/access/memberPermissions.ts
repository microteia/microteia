import type { PluginDiagnostic } from '../plugin/diagnostics';
import type { PermissionCatalog } from './resolvePermissions';
import { resolveEffective } from './resolvePermissions';

/**
 * Acesso irrestrito DENTRO de um escritório. Não é um perfil, e ninguém o atribui: o Admin SDK o
 * carimba no documento do DONO do escritório.
 *
 * Ele existe porque um escritório recém-criado não tem perfil nenhum — e sem isto nasceria sem
 * ninguém capaz de criar o primeiro. É a única exceção estrutural do modelo, e é estrutural de
 * propósito: dono é fato do escritório (`Tenant.ownerId`), não papel que alguém concede.
 */
export const UNRESTRICTED_PERMISSION = '*';

/** O mínimo de um perfil para efeito de resolução — o que o front e o backend têm em comum. */
export interface AssignedRole {
  id: string;
  permissions: string[];
}

export const explicitPermissionsOf = (
  roles: readonly AssignedRole[],
  roleIds: readonly string[],
): string[] => {
  const assigned = new Set(roleIds);
  const explicit = new Set<string>();
  for (const role of roles) {
    if (!assigned.has(role.id)) continue;
    for (const permission of role.permissions) explicit.add(permission);
  }
  return [...explicit].sort();
};

export interface MemberPermissions {
  explicit: string[];
  effective: string[];
  diagnostics: PluginDiagnostic[];
}

/**
 * As permissões de um membro a partir dos perfis que ele tem.
 *
 * Um perfil de OUTRO escritório nunca chega aqui: `roles` é a lista do escritório corrente, e um id
 * que não esteja nela simplesmente não contribui nada. O isolamento não depende de uma checagem —
 * depende de a pergunta ser feita dentro de um escritório só.
 */
export const memberPermissions = (
  catalog: PermissionCatalog,
  roles: readonly AssignedRole[],
  roleIds: readonly string[],
): MemberPermissions => {
  const explicit = explicitPermissionsOf(roles, roleIds);
  const { effective, diagnostics } = resolveEffective(catalog, explicit);
  return { explicit, effective, diagnostics };
};

export const isUnrestricted = (granted: readonly string[]): boolean =>
  granted.includes(UNRESTRICTED_PERMISSION);

export const grants = (granted: readonly string[], permission: string): boolean =>
  isUnrestricted(granted) || granted.includes(permission);

export const grantsAny = (granted: readonly string[], permissions: readonly string[]): boolean =>
  isUnrestricted(granted) || permissions.some((permission) => granted.includes(permission));

export const grantsAll = (granted: readonly string[], permissions: readonly string[]): boolean =>
  isUnrestricted(granted) || permissions.every((permission) => granted.includes(permission));
