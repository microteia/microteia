import { useCallback, useMemo, useState } from 'react';
import { useRoles } from '../../../../stores/useRoles';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useNotification } from '../../../../stores/useNotification';
import type { Role } from '../../../../domain/entities/Role';
import type { CatalogPermission } from '../../../../domain/schema/access';
import { PERMISSION_ROLES_MANAGE, dependenciesOf } from '../../../../domain/schema/access';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { useLabel, useT } from '../../../shared/i18n/useT';

/** Uma permissão como a tela a desenha: marcada, arrastada por outra, ou disponível. */
export interface PermissionRow {
  id: string;
  name: string;
  description?: string;
  /** Está no conjunto EFETIVO do rascunho. */
  checked: boolean;
  /**
   * Está lá porque OUTRA permissão marcada a exige. A caixa fica travada: desmarcá-la deixaria o
   * perfil num estado que o resolver recusaria — e o administrador nunca pediu para conhecer a
   * dependência, só para escolher a capacidade.
   */
  implied: boolean;
  /** Quem a arrasta, pelo nome — o "incluída por" da tela. */
  impliedBy: string[];
  /** O que ELA arrasta consigo, pelo nome — o "inclui automaticamente" da tela. */
  includes: string[];
}

export interface PermissionGroup {
  resource: string;
  name: string;
  permissions: PermissionRow[];
}

export interface RolesTabViewModel {
  roles: Role[];
  isLoading: boolean;
  canManage: boolean;
  selectedRole: Role | null;
  isCreating: boolean;
  isSaving: boolean;
  draftName: string;
  draftDescription: string;
  groups: PermissionGroup[];
  explicitCount: number;
  effectiveCount: number;
  roleToDelete: Role | null;
  setDraftName: (value: string) => void;
  setDraftDescription: (value: string) => void;
  togglePermission: (permissionId: string) => void;
  startCreate: () => void;
  selectRole: (role: Role) => void;
  cancelEdit: () => void;
  save: () => Promise<void>;
  requestDelete: (role: Role) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

const NEW_ROLE = Symbol('new-role');

export const useRolesTabViewModel = (): RolesTabViewModel => {
  const t = useT('core.access');
  const label = useLabel();
  const { notify } = useNotification();
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();
  const { catalog, can } = useAuthorization();

  const [editing, setEditing] = useState<Role | typeof NEW_ROLE | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [explicit, setExplicit] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);

  const canManage = can(PERMISSION_ROLES_MANAGE);
  const selectedRole = editing && editing !== NEW_ROLE ? editing : null;

  /**
   * O que cada permissão marcada arrasta, calculado UMA vez por rascunho. É daqui que saem as duas
   * afirmações da tela — "inclui automaticamente" e "incluída por" — e a trava da caixa.
   */
  const impliedBy = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const id of explicit) {
      for (const dependency of dependenciesOf(catalog, id)) {
        map.set(dependency, [...(map.get(dependency) ?? []), id]);
      }
    }
    return map;
  }, [catalog, explicit]);

  /**
   * O nome de uma permissão como ela é CITADA fora do grupo dela — no "inclui automaticamente" e no
   * "incluída por".
   *
   * A DERIVADA precisa do recurso junto: dentro do grupo "Financeiro" a linha "Visualizar" basta,
   * mas numa lista solta duas derivadas de recursos diferentes viram "Visualizar, Visualizar" e não
   * dizem nada. A declarada já traz um nome que se sustenta sozinho ("Editar financeiro") e passa
   * intacta.
   */
  const nameOf = useCallback(
    (id: string): string => {
      const permission = catalog.byId.get(id);
      if (!permission) return id;
      const name = label(permission.name);
      if (!permission.derived) return name;
      const resource = label(catalog.resourceNames.get(permission.resource) ?? permission.resource);
      return t('role.qualified-name', { action: name, resource });
    },
    [catalog, label, t],
  );

  const rowOf = useCallback(
    (permission: CatalogPermission): PermissionRow => {
      const implied = impliedBy.has(permission.id);
      return {
        id: permission.id,
        name: label(permission.name),
        ...(permission.description ? { description: label(permission.description) } : {}),
        checked: explicit.includes(permission.id) || implied,
        implied: implied && !explicit.includes(permission.id),
        impliedBy: (impliedBy.get(permission.id) ?? []).map(nameOf),
        includes: dependenciesOf(catalog, permission.id).map(nameOf),
      };
    },
    [catalog, explicit, impliedBy, label, nameOf],
  );

  const groups = useMemo<PermissionGroup[]>(() => {
    const byResource = new Map<string, PermissionRow[]>();
    for (const permission of catalog.list) {
      byResource.set(permission.resource, [...(byResource.get(permission.resource) ?? []), rowOf(permission)]);
    }
    return [...byResource.entries()]
      .map(([resource, permissions]) => ({
        resource,
        name: label(catalog.resourceNames.get(resource) ?? resource),
        permissions,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog, rowOf, label]);

  const effectiveCount = useMemo(
    () => new Set([...explicit, ...impliedBy.keys()]).size,
    [explicit, impliedBy],
  );

  const togglePermission = useCallback((permissionId: string) => {
    setExplicit((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  }, []);

  const startCreate = useCallback(() => {
    setEditing(NEW_ROLE);
    setDraftName('');
    setDraftDescription('');
    setExplicit([]);
  }, []);

  const selectRole = useCallback((role: Role) => {
    setEditing(role);
    setDraftName(role.name);
    setDraftDescription(role.description ?? '');
    setExplicit(role.permissions);
  }, []);

  const cancelEdit = useCallback(() => setEditing(null), []);

  const save = useCallback(async () => {
    if (!editing) return;
    setIsSaving(true);
    try {
      const draft = { name: draftName, description: draftDescription || null, permissions: explicit };
      if (editing === NEW_ROLE) await createRole(catalog, draft);
      else await updateRole(editing, catalog, draft);
      notify(t('role.saved'), 'success');
      setEditing(null);
    } catch (err) {
      notify(label(err instanceof Error ? err.message : t('role.save-failed'), errorParamsOf(err)), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [editing, draftName, draftDescription, explicit, catalog, createRole, updateRole, notify, t, label]);

  const requestDelete = useCallback((role: Role) => setRoleToDelete(role), []);

  const confirmDelete = useCallback(async () => {
    if (!roleToDelete) return;
    try {
      await deleteRole(roleToDelete);
      notify(t('role.deleted'), 'success');
      setEditing((prev) => (prev !== NEW_ROLE && prev?.id === roleToDelete.id ? null : prev));
    } catch (err) {
      notify(label(err instanceof Error ? err.message : t('role.delete-failed'), errorParamsOf(err)), 'error');
    } finally {
      setRoleToDelete(null);
    }
  }, [roleToDelete, deleteRole, notify, t, label]);

  const cancelDelete = useCallback(() => setRoleToDelete(null), []);

  return {
    roles,
    isLoading,
    canManage,
    selectedRole,
    isCreating: editing === NEW_ROLE,
    isSaving,
    draftName,
    draftDescription,
    groups,
    explicitCount: explicit.length,
    effectiveCount,
    roleToDelete,
    setDraftName,
    setDraftDescription,
    togglePermission,
    startCreate,
    selectRole,
    cancelEdit,
    save,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
};
