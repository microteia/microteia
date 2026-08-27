// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ActionDefinition } from '../../../domain/entities';
import type { WorkflowDefinition } from '../../../domain/entities/Workflow';

/**
 * A tela de Ações mostra rótulos de TRÊS donos diferentes: o título da própria Ação, o nome do fluxo
 * que ela dispara e o rótulo de cada parâmetro daquele fluxo. Nenhum deles é editado aqui a não ser o
 * primeiro — e mesmo esse, o cabeçalho apenas reflete.
 *
 * O teste existe porque dois dos três chegavam crus à tela mesmo com `useLabel` já importado no
 * arquivo. É o sintoma que se repete: rótulo declarativo tratado como caso, não como regra.
 */
const CATALOG: Record<string, string> = {
  '@com.acme.auto/action.review': 'Revisar',
  '@com.acme.auto/workflow.review': 'Revisar uma solicitação',
  '@com.acme.auto/field.title': 'Título',
  '@com.acme.auto/parameter.decision': 'Decisão',
};

vi.mock('../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) => CATALOG[value ?? ''] ?? (value ?? ''),
}));

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
  promptParameters: true,
} as ActionDefinition;

const workflow: WorkflowDefinition = {
  id: 'wf-review',
  tenantId: 't1',
  name: '@com.acme.auto/workflow.review',
  eventName: 'workflow.called',
  version: 1,
  enabled: true,
  steps: [],
  parameters: [
    { key: 'requestId', label: '@com.acme.auto/field.title', type: 'String', required: true },
    { key: 'decision', label: '@com.acme.auto/parameter.decision', type: 'String' },
    // Parâmetro do sistema: nunca chega ao formulário, então também não entra nesta lista.
    { key: 'recordId', label: '@com.acme.auto/field.title', type: 'String' },
  ],
} as unknown as WorkflowDefinition;

vi.mock('../../../stores/useActions', () => ({
  useActions: () => ({
    actions: [action],
    createAction: vi.fn(),
    updateAction: vi.fn(),
    deleteAction: vi.fn(),
  }),
}));
vi.mock('../../../stores/useWorkflowStore', () => ({
  useWorkflowStore: () => ({ workflows: [workflow] }),
}));
vi.mock('../../../stores/useAuthorization', () => ({
  useAuthorization: () => ({ can: () => true, canAny: () => true, canAll: () => true }),
}));
vi.mock('../../../stores/useWorkspace', () => ({
  useWorkspace: () => ({
    closeTab: vi.fn(), openTab: vi.fn(), setTabTitle: vi.fn(), activePanelId: 'p1',
  }),
}));
vi.mock('../../../stores/useNotification', () => ({
  useNotification: () => ({ notify: vi.fn() }),
}));
vi.mock('../../shared/recordActions/useRecordActions', () => ({
  useRecordActions: () => [],
}));

const { useViewActionViewModel } = await import('./ViewAction.viewmodel');

const renderVm = () => renderHook(() => useViewActionViewModel('view-action:act-review'));

describe('ViewAction — os três rótulos de donos diferentes', () => {
  it('o cabeçalho reflete o título traduzido, e o campo guarda a referência', () => {
    const { result } = renderVm();

    expect(result.current.displayTitle).toBe('Revisar');
    expect(result.current.formData.title).toBe('@com.acme.auto/action.review');
  });

  it('o seletor de fluxo mostra o nome do fluxo, não a chave dele', () => {
    const { result } = renderVm();

    expect(result.current.workflowOptions).toEqual([
      { value: 'wf-review', label: 'Revisar uma solicitação' },
    ]);
  });

  it('o rótulo de cada parâmetro do fluxo traduz — é ele que rotula o editor de expressão', () => {
    const { result } = renderVm();

    expect(result.current.promptableParameters).toEqual([
      { key: 'requestId', label: 'Título', required: true },
      { key: 'decision', label: 'Decisão', required: false },
    ]);
  });

  it('nenhum rótulo que a tela entrega chega com a referência crua', () => {
    const { result } = renderVm();
    const shown = [
      result.current.displayTitle,
      ...result.current.workflowOptions.map((option) => option.label),
      ...result.current.promptableParameters.map((parameter) => parameter.label),
    ];

    shown.forEach((text) => expect(text.startsWith('@')).toBe(false));
  });
});
