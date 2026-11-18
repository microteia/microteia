// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePeriodPickerViewModel } from './PeriodPicker.viewmodel';
import type { PeriodPickerProps } from './PeriodPicker.viewmodel';
import { REPORT_PERIOD_MAX_COUNT } from '../../../../domain/schema/report/reportPeriod';

const OPTIONS = [{ value: '', label: 'Any' }, { value: 'this-month', label: 'This month' }];

const setup = (props: Partial<PeriodPickerProps> = {}) => {
  const onChange = vi.fn();
  const hook = renderHook(() => usePeriodPickerViewModel({ options: OPTIONS, value: 'this-month', onChange, ...props }));
  const custom = () => hook.result.current.options[hook.result.current.options.length - 1].value;
  return { onChange, hook, custom };
};

describe('o seletor de período — Personalizado (#4)', () => {
  it('uma opção comum responde o filtro direto', () => {
    const { onChange, hook } = setup();
    act(() => hook.result.current.select(''));
    expect(onChange).toHaveBeenCalledWith('');
    expect(hook.result.current.editing).toBe(false);
  });

  it('Personalizado abre o editor sem responder, e Aplicar vira last-<n>-<unit>', () => {
    const { onChange, hook, custom } = setup();
    act(() => hook.result.current.select(custom()));
    expect(onChange).not.toHaveBeenCalled();
    expect(hook.result.current.editing).toBe(true);
    expect(hook.result.current.selected).toBe(custom());

    act(() => hook.result.current.setCount('15'));
    act(() => hook.result.current.setUnit('days'));
    act(() => hook.result.current.apply());
    expect(onChange).toHaveBeenCalledWith('last-15-days');
    expect(hook.result.current.editing).toBe(false);
  });

  it('sem o período atual, a janela é de períodos FECHADOS — previous-<n>-<unit>', () => {
    const { onChange, hook, custom } = setup();
    act(() => hook.result.current.select(custom()));
    act(() => hook.result.current.setIncludeCurrent(false));
    act(() => hook.result.current.apply());
    expect(onChange).toHaveBeenCalledWith('previous-12-months');
  });

  it('abre com a janela atual quando ela é parametrizada', () => {
    const { hook, custom } = setup({ value: 'previous-6-quarters' });
    act(() => hook.result.current.select(custom()));
    expect(hook.result.current).toMatchObject({ count: '6', unit: 'quarters', includeCurrent: false });
  });

  it('fora de 1..teto não aplica, e diz o limite', () => {
    const { onChange, hook, custom } = setup();
    act(() => hook.result.current.select(custom()));
    for (const count of ['0', '2.5', String(REPORT_PERIOD_MAX_COUNT.months + 1)]) {
      act(() => hook.result.current.setCount(count));
      expect(hook.result.current.error, count).not.toBeNull();
      act(() => hook.result.current.apply());
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('sem allowCustom, só as opções dadas', () => {
    const { hook } = setup({ allowCustom: false });
    expect(hook.result.current.options).toEqual(OPTIONS);
  });

  it('Cancelar fecha o editor e devolve a escolha atual', () => {
    const { onChange, hook, custom } = setup();
    act(() => hook.result.current.select(custom()));
    act(() => hook.result.current.cancel());
    expect(hook.result.current).toMatchObject({ editing: false, selected: 'this-month' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
