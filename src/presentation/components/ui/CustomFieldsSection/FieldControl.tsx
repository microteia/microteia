import React from 'react';
import { Input, Textarea } from '../Input';
import { DateInput } from '../DateInput';
import { TimeInput } from '../TimeInput';
import { CurrencyInput } from '../CurrencyInput';
import { MaskedInput } from '../MaskedInput';
import { DynamicSelect } from '../DynamicSelect';
import { SearchSelect } from '../SearchSelect';
import { MultiSearchSelect } from '../MultiSearchSelect';
import { MarkdownEditor } from '../MarkdownEditor';
import { Checkbox } from '../Checkbox';
import type { FieldDefinition } from '../../../../domain/entities';
import type { CustomFieldsSectionViewModel } from './CustomFieldsSection.viewmodel';

import { useT } from '../../../shared/i18n/useT';
/**
 * O CONTROLE de um único campo, escolhido pelo `field.type` — a peça atômica que resolve tipo,
 * máscara, opções (estáticas/dinâmicas/lookup/referência) e o estado desabilitado. É partilhada pelo
 * formulário padrão (`CustomFieldsSection`) e pelo átomo público `FieldInput`, para que a app e as
 * extensões rendam o MESMO input a partir do schema — uma única fonte de verdade por tipo de campo.
 */
export const FieldControl: React.FC<{ field: FieldDefinition; vm: CustomFieldsSectionViewModel }> = ({ field, vm }) => {
  const isDisabled = vm.isFieldDisabled(field);
  const t = useT('core.ui');
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
    case 'time':
      return (
        <TimeInput
          value={vm.getString(field.key)}
          onChange={(value) => vm.setValue(field.key, value)}
          disabled={isDisabled}
        />
      );
    case 'checkbox':
      return (
        <Checkbox
          label={field.placeholder ?? 'Sim'}
          checked={vm.getBoolean(field.key)}
          onChange={(next) => vm.setValue(field.key, next)}
          disabled={isDisabled}
        />
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
          deleteConfirmTitle={t('field.option.delete.title')}
          deleteConfirmMessage={t('field.option.delete.message')}
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
