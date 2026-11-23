// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { buildPermissionCatalog } from '../../../../domain/schema/access';
import type { Role } from '../../../../domain/entities/Role';
import { useRolesTabViewModel } from './RolesTab.viewmodel';

const catalog = buildPermissionCatalog(
  [
    {
      source: 'com.acme.finance',
      permission: {
        id: 'finance.write',
        name: 'Edit finance',
        requires: ['finance.read', 'person.read'],
      },
    },
  ],
  [
    { id: 'finance', name: 'Finance', deriveCrud: true },
    { id: 'person', name: 'People', deriveCrud: true },
  ],
);

const role = (over: Partial<Role>): Role => ({
  id: 'r1',
  tenantId: 't1',
  name: 'Financeiro',
  description: null,
  permissions: [],
  system: false,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  updatedBy: 'u1',
  ...over,
});

let roles: Role[] = [];
const updateRole = vi.fn(async () => undefined);
const createRole = vi.fn(async () => undefined);
const deleteRole = vi.fn(async () => undefined);

vi.mock('../../../../stores/useRoles', () => ({
  useRoles: () => ({
    roles,
    isLoading: false,
    getRole: vi.fn(),
    createRole,
    updateRole,
    deleteRole,
    syncPermissions: vi.fn(async () => 0),
    refresh: vi.fn(),
  }),
}));

vi.mock('../../../../stores/useNotification', () => ({
  useNotification: () => ({ notify: vi.fn() }),
}));

let planDeniedPermissions: string[] = [];

vi.mock('../../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ can: () => true, canAny: () => true, canAll: () => true, catalog, planDeniedPermissions }),
}));

vi.mock('../../../shared/i18n/useT', () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    key === 'role.qualified-name' ? `${params?.action} — ${params?.resource}` : key,
  useLabel: () => (value: string | null | undefined) =>
    (value ?? '').replace('@core.access/action.read', 'Visualizar'),
}));

const rowOf = (vm: ReturnType<typeof useRolesTabViewModel>, id: string) =>
  vm.groups.flatMap((group) => group.permissions).find((permission) => permission.id === id)!;

describe('RolesTabViewModel — a tela por PERMISSÃO', () => {
  beforeEach(() => {
    planDeniedPermissions = [];
    updateRole.mockClear();
    createRole.mockClear();
    roles = [
      role({ id: 'r-fin', name: 'Financeiro', permissions: ['finance.write'] }),
      role({ id: 'r-rec', name: 'Recepção', permissions: [] }),
      role({ id: 'r-sys', name: 'Sistema', permissions: [], system: true }),
    ];
  });

  it('agrupa por recurso e mostra o identificador de cada permissão', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    expect(result.current.groups.map((group) => group.name)).toEqual(['Finance', 'People']);
    expect(rowOf(result.current, 'finance.read').id).toBe('finance.read');
  });

  it('a coluna diz em quais perfis a permissão está — inclusive por dependência', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    expect(rowOf(result.current, 'finance.write').grantedBy).toEqual(['Financeiro']);
    // Arrastada por finance.write, então o perfil a concede sem tê-la marcado.
    expect(rowOf(result.current, 'person.read').grantedBy).toEqual(['Financeiro']);
    expect(rowOf(result.current, 'person.delete').grantedBy).toEqual([]);
  });

  it('a permissão exigida por outra fica TRAVADA naquele perfil, dizendo quem a exige', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    const binding = rowOf(result.current, 'person.read').roles.find((r) => r.roleId === 'r-fin')!;
    expect(binding).toMatchObject({ granted: true, locked: true });
    expect(binding.impliedBy).toEqual(['Edit finance']);
  });

  it('a permissão que o plano do escritório nega aparece como fora do plano (#24)', () => {
    planDeniedPermissions = ['person.read'];
    const { result } = renderHook(() => useRolesTabViewModel());
    expect(rowOf(result.current, 'person.read').excludedByPlan).toBe(true);
    expect(rowOf(result.current, 'finance.read').excludedByPlan).toBe(false);
  });

  it('o perfil do SISTEMA fica travado em qualquer permissão', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    const binding = rowOf(result.current, 'finance.read').roles.find((r) => r.roleId === 'r-sys')!;
    expect(binding.locked).toBe(true);
  });

  it('vincular grava a permissão como EXPLÍCITA no perfil escolhido', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    await act(() => result.current.toggleRole('finance.read', 'r-rec'));

    expect(updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r-rec' }),
      catalog,
      expect.objectContaining({ permissions: ['finance.read'] }),
    );
  });

  it('desvincular tira só aquela permissão, preservando as demais do perfil', async () => {
    roles = [role({ id: 'r-fin', name: 'Financeiro', permissions: ['finance.write', 'person.delete'] })];
    const { result } = renderHook(() => useRolesTabViewModel());
    await act(() => result.current.toggleRole('person.delete', 'r-fin'));

    expect(updateRole).toHaveBeenCalledWith(
      expect.anything(),
      catalog,
      expect.objectContaining({ permissions: ['finance.write'] }),
    );
  });

  it('a busca casa com o recurso, com a permissão e com o NOME DE UM PERFIL', () => {
    const { result } = renderHook(() => useRolesTabViewModel());

    act(() => result.current.setQuery('people'));
    expect(result.current.groups.map((g) => g.name)).toEqual(['People']);

    act(() => result.current.setQuery('Financeiro'));
    const ids = result.current.groups.flatMap((g) => g.permissions).map((p) => p.id);
    expect(ids).toContain('finance.write');
    expect(ids).not.toContain('person.delete');

    act(() => result.current.setQuery('coisa que não existe'));
    expect(result.current.noMatches).toBe(true);
  });

  it('o painel lateral abre na permissão escolhida e fecha', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.selectPermission('finance.write'));
    expect(result.current.selected?.id).toBe('finance.write');

    act(() => result.current.closePanel());
    expect(result.current.selected).toBeNull();
  });

  it('criar um perfil nasce sem permissão nenhuma — elas vêm da lista', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreateRole());
    act(() => result.current.setRoleDraft({ name: 'Contador' }));
    await act(() => result.current.saveRole());

    expect(createRole).toHaveBeenCalledWith(catalog, {
      name: 'Contador',
      description: null,
      permissions: [],
    });
  });

  it('editar um perfil não mexe nas permissões dele', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startEditRole(roles[0]));
    act(() => result.current.setRoleDraft({ name: 'Financeiro Sênior' }));
    await act(() => result.current.saveRole());

    expect(updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r-fin' }),
      catalog,
      expect.objectContaining({ name: 'Financeiro Sênior', permissions: ['finance.write'] }),
    );
    await waitFor(() => expect(result.current.roleModal).toBeNull());
  });
});

/**
 * Aplicar a um perfil, de uma vez, o que a lista mostra (#27). O alcance é o filtro; a prévia diz o que
 * vai mudar antes de gravar; e a gravação é UMA, pela mesma validação do vínculo individual.
 */
describe('RolesTabViewModel — aplicar a lista a um perfil', () => {
  beforeEach(() => {
    planDeniedPermissions = [];
    updateRole.mockClear();
    roles = [
      role({ id: 'r-fin', name: 'Financeiro', permissions: ['finance.write'] }),
      role({ id: 'r-rec', name: 'Recepção', permissions: [] }),
      role({ id: 'r-sys', name: 'Sistema', permissions: [], system: true }),
    ];
  });

  const visible = (vm: ReturnType<typeof useRolesTabViewModel>) =>
    vm.groups.flatMap((group) => group.permissions.map((permission) => permission.id));

  it('o perfil do sistema não é oferecido', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    expect(result.current.bulkRoleOptions.map((option) => option.value)).toEqual(['r-fin', 'r-rec']);
  });

  it('sem perfil escolhido não há prévia, e nada é gravado', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.openBulk());
    expect(result.current.bulkPreview).toBeNull();
    await act(() => result.current.applyBulk());
    expect(updateRole).not.toHaveBeenCalled();
  });

  it('sem filtro, conceder alcança todas as permissões, numa gravação só', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    const all = visible(result.current);
    act(() => result.current.openBulk());
    act(() => result.current.setBulkRoleId('r-rec'));

    expect(result.current.bulkScope).toEqual({ count: all.length, query: '' });
    expect(result.current.bulkPreview).toMatchObject({ scope: all.length, affected: all.length, unchanged: 0 });

    await act(() => result.current.applyBulk());
    expect(updateRole).toHaveBeenCalledTimes(1);
    expect(updateRole).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r-rec' }),
      catalog,
      expect.objectContaining({ permissions: expect.arrayContaining(all) }),
    );
  });

  it('com filtro, só o que a lista mostra; o que o perfil já tinha conta como já concedido', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.setQuery('people'));
    const shown = visible(result.current);
    act(() => result.current.openBulk());
    act(() => result.current.setBulkRoleId('r-fin'));

    // person.read já chega ao Financeiro por finance.write.
    expect(result.current.bulkPreview).toMatchObject({ scope: shown.length, unchanged: 1, affected: shown.length - 1 });

    await act(() => result.current.applyBulk());
    const written = (updateRole.mock.calls[0] as unknown[])[2] as { permissions: string[] };
    expect(written.permissions).toEqual(expect.arrayContaining(['finance.write', ...shown]));
    expect(written.permissions).not.toContain('finance.read');
  });

  it('retirar mantém o que outra permissão restante do perfil exige, e diz quantas são', async () => {
    roles = [role({ id: 'r-fin', name: 'Financeiro', permissions: ['finance.write', 'person.read', 'person.delete'] })];
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.setQuery('people'));
    act(() => result.current.openBulk());
    act(() => result.current.setBulkRoleId('r-fin'));
    act(() => result.current.setBulkMode('revoke'));

    // person.read sai do explícito mas continua exigida por finance.write; person.delete sai de fato.
    expect(result.current.bulkPreview).toMatchObject({ affected: 1, kept: 1 });

    await act(() => result.current.applyBulk());
    expect(updateRole).toHaveBeenCalledWith(
      expect.anything(),
      catalog,
      expect.objectContaining({ permissions: ['finance.write'] }),
    );
  });

  it('filtrar pelo nome do perfil e retirar dele esvazia o perfil', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.setQuery('Financeiro'));
    act(() => result.current.openBulk());
    act(() => result.current.setBulkRoleId('r-fin'));
    act(() => result.current.setBulkMode('revoke'));

    expect(result.current.bulkPreview?.kept).toBe(0);
    await act(() => result.current.applyBulk());
    expect(updateRole).toHaveBeenCalledWith(expect.anything(), catalog, expect.objectContaining({ permissions: [] }));
  });

  it('a prévia de conceder conta o que o plano do escritório exclui (#24)', () => {
    planDeniedPermissions = ['person.read', 'person.delete'];
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.openBulk());
    act(() => result.current.setBulkRoleId('r-rec'));
    expect(result.current.bulkPreview?.planExcluded).toBe(2);
  });

  it('nada a mudar não grava', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.setQuery('people'));
    act(() => result.current.openBulk());
    act(() => result.current.setBulkRoleId('r-rec'));
    act(() => result.current.setBulkMode('revoke'));

    expect(result.current.bulkPreview?.affected).toBe(0);
    await act(() => result.current.applyBulk());
    expect(updateRole).not.toHaveBeenCalled();
  });
});
