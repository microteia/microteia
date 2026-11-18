import { SearchSelect } from '../SearchSelect';
import { Input } from '../Input';
import { Checkbox } from '../Checkbox';
import { Button } from '../Button';
import { S } from './PeriodPicker.styles';
import { usePeriodPickerViewModel } from './PeriodPicker.viewmodel';
import type { PeriodPickerProps } from './PeriodPicker.viewmodel';

/**
 * O seletor de PERÍODO de um filtro: os períodos oferecidos e, ao fim, "Personalizado" — um número e uma
 * unidade, com ou sem o período corrente. O mesmo controle no relatório, na barra do painel e no editor.
 */
export const PeriodPicker = (props: PeriodPickerProps) => {
  const vm = usePeriodPickerViewModel(props);
  return (
    <S.Wrapper>
      <SearchSelect label={vm.label} options={vm.options} value={vm.selected} onChange={vm.select} />
      {vm.editing && (
        <S.Custom>
          <S.Count>
            <S.Caption>{vm.labels.count}</S.Caption>
            <Input
              type="number"
              min={1}
              max={vm.max}
              step={1}
              value={vm.count}
              $hasError={vm.error !== null}
              onChange={(event) => vm.setCount(event.target.value)}
            />
          </S.Count>
          <S.Unit>
            <SearchSelect label={vm.labels.unit} options={vm.unitOptions} value={vm.unit} onChange={vm.setUnit} />
          </S.Unit>
          <Checkbox checked={vm.includeCurrent} onChange={vm.setIncludeCurrent} label={vm.labels.includeCurrent} />
          <Button type="button" size="sm" onClick={vm.apply} disabled={vm.error !== null}>{vm.labels.apply}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={vm.cancel}>{vm.labels.cancel}</Button>
        </S.Custom>
      )}
      {vm.error && <S.Error>{vm.error}</S.Error>}
    </S.Wrapper>
  );
};
