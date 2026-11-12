import React from 'react';
import { S } from './WidgetFilters.styles';
import { useWidgetFiltersViewModel } from './WidgetFilters.viewmodel';
import { Input } from '../Input';
import { SearchSelect } from '../SearchSelect';
import { WidgetFilterContext } from '../../../shared/widgetFilterContext';
import type { WidgetFilter } from '../../../../domain/schema/ui/widgetSpec';

interface WidgetFiltersProps {
  filters: WidgetFilter[];
  children: React.ReactNode;
}

/** A barra de filtros do painel e, abaixo dela, o que ela filtra. */
export const WidgetFilters: React.FC<WidgetFiltersProps> = ({ filters, children }) => {
  const vm = useWidgetFiltersViewModel(filters);

  return (
    <S.Wrapper>
      {vm.fields.length > 0 && (
        <S.Bar>
          {vm.fields.map((field) => (
            <S.Field key={field.key}>
              {field.label}
              {field.isPeriod ? (
                <SearchSelect
                  options={vm.periodOptions}
                  value={field.value}
                  onChange={(value) => vm.setValue(field.key, value)}
                />
              ) : (
                <Input value={field.value} onChange={(event) => vm.setValue(field.key, event.target.value)} />
              )}
            </S.Field>
          ))}
        </S.Bar>
      )}
      <WidgetFilterContext.Provider value={vm.values}>{children}</WidgetFilterContext.Provider>
    </S.Wrapper>
  );
};
