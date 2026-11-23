import { useCallback, useMemo, useState } from 'react';
import { useRoles } from '../../../../stores/useRoles';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useNotification } from '../../../../stores/useNotification';
import type { Role } from '../../../../domain/entities/Role';
import type { CatalogPermission, PermissionCatalog } from '../../../../domain/schema/access';
import { PERMISSION_ROLES_MANAGE, dependenciesOf } from '../../../../domain/schema/access';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { useLabel, useT } from '../../../shared/i18n/useT';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';

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
  /**
   * O plano do escritório não inclui esta permissão (#24). Os perfis continuam podendo marcá-la — não
   * faz mal, e volta a valer se o plano mudar —, mas a tela diz que ela não concede nada hoje. Sem o
   * aviso, o administrador vincula, nada acontece, e não há como descobrir por quê.
   */
  excludedByPlan: boolean;
}

export interface PermissionGroup {
  resource: string;
  name: string;
  permissions: PermissionRow[];
}

export type BulkMode = 'grant' | 'revoke';

/**
 * O que a ação em lote faria, antes de fazer (#27). Os números vêm daqui, e não de uma contagem na
 * tela, porque são eles que decidem se o botão de aplicar faz sentido.
 */
export interface BulkPreview {
  profile: string;
  /** Quantas permissões a lista mostra — o alcance da ação. */
  scope: number;
  /** Concedidas (grant) ou retiradas (revoke) de fato. */
  affected: number;
  /** Grant: já concedidas. Revoke: nem estavam concedidas. */
  unchanged: number;
  /** Revoke: continuam concedidas porque outra permissão que fica no perfil as exige. */
  kept: number;
  /** Grant: fora do plano do escritório — o perfil as guarda, mas elas não concedem nada hoje. */
  planExcluded: number;
}

interface BulkPlan {
  preview: BulkPreview;
  permissions: string[];
}

const effectiveOf = (catalog: PermissionCatalog, explicit: Iterable<string>): Set<string> => {
  const effective = new Set<string>();
  for (const id of explicit) {
    effective.add(id);
    for (const dependency of dependenciesOf(catalog, id)) effective.add(dependency);
  }
  return effective;
};

/**
 * Conceder torna EXPLÍCITA cada permissão da lista — mesmo a que hoje chega por dependência: quem
 * vincula "todas estas" espera que elas fiquem se a que as arrastava sair depois. Retirar tira as da
 * lista do conjunto explícito; a que outra permissão restante exige continua valendo, pela mesma regra
 * que trava a caixa no painel, e a prévia diz quantas são.
 */
const bulkPlanOf = (
  catalog: PermissionCatalog,
  role: Role,
  profile: string,
  visible: string[],
  mode: BulkMode,
  planDenied: ReadonlySet<string>,
): BulkPlan => {
  const before = effectiveOf(catalog, role.permissions);
  if (mode === 'grant') {
    const affected = visible.filter((id) => !before.has(id)).length;
    return {
      preview: {
        profile,
        scope: visible.length,
        affected,
        unchanged: visible.length - affected,
        kept: 0,
        planExcluded: visible.filter((id) => planDenied.has(id)).length,
      },
      permissions: [...new Set([...role.permissions, ...visible])],
    };
  }
  const removing = new Set(visible);
  const permissions = role.permissions.filter((id) => !removing.has(id));
  const after = effectiveOf(catalog, permissions);
  const wasGranted = visible.filter((id) => before.has(id));
  const kept = wasGranted.filter((id) => after.has(id)).length;
  return {
    preview: {
      profile,
      scope: visible.length,
      affected: wasGranted.length - kept,
      unchanged: visible.length - wasGranted.length,
      kept,
      planExcluded: 0,
    },
    permissions,
  };
};

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

  /** Há o que aplicar: perfis editáveis e ao menos uma permissão na lista. */
  canBulk: boolean;
  isBulkOpen: boolean;
  openBulk: () => void;
  closeBulk: () => void;
  /** Quantas permissões a lista mostra e se ela está filtrada — o texto do alcance. */
  bulkScope: { count: number; query: string };
  /** Os perfis que a ação pode alterar: os de sistema ficam de fora, como já ficam no painel. */
  bulkRoleOptions: SearchSelectOption[];
  bulkRoleId: string;
  setBulkRoleId: (roleId: string) => void;
  bulkMode: BulkMode;
  /** Recebe o valor cru do grupo de opções; qualquer coisa que não seja `revoke` é conceder. */
  setBulkMode: (value: string) => void;
  /** `null` até um perfil ser escolhido. */
  bulkPreview: BulkPreview | null;
  isApplyingBulk: boolean;
  applyBulk: () => Promise<void>;
}

const EMPTY_DRAFT: RoleDraft = { name: '', description: '' };

export const useRolesTabViewModel = (): RolesTabViewModel => {
  const t = useT('core.access');
  const label = useLabel();
  const { notify } = useNotification();
  const { roles, isLoading, createRole, updateRole, deleteRole } = useRoles();
  const { catalog, can, planDeniedPermissions } = useAuthorization();
  const planDenied = useMemo(() => new Set(planDeniedPermissions), [planDeniedPermissions]);

  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingBinding, setPendingBinding] = useState<string | null>(null);
  const [isRolesOpen, setRolesOpen] = useState(false);
  const [roleModal, setRoleModal] = useState<{ role: Role | null } | null>(null);
  const [roleDraft, setRoleDraftState] = useState<RoleDraft>(EMPTY_DRAFT);
  const [isSavingRole, setSavingRole] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isBulkOpen, setBulkOpen] = useState(false);
  const [bulkRoleId, setBulkRoleId] = useState('');
  const [bulkMode, setBulkMode] = useState<BulkMode>('grant');
  const [isApplyingBulk, setApplyingBulk] = useState(false);

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
        excludedByPlan: planDenied.has(permission.id),
      };
    },
    [roles, impliedByRole, catalog, label, nameOf, canManage, planDenied],
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

  /** O alcance da ação em lote é exatamente o que a lista mostra — sem filtro, todas. */
  const visibleIds = useMemo(
    () => groups.flatMap((group) => group.permissions.map((permission) => permission.id)),
    [groups],
  );

  const editableRoles = useMemo(() => roles.filter((role) => !role.system), [roles]);

  const bulkRoleOptions = useMemo<SearchSelectOption[]>(
    () => editableRoles.map((role) => ({ value: role.id, label: label(role.name) })),
    [editableRoles, label],
  );

  const bulkPlan = useMemo<BulkPlan | null>(() => {
    const role = editableRoles.find((candidate) => candidate.id === bulkRoleId);
    if (!role) return null;
    return bulkPlanOf(catalog, role, label(role.name), visibleIds, bulkMode, planDenied);
  }, [editableRoles, bulkRoleId, catalog, label, visibleIds, bulkMode, planDenied]);

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

  const openBulk = useCallback(() => {
    setBulkRoleId('');
    setBulkMode('grant');
    setBulkOpen(true);
  }, []);
  const closeBulk = useCallback(() => setBulkOpen(false), []);
  const chooseBulkMode = useCallback(
    (value: string) => setBulkMode(value === 'revoke' ? 'revoke' : 'grant'),
    [],
  );

  const applyBulk = useCallback(async () => {
    const role = editableRoles.find((candidate) => candidate.id === bulkRoleId);
    if (!role || !bulkPlan || bulkPlan.preview.affected === 0) return;
    setApplyingBulk(true);
    try {
      await updateRole(role, catalog, {
        name: role.name,
        description: role.description ?? null,
        permissions: bulkPlan.permissions,
      });
      notify(
        t(bulkMode === 'grant' ? 'role.bulk.applied.grant' : 'role.bulk.applied.revoke', {
          count: String(bulkPlan.preview.affected),
          profile: bulkPlan.preview.profile,
        }),
        'success',
      );
      setBulkOpen(false);
    } catch (err) {
      report(err, 'role.save-failed');
    } finally {
      setApplyingBulk(false);
    }
  }, [editableRoles, bulkRoleId, bulkPlan, updateRole, catalog, notify, t, bulkMode, report]);

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
    canBulk: canManage && !isLoading && editableRoles.length > 0 && visibleIds.length > 0,
    isBulkOpen,
    openBulk,
    closeBulk,
    bulkScope: { count: visibleIds.length, query: query.trim() },
    bulkRoleOptions,
    bulkRoleId,
    setBulkRoleId,
    bulkMode,
    setBulkMode: chooseBulkMode,
    bulkPreview: bulkPlan?.preview ?? null,
    isApplyingBulk,
    applyBulk,
  };
};
