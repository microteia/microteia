// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScreenDefinition } from '../../../domain/entities';

/**
 * Regressão da ordem das validações em `handleSaveField`.
 *
 * O ramo do campo do sistema já esteve DEPOIS das validações que só valem para campo customizado —
 * e um campo fixo do tipo seleção (que tira as opções de um lookup, sem `staticOptions`) era
 * recusado com "Adicione ao menos uma opção". Os testes de função pura não pegavam isso porque o
 * defeito estava na ordem do fluxo, não no cálculo.
 */

const saveDefinition = vi.fn(async () => ({}) as ScreenDefinition);
const notify = vi.fn();
const storeState = { definition: undefined as ScreenDefinition | undefined };

vi.mock('styled-components', () => ({
  useTheme: () => ({ tagColors: [{ label: 'Azul', value: '#1e88e5' }] }),
}));
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => ({ tenantRole: 'admin' }) }));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ actions: [] }) }));
vi.mock('../../shared/useSchemaContext', () => ({
  useSchemaContext: () => ({ registry: {}, screens: new Map(), version: 1 }),
}));
vi.mock('../../../infrastructure/di/useDI', () => ({
  useDI: () => ({ externalLookupServices: [] }),
}));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: storeState.definition ? [storeState.definition] : [],
    dynamicScreens: [],
    isLoading: false,
    saveDefinition,
    deleteDefinition: vi.fn(),
  }),
  fieldOptionsKey: (screenKey: string, fieldKey: string) => `${screenKey}:${fieldKey}`,
}));

const { useScreenBuilderViewModel } = await import('./ScreenBuilder.viewmodel');

const personsDefinition = (overrides: Partial<ScreenDefinition> = {}): ScreenDefinition =>
  ({
    id: 'persons',
    tenantId: 't1',
    builtin: true,
    titleSingular: 'Pessoa',
    titlePlural: 'Pessoas',
    icon: 'user',
    fields: [],
    titleFieldKey: '',
    hasNotes: false,
    hasDocuments: false,
    hasTags: false,
    listActions: [],
    viewActionIds: [],
    cardActionIds: [],
    sidebarOrder: 0,
    enabled: true,
    createdAt: new Date(),
    createdBy: 'u1',
    updatedAt: new Date(),
    ...overrides,
  }) as ScreenDefinition;

beforeEach(() => {
  saveDefinition.mockClear();
  notify.mockClear();
  storeState.definition = personsDefinition();
});

describe('ScreenBuilder — ajuste de campo do sistema', () => {
  it('campo do sistema salva mesmo quando o estado tripa uma validação de campo customizado', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('persons', 'gender'));
    expect(result.current.fieldModalIsNative).toBe(true);

    // Simula um campo fixo do tipo seleção cujas opções vêm de um lookup — sem `staticOptions` e
    // sem permitir criação pelo usuário. Nenhum campo nativo está nessa combinação HOJE, mas o
    // ramo do campo do sistema precisa correr ANTES das validações de campo customizado para que
    // um campo assim, ao ser declarado no registry, não fique impossível de ajustar.
    act(() => result.current.updateFieldForm({
      label: 'Gênero',
      type: 'select',
      staticOptions: [],
      optionsAllowUserAdd: false,
    }));
    await act(async () => { await result.current.handleSaveField(); });

    expect(notify).not.toHaveBeenCalledWith(
      expect.stringContaining('Adicione ao menos uma opção'),
      'error',
    );
    expect(saveDefinition).toHaveBeenCalledTimes(1);

    const [screenKey, payload] = saveDefinition.mock.calls[0] as unknown as [string, ScreenDefinition];
    expect(screenKey).toBe('persons');
    expect(payload.nativeFieldOverrides?.gender?.label).toBe('Gênero');
  });

  it('grava as expressões front-only do campo do sistema', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    act(() => result.current.openEditField('persons', 'name'));
    act(() => result.current.updateFieldForm({
      logicOnChange: 'object("apelido", name)',
      logicHiddenWhen: "type == 'PJ'",
    }));
    await act(async () => { await result.current.handleSaveField(); });

    const [, payload] = saveDefinition.mock.calls[0] as unknown as [string, ScreenDefinition];
    expect(payload.nativeFieldOverrides?.name?.logic).toEqual({
      hiddenWhen: "type == 'PJ'",
      onChange: 'object("apelido", name)',
    });
  });

  it('preserva os ajustes dos outros campos ao salvar um', async () => {
    storeState.definition = personsDefinition({
      nativeFieldOverrides: { cpf: { label: 'Documento' } },
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    act(() => result.current.openEditField('persons', 'name'));
    act(() => result.current.updateFieldForm({ label: 'Nome completo' }));
    await act(async () => { await result.current.handleSaveField(); });

    const [, payload] = saveDefinition.mock.calls[0] as unknown as [string, ScreenDefinition];
    expect(payload.nativeFieldOverrides?.cpf?.label).toBe('Documento');
    expect(payload.nativeFieldOverrides?.name?.label).toBe('Nome completo');
  });

  it('restaurar padrão remove só o ajuste daquele campo', async () => {
    storeState.definition = personsDefinition({
      nativeFieldOverrides: { name: { label: 'X' }, cpf: { label: 'Documento' } },
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.restoreNativeField('persons', 'name'); });

    const [, payload] = saveDefinition.mock.calls[0] as unknown as [string, ScreenDefinition];
    expect(payload.nativeFieldOverrides).toEqual({ cpf: { label: 'Documento' } });
  });

  it('reordenar grava posições absolutas e marca a ordem como unificada', async () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());
    await act(async () => { await result.current.moveField('persons', 'name', 1); });

    const [, payload] = saveDefinition.mock.calls[0] as unknown as [string, ScreenDefinition];
    expect(payload.fieldOrderUnified).toBe(true);
    expect(typeof payload.nativeFieldOverrides?.name?.order).toBe('number');
  });

  it('distingue campo do sistema de campo adicional', () => {
    storeState.definition = personsDefinition({
      fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0 }],
    });

    const { result } = renderHook(() => useScreenBuilderViewModel());
    expect(result.current.isNativeField('persons', 'name')).toBe(true);
    expect(result.current.isNativeField('persons', 'apelido')).toBe(false);
  });
});
