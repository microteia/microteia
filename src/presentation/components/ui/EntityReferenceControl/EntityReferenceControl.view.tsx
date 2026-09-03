import React from 'react';
import { Input } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { useEntityReferenceControlViewModel } from './EntityReferenceControl.viewmodel';
import type { EntityReferenceControlProps } from './EntityReferenceControl.viewmodel';

import { useT } from '../../../shared/i18n/useT';

export const EntityReferenceControl: React.FC<EntityReferenceControlProps> = ({ input, value, onChange }) => {
  const t = useT('core.ui');
  const vm = useEntityReferenceControlViewModel(input);

  if (!input.entityType) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.description} />;
  }

  return (
    <SearchSelect
      options={vm.options}
      value={value}
      onChange={onChange}
      placeholder={t('select.placeholder')}
      onOpenSelected={vm.openSelected ?? undefined}
    />
  );
};
