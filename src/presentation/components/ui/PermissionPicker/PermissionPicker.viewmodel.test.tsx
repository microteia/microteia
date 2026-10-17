// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildPermissionCatalog } from '../../../../domain/schema/access';
import { usePermissionPickerViewModel } from './PermissionPicker.viewmodel';

const catalog = buildPermissionCatalog(
  [
    {
      source: 'com.acme.finance',
      permission: {
        id: 'financeiro.write',
        name: 'Edit finance',
        requires: ['financeiro.read', 'pessoas.read'],
      },
    },
  ],
  [
    { id: 'financeiro', name: 'Finance', deriveCrud: true },
    { id: 'pessoas', name: 'People', deriveCrud: true },
    { id: 'prazos', name: 'Deadlines', deriveCrud: true },
  ],
);

let held: string[] = [];
let unrestricted = false;

vi.mock('../../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({
    can: () => true,
    canAny: () => true,
    canAll: () => true,
    catalog,
    effectivePermissions: held,
    isUnrestricted: unrestricted,
  }),
}));

vi.mock('../../../shared/i18n/useT', () => ({
  useT: () => (key: string, params?: Record<string, string>) =>
    (key === 'role.qualified-name' ? `${params?.action} — ${params?.resource}` : key),
  useLabel: () => (value: string | null | undefined) => value ?? '',
}));

const picker = (selected: string[] = []) => {
  const onChange = vi.fn();
  const { result, rerender } = renderHook(
    (props: { selected: string[] }) => usePermissionPickerViewModel({ selected: props.selected, onChange }),
    { initialProps: { selected } },
  );
  return { result, rerender, onChange };
};

const groupOf = (vm: ReturnType<typeof usePermissionPickerViewModel>, resource: string) =>
  vm.groups.find((group) => group.resource === resource)!;

const rowOf = (vm: ReturnType<typeof usePermissionPickerViewModel>, id: string) =>
  vm.groups.flatMap((group) => group.rows).find((row) => row.id === id)!;

describe('o seletor de teto de permissões', () => {
  beforeEach(() => {
    unrestricted = true;
    held = [];
  });

  it('agrupa por recurso, em ordem de rótulo', () => {
    const { result } = picker();
    expect(result.current.groups.map((group) => group.name))
      .toEqual(['Deadlines', 'Finance', 'People']);
  });

  // É a conta que `issueAgentGrant` refaz no servidor: a tela não oferece o que seria recusado.
  it('oferece só o que a pessoa tem, quando ela não é irrestrita', () => {
    unrestricted = false;
    held = ['prazos.read', 'prazos.create'];
    const { result } = picker();
    expect(result.current.groups.map((group) => group.resource)).toEqual(['prazos']);
    expect(groupOf(result.current, 'prazos').rows.map((row) => row.id))
      .toEqual(['prazos.read', 'prazos.create']);
  });

  describe('marcar um item', () => {
    it('arrasta o que ele exige', () => {
      const { result, onChange } = picker();
      act(() => result.current.togglePermission('prazos.create', true));
      expect(onChange).toHaveBeenCalledWith(['prazos.create', 'prazos.read']);
    });

    // O fecho não para na borda do grupo: a tela agrupa por recurso, a dependência não.
    it('arrasta a dependência que mora noutro grupo', () => {
      const { result, onChange } = picker();
      act(() => result.current.togglePermission('financeiro.write', true));
      expect(onChange).toHaveBeenCalledWith(['financeiro.read', 'financeiro.write', 'pessoas.read']);
    });
  });

  describe('desmarcar um item', () => {
    // A assimetria é o desenho: completar a escolha é serviço, estreitá-la é decisão de quem escolhe.
    // Num teto de agente, "escreve e nunca lê" é um estreitamento legítimo — ao contrário de um perfil.
    it('leva só ele, mesmo que outro selecionado o exija', () => {
      const { result, onChange } = picker(['prazos.create', 'prazos.read']);
      act(() => result.current.togglePermission('prazos.read', false));
      expect(onChange).toHaveBeenCalledWith(['prazos.create']);
    });

    it('e a linha passa a avisar quem precisava dela', () => {
      const { result } = picker(['prazos.create']);
      const row = rowOf(result.current, 'prazos.read');
      expect(row.checked).toBe(false);
      // Qualificado: a exigida pode morar noutro grupo, e "Criar" sozinho não diz criar o quê.
      expect(row.requiredBy).toEqual(['@core.access/action.create — Deadlines']);
    });
  });

  describe('marcar o grupo', () => {
    it('marca todos os itens dele de uma vez', () => {
      const { result, onChange } = picker();
      act(() => result.current.toggleGroup('prazos', true));
      expect(onChange).toHaveBeenCalledWith([
        'prazos.create', 'prazos.delete', 'prazos.read', 'prazos.update',
      ]);
    });

    it('e traz junto o que os itens dele exigem de fora', () => {
      const { result, onChange } = picker();
      act(() => result.current.toggleGroup('financeiro', true));
      expect(onChange.mock.calls[0]![0]).toContain('pessoas.read');
    });

    it('desmarcar o grupo não leva o que está selecionado noutro grupo', () => {
      const { result, onChange } = picker(['prazos.read', 'prazos.create', 'pessoas.read']);
      act(() => result.current.toggleGroup('prazos', false));
      expect(onChange).toHaveBeenCalledWith(['pessoas.read']);
    });
  });

  describe('o estado do grupo', () => {
    it('nada marcado: nem cheio nem parcial', () => {
      const { result } = picker();
      const group = groupOf(result.current, 'prazos');
      expect(group.allSelected).toBe(false);
      expect(group.someSelected).toBe(false);
    });

    it('parte marcada: parcial, com a contagem', () => {
      const { result } = picker(['prazos.read', 'prazos.create']);
      const group = groupOf(result.current, 'prazos');
      expect(group.allSelected).toBe(false);
      expect(group.someSelected).toBe(true);
      expect(group.selectedCount).toBe(2);
    });

    it('tudo marcado: cheio', () => {
      const todos = ['prazos.read', 'prazos.create', 'prazos.update', 'prazos.delete'];
      const { result } = picker(todos);
      expect(groupOf(result.current, 'prazos').allSelected).toBe(true);
    });
  });

  describe('abrir e fechar', () => {
    // Esconder a escolha de alguém atrás de um clique é pior que a lista longa.
    it('grupo com algo marcado nasce aberto; os outros, fechados', () => {
      const { result } = picker(['prazos.read']);
      expect(groupOf(result.current, 'prazos').expanded).toBe(true);
      expect(groupOf(result.current, 'financeiro').expanded).toBe(false);
    });

    it('o clique inverte o estado visível, não um padrão fixo', () => {
      const { result } = picker(['prazos.read']);
      act(() => result.current.toggleExpanded('prazos'));
      expect(groupOf(result.current, 'prazos').expanded).toBe(false);

      act(() => result.current.toggleExpanded('financeiro'));
      expect(groupOf(result.current, 'financeiro').expanded).toBe(true);
    });
  });

  describe('a busca', () => {
    it('casa com o nome do grupo e abre o que achou', () => {
      const { result } = picker();
      act(() => result.current.setQuery('Deadlines'));
      expect(result.current.groups.map((group) => group.resource)).toEqual(['prazos']);
      expect(groupOf(result.current, 'prazos').expanded).toBe(true);
    });

    it('casa com o identificador da permissão e filtra as linhas', () => {
      const { result } = picker();
      act(() => result.current.setQuery('prazos.delete'));
      expect(result.current.groups).toHaveLength(1);
      expect(groupOf(result.current, 'prazos').rows.map((row) => row.id)).toEqual(['prazos.delete']);
    });

    it('sem resultado, diz que não há', () => {
      const { result } = picker();
      act(() => result.current.setQuery('nada-disso'));
      expect(result.current.noMatches).toBe(true);
    });
  });

  describe('selecionar tudo', () => {
    it('marca tudo o que é oferecido', () => {
      const { result, onChange } = picker();
      act(() => result.current.selectAll());
      expect(onChange.mock.calls[0]![0]).toHaveLength(result.current.totalOfferable);
    });

    // Marcar o catálogo inteiro com três linhas na tela seria marcar o que ninguém viu.
    it('com busca, marca só o que ela achou — e o que isso exige', () => {
      const { result, onChange } = picker();
      act(() => result.current.setQuery('prazos.create'));
      expect(result.current.selectsMatchesOnly).toBe(true);
      act(() => result.current.selectAll());
      expect(onChange).toHaveBeenCalledWith(['prazos.create', 'prazos.read']);
    });

    it('some quando tudo o que está visível já foi marcado', () => {
      unrestricted = false;
      held = ['prazos.read', 'prazos.create'];
      const { result } = picker(['prazos.read', 'prazos.create']);
      expect(result.current.canSelectAll).toBe(false);
    });
  });

  it('limpar devolve seleção vazia', () => {
    const { result, onChange } = picker(['prazos.read']);
    act(() => result.current.clearAll());
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('sem nada a oferecer, a tela sabe disso', () => {
    unrestricted = false;
    held = [];
    const { result } = picker();
    expect(result.current.hasOfferable).toBe(false);
  });
});
