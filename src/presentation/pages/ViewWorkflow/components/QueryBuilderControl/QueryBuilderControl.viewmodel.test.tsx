// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createSchemaContext } from '../../../../../domain/schema/pathResolver';
import type { QuerySpec } from '../../../../../domain/schema/querySpec';

vi.mock('../../../../shared/useSchemaContext', () => ({
  useSchemaContext: () => createSchemaContext([]),
}));

const { useQueryBuilderControlViewModel } = await import('./QueryBuilderControl.viewmodel');

const render = (value: QuerySpec) => {
  const onChange = vi.fn<(spec: QuerySpec) => void>();
  const { result } = renderHook(() => useQueryBuilderControlViewModel(value, onChange));
  return { vm: result.current, onChange };
};

const base: QuerySpec = { table: 'lotes', where: [], orderBy: [], limit: 50, projections: ['nome'] };

describe('construtor do passo query — leitura em páginas', () => {
  it('ligar a página não toca no resto da consulta', () => {
    const { vm, onChange } = render(base);
    expect(vm.paging).toBe(false);
    act(() => vm.setPaging(true));
    expect(onChange).toHaveBeenCalledWith({ ...base, page: {} });
  });

  it('o cursor é um mapeamento, gravado dentro da página', () => {
    const { vm, onChange } = render({ ...base, page: {} });
    expect(vm.paging).toBe(true);
    act(() => vm.setPageAfter({ kind: 'Expression', expression: 'event.cursor' }));
    expect(onChange).toHaveBeenCalledWith({ ...base, page: { after: { kind: 'Expression', expression: 'event.cursor' } } });
  });

  it('desligar tira a página do spec, que volta a ser o de quem nunca a pediu', () => {
    const { vm, onChange } = render({ ...base, page: { after: { kind: 'Literal', value: 'x' } } });
    act(() => vm.setPaging(false));
    expect(JSON.parse(JSON.stringify(onChange.mock.calls[0][0]))).toEqual(base);
  });

  it('o limit acima do teto vira aviso, não problema', () => {
    const { vm } = render({ ...base, limit: 300 });
    expect(vm.warningsByField.limit).toBeTruthy();
    expect(vm.issuesByField.limit).toBeUndefined();
    expect(render(base).vm.warningsByField).toEqual({});
  });
});
