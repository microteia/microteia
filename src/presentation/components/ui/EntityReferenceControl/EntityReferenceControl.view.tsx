import React from 'react';
import { Input } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { MultiSearchSelect } from '../MultiSearchSelect';
import { useEntityReferenceControlViewModel } from './EntityReferenceControl.viewmodel';
import type { EntityReferenceControlProps } from './EntityReferenceControl.viewmodel';

import { useT } from '../../../shared/i18n/useT';

export const EntityReferenceControl: React.FC<EntityReferenceControlProps> = ({ input, value, onChange, values, onChangeMany }) => {
  const t = useT('core.ui');
  const vm = useEntityReferenceControlViewModel(input);

  if (!input.entityType) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={input.description} />;
  }

  if (input.list && onChangeMany) {
    return (
      <MultiSearchSelect
        options={vm.options}
        values={values ?? []}
        onChange={onChangeMany}
        placeholder={t('select.placeholder')}
        onOpenSelected={vm.openSelected ?? undefined}
        onQueryChange={vm.onQuery}
        searchMatches={vm.searchMatches}
      />
    );
  }

  return (
    <SearchSelect
      options={vm.options}
      value={value}
      onChange={onChange}
      placeholder={t('select.placeholder')}
      onOpenSelected={vm.openSelected ?? undefined}
      onQueryChange={vm.onQuery}
      searchMatches={vm.searchMatches}
    />
  );
};
