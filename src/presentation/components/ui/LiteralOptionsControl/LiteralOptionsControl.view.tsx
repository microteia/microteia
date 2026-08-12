import React from 'react';
import { Input } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { DynamicSelect } from '../DynamicSelect';
import { useLiteralOptionsViewModel } from './LiteralOptionsControl.viewmodel';
import type { LiteralOptionsControlProps } from './LiteralOptionsControl.viewmodel';

export const LiteralOptionsControl: React.FC<LiteralOptionsControlProps> = ({ input, value, onChange }) => {
  const vm = useLiteralOptionsViewModel(input);

  if (vm.mode === 'static') {
    return <SearchSelect options={vm.options} value={value} onChange={onChange} placeholder="Selecione..." />;
  }

  if (vm.mode === 'dynamic') {
    return (
      <DynamicSelect
        staticOptions={vm.staticOptions}
        dynamicOptions={vm.dynamicOptions}
        value={value}
        onChange={onChange}
        onAdd={vm.onAdd}
        onDelete={vm.onDelete}
        placeholder="Selecione..."
      />
    );
  }

  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.description} />;
};
