// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createSchemaContext } from '../../../../../domain/schema/pathResolver';
import type { UpsertStepConfig } from '../../../../../domain/schema/mutationSpec';

vi.mock('../../../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext([]),
}));

const { useUpsertBuilderControlViewModel } = await import('./UpsertBuilderControl.viewmodel');

const render = (value: UpsertStepConfig) => {
  const onChange = vi.fn<(config: UpsertStepConfig) => void>();
  const { result } = renderHook(() => useUpsertBuilderControlViewModel(value, onChange));
  return { vm: result.current, onChange };
};

describe('construtor do passo upsert — endereçamento pela chave primary', () => {
  it('marcar liga a opção sem tocar no resto da configuração', () => {
    const { vm, onChange } = render({ table: 'lotes', source: 'event', property: 'lote' });
    act(() => vm.setMatchPrimaryKey(true));
    expect(onChange).toHaveBeenCalledWith({ table: 'lotes', source: 'event', property: 'lote', matchPrimaryKey: true });
  });

  it('desmarcar tira a opção do config, que volta a ser o de quem nunca a pediu', () => {
    const { vm, onChange } = render({ table: 'lotes', source: 'input', matchPrimaryKey: true });
    act(() => vm.setMatchPrimaryKey(false));
    const [emitted] = onChange.mock.calls[0];
    expect(emitted.matchPrimaryKey).toBeUndefined();
    expect(JSON.parse(JSON.stringify(emitted))).toEqual({ table: 'lotes', source: 'input' });
  });
});
