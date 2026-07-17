import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useScreenDefinitions, fieldOptionsKey } from '../../../../stores/useScreenDefinitions';
import { useTenant } from '../../../../stores/useTenant';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import { sortFieldsByOrder } from '../../../../domain/services/customFieldValues';
import { evaluateFieldBoolean, evaluateFieldValidation } from '../../../../domain/schema/fieldExpression';
import { resolveFieldOptionColor } from '../../../../shared/styles/colorUtils';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';
import type { DynamicSelectOption } from '../DynamicSelect';
import type { ReferenceOption } from '../../../hooks/useReferenceOptions';

export interface CustomFieldsSectionProps {
  screenKey: string;
  fields: FieldDefinition[];
  values: Record<string, CustomFieldValue>;
  onChange: (fieldKey: string, value: CustomFieldValue) => void;
  disabled?: boolean;
}

export interface FieldGroup {
  section: string | null;
  fields: FieldDefinition[];
}

export interface CustomFieldsSectionViewModel {
  groups: FieldGroup[];
  disabled: boolean;
  canDeleteOption: boolean;
  getString: (fieldKey: string) => string;
  getStringArray: (fieldKey: string) => string[];
  getBoolean: (fieldKey: string) => boolean;
  getCurrency: (fieldKey: string) => number | null;
  setValue: (fieldKey: string, value: CustomFieldValue) => void;
  staticSelectOptions: (field: FieldDefinition) => DynamicSelectOption[];
  dynamicSelectOptions: (field: FieldDefinition) => DynamicSelectOption[];
  handleAddOption: (field: FieldDefinition, label: string) => Promise<void>;
  handleDeleteOption: (field: FieldDefinition, optionKey: string) => Promise<void>;
  referenceOptions: (field: FieldDefinition) => ReferenceOption[];
  isFieldHidden: (field: FieldDefinition) => boolean;
  isFieldDisabled: (field: FieldDefinition) => boolean;
  fieldError: (field: FieldDefinition) => string | null;
}

export const useCustomFieldsSectionViewModel = (props: CustomFieldsSectionProps): CustomFieldsSectionViewModel => {
  const { screenKey, fields, values, onChange, disabled = false } = props;
  const { fieldOptionsByField, addFieldOption, removeFieldOption } = useScreenDefinitions();
  const { tenantRole } = useTenant();
  const referenceOptionsByEntity = useReferenceOptions();
  const theme = useTheme();

  const canDeleteOption = tenantRole === 'admin';

  const groups = useMemo<FieldGroup[]>(() => {
    const ordered = sortFieldsByOrder(fields);
    const result: FieldGroup[] = [];
    ordered.forEach((field) => {
      const section = field.section ?? null;
      const last = result[result.length - 1];
      if (last && last.section === section) {
        last.fields.push(field);
      } else {
        result.push({ section, fields: [field] });
      }
    });
    return result;
  }, [fields]);

  const getString = useCallback((fieldKey: string) => {
    const value = values[fieldKey];
    return typeof value === 'string' ? value : '';
  }, [values]);

  const getStringArray = useCallback((fieldKey: string) => {
    const value = values[fieldKey];
    return Array.isArray(value) ? value : [];
  }, [values]);

  const getBoolean = useCallback((fieldKey: string) => values[fieldKey] === true, [values]);

  const getCurrency = useCallback((fieldKey: string) => {
    const value = values[fieldKey];
    return typeof value === 'number' ? value : null;
  }, [values]);

  const setValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    onChange(fieldKey, value);
  }, [onChange]);

  const staticSelectOptions = useCallback(
    (field: FieldDefinition): DynamicSelectOption[] =>
      (field.options ?? []).map((o) => ({
        value: o.key,
        label: o.label,
        color: resolveFieldOptionColor(o.color, field.optionsColored, theme),
      })),
    [theme],
  );

  const dynamicSelectOptions = useCallback(
    (field: FieldDefinition): DynamicSelectOption[] =>
      (fieldOptionsByField[fieldOptionsKey(screenKey, field.key)] ?? []).map((o) => ({
        value: o.key,
        label: o.label,
        color: resolveFieldOptionColor(undefined, field.optionsColored, theme),
      })),
    [fieldOptionsByField, screenKey, theme],
  );

  const handleAddOption = useCallback(
    (field: FieldDefinition, label: string) => addFieldOption(screenKey, field.key, label),
    [addFieldOption, screenKey],
  );

  const handleDeleteOption = useCallback(
    (field: FieldDefinition, optionKey: string) => removeFieldOption(screenKey, field.key, optionKey),
    [removeFieldOption, screenKey],
  );

  const referenceOptions = useCallback(
    (field: FieldDefinition): ReferenceOption[] =>
      referenceOptionsByEntity[field.refEntity ?? ''] ?? [],
    [referenceOptionsByEntity],
  );

  const isFieldHidden = useCallback(
    (field: FieldDefinition): boolean =>
      evaluateFieldBoolean(field.logic?.hiddenWhen, { value: values[field.key], data: values }),
    [values],
  );

  const isFieldDisabled = useCallback(
    (field: FieldDefinition): boolean =>
      disabled || evaluateFieldBoolean(field.logic?.disabledWhen, { value: values[field.key], data: values }),
    [disabled, values],
  );

  const fieldError = useCallback(
    (field: FieldDefinition): string | null =>
      evaluateFieldValidation(field.logic?.validate, { value: values[field.key], data: values }),
    [values],
  );

  return {
    groups,
    disabled,
    canDeleteOption,
    getString,
    getStringArray,
    getBoolean,
    getCurrency,
    setValue,
    staticSelectOptions,
    dynamicSelectOptions,
    handleAddOption,
    handleDeleteOption,
    referenceOptions,
    isFieldHidden,
    isFieldDisabled,
    fieldError,
  };
};
