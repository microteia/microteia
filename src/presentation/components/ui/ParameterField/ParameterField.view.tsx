import React from 'react';
import { S } from './ParameterField.styles';
import { useParameterFieldViewModel } from './ParameterField.viewmodel';
import type { ParameterFieldProps } from './ParameterField.viewmodel';
import { Input } from '../Input';
import { DateInput } from '../DateInput';
import { SearchSelect } from '../SearchSelect';
import { MultiSearchSelect } from '../MultiSearchSelect';
import { EntityReferenceControl } from '../EntityReferenceControl';
import { LiteralOptionsControl } from '../LiteralOptionsControl';
import { useT, type TranslateFn } from '../../../shared/i18n/useT';

const booleanOptions = (t: TranslateFn) => [
  { value: '', label: t('parameter.unset') },
  { value: 'true', label: t('boolean.yes') },
  { value: 'false', label: t('boolean.no') },
];

/**
 * O campo com que se preenche UM parâmetro declarado — o mesmo em toda tela que pede parâmetros: o
 * "Executar" do fluxo, o do script e a ação que pergunta antes de disparar.
 */
export const ParameterField: React.FC<ParameterFieldProps> = (props) => {
  const vm = useParameterFieldViewModel(props);
  const t = useT('core.ui');

  if (vm.mode === 'entity') {
    return <EntityReferenceControl input={vm.input} value={props.value} onChange={props.onChange} />;
  }

  if (vm.mode === 'options') {
    return <LiteralOptionsControl input={vm.input} value={props.value} onChange={props.onChange} />;
  }

  if (vm.mode === 'multi') {
    return (
      <MultiSearchSelect
        options={vm.multiOptions}
        values={vm.multiValues}
        onChange={vm.setMultiValues}
        placeholder="Selecione..."
      />
    );
  }

  if (vm.mode === 'json') {
    return (
      <S.JsonArea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={vm.jsonPlaceholder}
        spellCheck={false}
      />
    );
  }

  if (vm.mode === 'date') {
    return <DateInput value={props.value} onChange={props.onChange} />;
  }

  if (vm.mode === 'boolean') {
    return <SearchSelect options={booleanOptions(t)} value={props.value} onChange={props.onChange} />;
  }

  return (
    <Input
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={vm.numeric ? '0' : ''}
      inputMode={vm.numeric ? 'decimal' : undefined}
    />
  );
};
