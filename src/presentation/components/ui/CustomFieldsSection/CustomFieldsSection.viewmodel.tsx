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

export interface LookupOptionSet {
  staticOptions: DynamicSelectOption[];
  dynamicOptions: DynamicSelectOption[];
}

const readByPath = (values: Record<string, unknown>, key: string): unknown => {
  if (!key.includes('.')) return values[key];
  return key.split('.').reduce<unknown>(
    (acc, part) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    values,
  );
};

export interface CustomFieldsSectionProps {
  screenKey: string;
  fields: FieldDefinition[];
  values: Record<string, CustomFieldValue>;
  onChange: (fieldKey: string, value: CustomFieldValue) => void;
  disabled?: boolean;
  lookupOptions?: Record<string, LookupOptionSet>;
  onAddLookupOption?: (collection: string, label: string) => void | Promise<void>;
  onDeleteLookupOption?: (collection: string, optionKey: string) => void | Promise<void>;
  canDeleteLookupOption?: boolean;
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
  lookupStaticOptions: (field: FieldDefinition) => DynamicSelectOption[];
  lookupDynamicOptions: (field: FieldDefinition) => DynamicSelectOption[];
  handleAddLookupOption: (field: FieldDefinition, label: string) => Promise<void>;
  handleDeleteLookupOption: (field: FieldDefinition, optionKey: string) => Promise<void>;
  canDeleteLookupOption: boolean;
  isFieldHidden: (field: FieldDefinition) => boolean;
  isFieldDisabled: (field: FieldDefinition) => boolean;
  fieldError: (field: FieldDefinition) => string | null;
}

export const useCustomFieldsSectionViewModel = (props: CustomFieldsSectionProps): CustomFieldsSectionViewModel => {
  const {
    screenKey,
    fields,
    values,
    onChange,
    disabled = false,
    lookupOptions,
    onAddLookupOption,
    onDeleteLookupOption,
    canDeleteLookupOption = false,
  } = props;
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
    const value = readByPath(values, fieldKey);
    return typeof value === 'string' ? value : '';
  }, [values]);

  const getStringArray = useCallback((fieldKey: string) => {
    const value = readByPath(values, fieldKey);
    return Array.isArray(value) ? value : [];
  }, [values]);

  const getBoolean = useCallback((fieldKey: string) => readByPath(values, fieldKey) === true, [values]);

  const getCurrency = useCallback((fieldKey: string) => {
    const value = readByPath(values, fieldKey);
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

  const lookupStaticOptions = useCallback(
    (field: FieldDefinition): DynamicSelectOption[] =>
      lookupOptions?.[field.lookupCollection ?? '']?.staticOptions ?? [],
    [lookupOptions],
  );

  const lookupDynamicOptions = useCallback(
    (field: FieldDefinition): DynamicSelectOption[] =>
      lookupOptions?.[field.lookupCollection ?? '']?.dynamicOptions ?? [],
    [lookupOptions],
  );

  const handleAddLookupOption = useCallback(
    async (field: FieldDefinition, label: string): Promise<void> => {
      if (field.lookupCollection) await onAddLookupOption?.(field.lookupCollection, label);
    },
    [onAddLookupOption],
  );

  const handleDeleteLookupOption = useCallback(
    async (field: FieldDefinition, optionKey: string): Promise<void> => {
      if (field.lookupCollection) await onDeleteLookupOption?.(field.lookupCollection, optionKey);
    },
    [onDeleteLookupOption],
  );

  const isFieldHidden = useCallback(
    (field: FieldDefinition): boolean =>
      evaluateFieldBoolean(field.logic?.hiddenWhen, { value: readByPath(values, field.key), data: values }),
    [values],
  );

  const isFieldDisabled = useCallback(
    (field: FieldDefinition): boolean =>
      disabled || evaluateFieldBoolean(field.logic?.disabledWhen, { value: readByPath(values, field.key), data: values }),
    [disabled, values],
  );

  const fieldError = useCallback(
    (field: FieldDefinition): string | null =>
      evaluateFieldValidation(field.logic?.validate, { value: readByPath(values, field.key), data: values }),
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
    lookupStaticOptions,
    lookupDynamicOptions,
    handleAddLookupOption,
    handleDeleteLookupOption,
    canDeleteLookupOption,
    isFieldHidden,
    isFieldDisabled,
    fieldError,
  };
};
