import React from 'react';
import { S } from './CustomFieldsSection.styles';
import { useCustomFieldsSectionViewModel } from './CustomFieldsSection.viewmodel';
import type { CustomFieldsSectionProps } from './CustomFieldsSection.viewmodel';
import { Input, Label, Textarea } from '../Input';
import { DateInput } from '../DateInput';
import { CurrencyInput } from '../CurrencyInput';
import { MaskedInput } from '../MaskedInput';
import { DynamicSelect } from '../DynamicSelect';
import { SearchSelect } from '../SearchSelect';
import { MultiSearchSelect } from '../MultiSearchSelect';
import { MarkdownEditor } from '../MarkdownEditor';
import type { FieldDefinition } from '../../../../domain/entities';

export const CustomFieldsSection: React.FC<CustomFieldsSectionProps> = (props) => {
  const vm = useCustomFieldsSectionViewModel(props);

  const renderControl = (field: FieldDefinition): React.ReactNode => {
    const isDisabled = vm.isFieldDisabled(field);
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            value={vm.getString(field.key)}
            onChange={(e) => vm.setValue(field.key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            disabled={isDisabled}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={vm.getString(field.key)}
            onChange={(e) => vm.setValue(field.key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            disabled={isDisabled}
          />
        );
      case 'currency':
        return (
          <CurrencyInput
            value={vm.getCurrency(field.key)}
            onChange={(value) => vm.setValue(field.key, value)}
            placeholder={field.placeholder ?? undefined}
            disabled={isDisabled}
          />
        );
      case 'date':
        return (
          <DateInput
            value={vm.getString(field.key)}
            onChange={(value) => vm.setValue(field.key, value)}
            disabled={isDisabled}
          />
        );
      case 'checkbox':
        return (
          <S.CheckboxRow>
            <input
              type="checkbox"
              checked={vm.getBoolean(field.key)}
              onChange={(e) => vm.setValue(field.key, e.target.checked)}
              disabled={isDisabled}
            />
            {field.placeholder ?? 'Sim'}
          </S.CheckboxRow>
        );
      case 'masked':
        return (
          <MaskedInput
            mask={field.mask ?? 'cpf'}
            value={vm.getString(field.key)}
            onChange={(value) => vm.setValue(field.key, value)}
            placeholder={field.placeholder ?? undefined}
            disabled={isDisabled}
          />
        );
      case 'select':
        return (
          <DynamicSelect
            staticOptions={vm.staticSelectOptions(field)}
            dynamicOptions={vm.dynamicSelectOptions(field)}
            multiSelect={field.multi}
            value={field.multi ? undefined : vm.getString(field.key)}
            onChange={field.multi ? undefined : (value) => vm.setValue(field.key, value)}
            values={field.multi ? vm.getStringArray(field.key) : undefined}
            onChangeMulti={field.multi ? (values) => vm.setValue(field.key, values) : undefined}
            placeholder={field.placeholder ?? 'Selecione...'}
            disabled={isDisabled}
            onAdd={field.optionsAllowUserAdd ? (label) => vm.handleAddOption(field, label) : undefined}
            onDelete={field.optionsAllowUserAdd && vm.canDeleteOption
              ? (optionKey) => vm.handleDeleteOption(field, optionKey)
              : undefined}
            deleteConfirmTitle="Excluir opção"
            deleteConfirmMessage="Tem certeza que deseja excluir esta opção? Registros que a utilizam manterão o valor salvo."
          />
        );
      case 'reference':
        return field.multi ? (
          <MultiSearchSelect
            options={vm.referenceOptions(field)}
            values={vm.getStringArray(field.key)}
            onChange={(values) => vm.setValue(field.key, values)}
            placeholder={field.placeholder ?? 'Selecione...'}
            disabled={isDisabled}
          />
        ) : (
          <SearchSelect
            options={vm.referenceOptions(field)}
            value={vm.getString(field.key)}
            onChange={(value) => vm.setValue(field.key, value)}
            placeholder={field.placeholder ?? 'Selecione...'}
            disabled={isDisabled}
          />
        );
      case 'markdown':
        return (
          <MarkdownEditor
            value={vm.getString(field.key)}
            onChange={(value) => vm.setValue(field.key, value)}
            placeholder={field.placeholder ?? undefined}
            readOnly={isDisabled}
          />
        );
      default:
        return (
          <Input
            type="text"
            value={vm.getString(field.key)}
            onChange={(e) => vm.setValue(field.key, e.target.value)}
            placeholder={field.placeholder ?? undefined}
            disabled={isDisabled}
          />
        );
    }
  };

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
                    {renderControl(field)}
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
