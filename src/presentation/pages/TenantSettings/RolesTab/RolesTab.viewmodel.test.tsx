// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildPermissionCatalog } from '../../../../domain/schema/access';
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
    {
      source: 'com.acme.finance',
      permission: { id: 'finance.delete', name: 'Delete finance', requires: ['finance.write'] },
    },
  ],
  [
    { id: 'finance', name: 'Finance', deriveCrud: true },
    { id: 'person', name: 'People', deriveCrud: true },
  ],
);

const createRole = vi.fn(async () => undefined);
const updateRole = vi.fn(async () => undefined);
const deleteRole = vi.fn(async () => undefined);

vi.mock('../../../../stores/useRoles', () => ({
  useRoles: () => ({
    roles: [],
    isLoading: false,
    getRole: vi.fn(),
    createRole,
    updateRole,
    deleteRole,
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

describe('RolesTabViewModel — as dependências na tela', () => {
  beforeEach(() => {
    createRole.mockClear();
    updateRole.mockClear();
  });

  it('agrupa por recurso, com o rótulo do recurso e não o identificador cru', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    expect(result.current.groups.map((group) => group.name)).toEqual(['Finance', 'People']);
  });

  it('marcar uma permissão traz as dependências dela marcadas e TRAVADAS', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreate());
    act(() => result.current.togglePermission('finance.write'));

    expect(rowOf(result.current, 'finance.write')).toMatchObject({ checked: true, implied: false });
    expect(rowOf(result.current, 'finance.read')).toMatchObject({ checked: true, implied: true });
    expect(rowOf(result.current, 'person.read')).toMatchObject({ checked: true, implied: true });
  });

  it('a dependência diz QUEM a arrastou, e a escolhida diz o que arrasta', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreate());
    act(() => result.current.togglePermission('finance.write'));

    expect(rowOf(result.current, 'person.read').impliedBy).toEqual(['Edit finance']);
    // A derivada é citada COM o recurso: sem isso as duas apareceriam como "Visualizar, Visualizar".
    expect(rowOf(result.current, 'finance.write').includes).toEqual([
      'Visualizar — Finance',
      'Visualizar — People',
    ]);
  });

  it('resolve a dependência TRANSITIVA', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreate());
    act(() => result.current.togglePermission('finance.delete'));

    expect(rowOf(result.current, 'finance.write').implied).toBe(true);
    expect(rowOf(result.current, 'person.read').implied).toBe(true);
    expect(result.current.explicitCount).toBe(1);
    expect(result.current.effectiveCount).toBe(4);
  });

  it('desmarcar a permissão que arrastava libera as dependências', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreate());
    act(() => result.current.togglePermission('finance.write'));
    act(() => result.current.togglePermission('finance.write'));

    expect(rowOf(result.current, 'person.read')).toMatchObject({ checked: false, implied: false });
    expect(result.current.effectiveCount).toBe(0);
  });

  it('a dependência que TAMBÉM foi escolhida à mão continua destravada', () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreate());
    act(() => result.current.togglePermission('finance.read'));
    act(() => result.current.togglePermission('finance.write'));

    expect(rowOf(result.current, 'finance.read')).toMatchObject({ checked: true, implied: false });
  });

  it('grava só as EXPLÍCITAS — as arrastadas nunca entram na Role', async () => {
    const { result } = renderHook(() => useRolesTabViewModel());
    act(() => result.current.startCreate());
    act(() => result.current.setDraftName('Financeiro'));
    act(() => result.current.togglePermission('finance.write'));
    await act(() => result.current.save());

    expect(createRole).toHaveBeenCalledWith(catalog, {
      name: 'Financeiro',
      description: null,
      permissions: ['finance.write'],
    });
  });
});
