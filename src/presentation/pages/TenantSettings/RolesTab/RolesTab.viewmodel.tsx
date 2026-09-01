import { useCallback, useMemo, useState } from 'react';
import { useRoles } from '../../../../stores/useRoles';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useNotification } from '../../../../stores/useNotification';
import type { Role } from '../../../../domain/entities/Role';
import type { CatalogPermission } from '../../../../domain/schema/access';
import { PERMISSION_ROLES_MANAGE, dependenciesOf } from '../../../../domain/schema/access';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { useLabel, useT } from '../../../shared/i18n/useT';

/** O estado de UMA permissão dentro de UM perfil — a caixa que o painel lateral desenha. */
export interface RoleBinding {
  roleId: string;
  roleName: string;
  /** Está no conjunto EFETIVO do perfil (marcada à mão ou arrastada por outra). */
  granted: boolean;
  /**
   * Travada. Ou porque outra permissão do perfil a exige, ou porque o perfil é do sistema. A trava
   * aparece ANTES do clique: uma caixa que parece disponível e não obedece é pior que uma travada.
   */
  locked: boolean;
  /** Quem a arrasta dentro deste perfil, pelo nome. Vazio quando ela foi marcada à mão. */
  impliedBy: string[];
}

export interface PermissionRow {
  id: string;
  name: string;
  description?: string;
  /** O que ela arrasta consigo, pelo nome. */
  includes: string[];
  /** Todos os perfis do escritório, com o estado desta permissão em cada um. */
  roles: RoleBinding[];
  /** Só os nomes dos que a concedem — a coluna da lista. */
  grantedBy: string[];
}

export interface PermissionGroup {
  resource: string;
  name: string;
  permissions: PermissionRow[];
}

export interface RoleDraft {
  name: string;
  description: string;
}

export interface RolesTabViewModel {
  canManage: boolean;
  isLoading: boolean;
  groups: PermissionGroup[];
  query: string;
  setQuery: (value: string) => void;
  noMatches: boolean;

  /** A permissão aberta no painel lateral. */
  selected: PermissionRow | null;
  selectPermission: (permissionId: string) => void;
  closePanel: () => void;
  toggleRole: (permissionId: string, roleId: string) => Promise<void>;
  pendingBinding: string | null;

  roles: Role[];
  isRolesOpen: boolean;
  openRoles: () => void;
  closeRoles: () => void;

  roleModal: { role: Role | null } | null;
  roleDraft: RoleDraft;
  isSavingRole: boolean;
  setRoleDraft: (patch: Partial<RoleDraft>) => void;
  startCreateRole: () => void;
  startEditRole: (role: Role) => void;
  cancelRoleModal: () => void;
  saveRole: () => Promise<void>;

  roleToDelete: Role | null;
  requestDeleteRole: (role: Role) => void;
  confirmDeleteRole: () => Promise<void>;
  cancelDeleteRole: () => void;
}

const EMPTY_DRAFT: RoleDraft = { name: '', description: '' };

export const useRolesTabViewModel = (): RolesTabViewModel => {
  const t = useT('core.access');
  const label = useLabel();
  const { notify } = useNotification();
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();
  const { catalog, can } = useAuthorization();

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingBinding, setPendingBinding] = useState<string | null>(null);
  const [isRolesOpen, setRolesOpen] = useState(false);
  const [roleModal, setRoleModal] = useState<{ role: Role | null } | null>(null);
  const [roleDraft, setRoleDraftState] = useState<RoleDraft>(EMPTY_DRAFT);
  const [isSavingRole, setSavingRole] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const canManage = can(PERMISSION_ROLES_MANAGE);

  /**
   * O rótulo do recurso com os PARÂMETROS dele. Sem eles, um rótulo composto — o de uma lista de
   * opções, o de um conjunto de etiquetas — chegava à tela como o próprio template.
   */
  const resourceLabel = useCallback(
    (resource: string): string => {
      const declared = catalog.resourceLabels.get(resource);
      if (!declared) return resource;
      return label(declared.name, declared.nameParams);
    },
    [catalog, label],
  );

  const nameOf = useCallback(
    (id: string): string => {
      const permission = catalog.byId.get(id);
      if (!permission) return id;
      const name = label(permission.name);
      if (!permission.derived) return name;
      return t('role.qualified-name', { action: name, resource: resourceLabel(permission.resource) });
    },
    [catalog, label, resourceLabel, t],
  );

  /**
   * O que cada perfil ARRASTA, calculado uma vez por perfil. É daqui que sai a trava: dentro de um
   * perfil, uma permissão exigida por outra não pode ser desmarcada isoladamente.
   */
  const impliedByRole = useMemo(() => {
    const map = new Map<string, Map<string, string[]>>();
    for (const role of roles) {
      const implied = new Map<string, string[]>();
      for (const explicit of role.permissions) {
        for (const dependency of dependenciesOf(catalog, explicit)) {
          implied.set(dependency, [...(implied.get(dependency) ?? []), nameOf(explicit)]);
        }
      }
      map.set(role.id, implied);
    }
    return map;
  }, [roles, catalog, nameOf]);

  const rowOf = useCallback(
    (permission: CatalogPermission): PermissionRow => {
      const bindings = roles.map<RoleBinding>((role) => {
        const impliedBy = impliedByRole.get(role.id)?.get(permission.id) ?? [];
        const explicit = role.permissions.includes(permission.id);
        return {
          roleId: role.id,
          roleName: label(role.name),
          granted: explicit || impliedBy.length > 0,
          locked: impliedBy.length > 0 || role.system || !canManage,
          impliedBy,
        };
      });
      return {
        id: permission.id,
        name: label(permission.name),
        ...(permission.description ? { description: label(permission.description) } : {}),
        includes: dependenciesOf(catalog, permission.id).map(nameOf),
        roles: bindings,
        grantedBy: bindings.filter((binding) => binding.granted).map((binding) => binding.roleName),
      };
    },
    [roles, impliedByRole, catalog, label, nameOf, canManage],
  );

  const allGroups = useMemo<PermissionGroup[]>(() => {
    const byResource = new Map<string, PermissionRow[]>();
    for (const permission of catalog.list) {
      byResource.set(permission.resource, [...(byResource.get(permission.resource) ?? []), rowOf(permission)]);
    }
    return [...byResource.entries()]
      .map(([resource, permissions]) => ({
        resource,
        name: resourceLabel(resource),
        permissions,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, rowOf, resourceLabel]);

  /**
   * A busca casa com o RECURSO, com a permissão e com o nome de um PERFIL. O último importa: é o que
   * responde "o que este perfil concede?" sem precisar de uma segunda tela.
   */
  const groups = useMemo<PermissionGroup[]>(() => {
    const term = query.trim().toLowerCase();
    if (!term) return allGroups;
    const matches = (value: string | undefined) => !!value && value.toLowerCase().includes(term);
    const rowMatches = (row: PermissionRow) =>
      matches(row.name) || matches(row.id) || matches(row.description) || row.grantedBy.some(matches);
    return allGroups
      .map((group) => (matches(group.name) || matches(group.resource)
        ? group
        : { ...group, permissions: group.permissions.filter(rowMatches) }))
      .filter((group) => group.permissions.length > 0);
  }, [allGroups, query]);

  const selected = useMemo(
    () => allGroups.flatMap((group) => group.permissions).find((row) => row.id === selectedId) ?? null,
    [allGroups, selectedId],
  );

  const selectPermission = useCallback((permissionId: string) => setSelectedId(permissionId), []);
  const closePanel = useCallback(() => setSelectedId(null), []);

  const report = useCallback(
    (err: unknown, fallback: string) =>
      notify(label(err instanceof Error ? err.message : t(fallback), errorParamsOf(err)), 'error'),
    [notify, label, t],
  );

  const toggleRole = useCallback(async (permissionId: string, roleId: string) => {
    const role = roles.find((candidate) => candidate.id === roleId);
    if (!role) return;
    const next = role.permissions.includes(permissionId)
      ? role.permissions.filter((id) => id !== permissionId)
      : [...role.permissions, permissionId];

    setPendingBinding(`${permissionId}:${roleId}`);
    try {
      await updateRole(role, catalog, {
        name: role.name,
        description: role.description ?? null,
        permissions: next,
      });
    } catch (err) {
      report(err, 'role.save-failed');
    } finally {
      setPendingBinding(null);
    }
  }, [roles, updateRole, catalog, report]);

  const openRoles = useCallback(() => setRolesOpen(true), []);
  const closeRoles = useCallback(() => setRolesOpen(false), []);

  const setRoleDraft = useCallback(
    (patch: Partial<RoleDraft>) => setRoleDraftState((prev) => ({ ...prev, ...patch })),
    [],
  );

  const startCreateRole = useCallback(() => {
    setRoleDraftState(EMPTY_DRAFT);
    setRoleModal({ role: null });
  }, []);

  const startEditRole = useCallback((role: Role) => {
    setRoleDraftState({ name: role.name, description: role.description ?? '' });
    setRoleModal({ role });
  }, []);

  const cancelRoleModal = useCallback(() => setRoleModal(null), []);

  const saveRole = useCallback(async () => {
    if (!roleModal) return;
    setSavingRole(true);
    try {
      const description = roleDraft.description.trim() || null;
      if (roleModal.role) {
        await updateRole(roleModal.role, catalog, {
          name: roleDraft.name,
          description,
          permissions: roleModal.role.permissions,
        });
      } else {
        await createRole(catalog, { name: roleDraft.name, description, permissions: [] });
      }
      notify(t('role.saved'), 'success');
      setRoleModal(null);
    } catch (err) {
      report(err, 'role.save-failed');
    } finally {
      setSavingRole(false);
    }
  }, [roleModal, roleDraft, updateRole, createRole, catalog, notify, t, report]);

  const requestDeleteRole = useCallback((role: Role) => setRoleToDelete(role), []);
  const cancelDeleteRole = useCallback(() => setRoleToDelete(null), []);

  const confirmDeleteRole = useCallback(async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole(roleToDelete);
      notify(t('role.deleted'), 'success');
    } catch (err) {
      report(err, 'role.delete-failed');
    } finally {
      setRoleToDelete(null);
    }
  }, [roleToDelete, deleteRole, notify, t, report]);

  return {
    canManage,
    isLoading,
    groups,
    query,
    setQuery,
    noMatches: groups.length === 0 && query.trim() !== '',
    selected,
    selectPermission,
    closePanel,
    toggleRole,
    pendingBinding,
    roles,
    isRolesOpen,
    openRoles,
    closeRoles,
    roleModal,
    roleDraft,
    isSavingRole,
    setRoleDraft,
    startCreateRole,
    startEditRole,
    cancelRoleModal,
    saveRole,
    roleToDelete,
    requestDeleteRole,
    confirmDeleteRole,
    cancelDeleteRole,
  };
};
