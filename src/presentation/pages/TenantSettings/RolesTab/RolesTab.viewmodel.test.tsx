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

vi.mock('../../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ can: () => true, canAny: () => true, canAll: () => true, catalog }),
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
