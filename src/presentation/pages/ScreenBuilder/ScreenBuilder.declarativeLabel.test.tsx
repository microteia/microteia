// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionDefinition, ScreenDefinition } from '../../../domain/entities';
import { createSchemaContext } from '../../../domain/schema/pathResolver';

/**
 * A aba "Ações" do Form Design escolhe QUAIS Ações a tela oferece. O valor gravado é o id da Ação; o
 * rótulo é o título DELA.
 *
 * É essa distinção que decide o caso, e ela é fina: o Form Design mostra rótulo CRU de propósito —
 * mas só o da tela que ele edita, porque ali a referência é o valor e resolver antes de mostrar faria
 * o "Salvar" gravar o texto por cima dela. O título de uma Ação não é valor desta tela: é rótulo de
 * outra coisa, e rótulo de outra coisa se lê traduzido. Enquanto a diferença não estava escrita, o
 * seletor mostrava `@com.acme.auto/action.review`.
 */
const action: ActionDefinition = {
  id: 'act-review',
  tenantId: 't1',
  key: 'review',
  title: '@com.acme.auto/action.review',
  icon: 'checkboxCircle',
  workflowId: 'wf-review',
  order: 0,
  enabled: true,
  danger: false,
} as ActionDefinition;

const disabled: ActionDefinition = { ...action, id: 'act-off', key: 'off', enabled: false };

vi.mock('../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) =>
    (value === '@com.acme.auto/action.review' ? 'Revisar' : (value ?? '')),
}));

vi.mock('styled-components', () => ({
  useTheme: () => ({ tagColors: [{ label: 'Azul', value: '#1e88e5' }] }),
}));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}));
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify: vi.fn() }) }));
vi.mock('../../../stores/useActions', () => ({ useActions: () => ({ actions: [action, disabled] }) }));
vi.mock('../../../stores/useLookups', () => ({
  useLookups: () => ({ availableLookups: [], declareLookup: vi.fn() }),
}));
vi.mock('../../../stores/useTags', () => ({
  useTags: () => ({ availableTagLists: [], declareTagList: vi.fn() }),
}));
vi.mock('../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext([]),
}));
vi.mock('../../../infrastructure/di/useDI', () => ({
  useDI: () => ({ externalLookupServices: [] }),
}));
vi.mock('../../../stores/useKernel', () => ({
  useContributions: () => [],
  useKernel: () => ({ host: { implementations: { resolve: () => undefined } } }),
}));
vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({
    definitions: [] as ScreenDefinition[],
    dynamicScreens: [],
    isLoading: false,
    saveDefinition: vi.fn(),
    deleteDefinition: vi.fn(),
  }),
  fieldOptionsKey: (screenKey: string, fieldKey: string) => `${screenKey}:${fieldKey}`,
}));

const { useScreenBuilderViewModel } = await import('./ScreenBuilder.viewmodel');

describe('ScreenBuilder — o rótulo de OUTRA coisa resolve, mesmo no Form Design', () => {
  it('o seletor de Ações mostra o título da Ação, não a referência', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    expect(result.current.actionOptions).toEqual([{ value: 'act-review', label: 'Revisar' }]);
  });

  it('o valor da opção continua sendo o id — traduzir é só o que se lê', () => {
    const { result } = renderHook(() => useScreenBuilderViewModel());

    expect(result.current.actionOptions.map((option) => option.value)).toEqual(['act-review']);
  });
});
