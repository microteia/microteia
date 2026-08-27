// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';

/**
 * O cabeçalho e o resumo de um parâmetro são REFLEXO do campo, não o campo. A distinção é o que
 * separa este arquivo do `LabelInput`: ali a referência é o valor que se edita e precisa aparecer ao
 * foco; aqui não há nada a editar, então mostrar a chave é só deixar de traduzir.
 */
vi.mock('../../../../shared/i18n/useT', () => ({
  useT: () => (key: string) => key,
  useLabel: () => (value: string | null | undefined) =>
    (value === '@com.acme.auto/field.title' ? 'Título' : (value ?? '')),
}));

vi.mock('../../../../shared/useFieldRulePresets', () => ({
  useFieldRulePresets: () => [],
  formatPresetOptions: () => [],
  validatePresetOptions: () => [],
}));

const { useWorkflowParametersEditorViewModel } = await import('./WorkflowParametersEditor.viewmodel');

const param = (over: Partial<WorkflowParameter> = {}): WorkflowParameter => ({
  key: 'requestId',
  label: '@com.acme.auto/field.title',
  type: 'String',
  ...over,
});

const renderVm = (parameters: WorkflowParameter[]) =>
  renderHook(() => useWorkflowParametersEditorViewModel({
    parameters,
    errors: [],
    typeOptions: [{ value: 'String', label: 'Texto' }],
    entityOptions: [],
    lookupOptions: [],
    onAdd: vi.fn(),
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
    onClone: vi.fn(),
  }));

describe('WorkflowParametersEditor — o reflexo do parâmetro traduz', () => {
  it('o cabeçalho do parâmetro aberto mostra o texto, não a referência', () => {
    const { result } = renderVm([param()]);

    expect(result.current.headerTitleFor(param())).toBe('Título');
  });

  it('o resumo do parâmetro fechado também', () => {
    const { result } = renderVm([param()]);

    expect(result.current.summaryFor(param()).startsWith('@')).toBe(false);
    expect(result.current.summaryFor(param())).toContain('Título');
  });

  it('sem rótulo, o cabeçalho cai na CHAVE — e não na referência vazia', () => {
    const { result } = renderVm([param({ label: '' })]);

    expect(result.current.headerTitleFor(param({ label: '' }))).toBe('requestId');
  });

  it('o texto que o escritório digitou passa intacto', () => {
    const { result } = renderVm([param({ label: 'Número do processo' })]);

    expect(result.current.headerTitleFor(param({ label: 'Número do processo' }))).toBe('Número do processo');
  });
});
