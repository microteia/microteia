import React from 'react';
import { S } from './CustomFieldsSection.styles';
import { useCustomFieldsSectionViewModel } from './CustomFieldsSection.viewmodel';
import type { CustomFieldsSectionProps } from './CustomFieldsSection.viewmodel';
import { FieldControl } from './FieldControl';
import { Label } from '../Input';

export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = (props) => {
  const vm = useCustomFieldsSectionViewModel(props);

  return (
    <S.Wrapper>
      {vm.groups.map((group, index) => {
        const visibleFields = group.fields.filter((field) => !vm.isFieldHidden(field));
        if (visibleFields.length === 0) return null;
        return (
          <React.Fragment key={group.section ?? `group-${index}`}>
            {group.section && <S.SectionTitle>{group.section}</S.SectionTitle>}
            <S.Grid>
              {visibleFields.map((field) => {
                const error = vm.fieldError(field);
                return (
                  <S.FormGroup key={field.key} $fullWidth={field.type === 'textarea' || field.type === 'markdown'}>
                    <Label>{field.label}{field.required ? ' *' : ''}</Label>
                    <FieldControl field={field} vm={vm} />
                    {error && <S.FieldError>{error}</S.FieldError>}
                  </S.FormGroup>
                );
              })}
            </S.Grid>
          </React.Fragment>
        );
      })}
    </S.Wrapper>
  );
};
