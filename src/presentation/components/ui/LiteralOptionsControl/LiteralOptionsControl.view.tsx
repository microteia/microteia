import React from 'react';
import { Input } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { DynamicSelect } from '../DynamicSelect';
import { useLiteralOptionsViewModel } from './LiteralOptionsControl.viewmodel';
import type { LiteralOptionsControlProps } from './LiteralOptionsControl.viewmodel';

import { useT } from '../../../shared/i18n/useT';

export const LiteralOptionsControl: React.FC<LiteralOptionsControlProps> = ({ input, value, onChange }) => {
  const t = useT('core.ui');
  const vm = useLiteralOptionsViewModel(input);

  if (vm.mode === 'static') {
    return <SearchSelect options={vm.options} value={value} onChange={onChange} placeholder={t('select.placeholder')} />;
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
        placeholder={t('select.placeholder')}
      />
    );
  }

  return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.description} />;
};
