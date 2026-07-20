import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useScreenDefinitions, fieldOptionsKey } from '../../../../stores/useScreenDefinitions';
import { useTenant } from '../../../../stores/useTenant';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import { sortFieldsByOrder } from '../../../../domain/services/customFieldValues';
import { evaluateFieldBoolean, evaluateFieldValidation } from '../../../../domain/schema/fieldExpression';
import { computeFieldValues } from '../../../../domain/schema/recordRules';
import { buildHydratedFieldScope } from '../../../../domain/schema/referenceScope';
import { useRecordResolver } from '../../../shared/useRecordResolver';
import { useFieldChangeEffects } from './useFieldChangeEffects';
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
  errors?: Record<string, string>;
  /** Habilita os efeitos de `onChange` (preencher vários campos). Ausente = comportamento anterior. */
  onMergeValues?: (patch: Record<string, unknown>) => void;
  /**
   * Resolve a tela dona das opções de cada campo. Necessário na lista unificada das telas fixas,
   * onde campos do sistema e adicionais convivem mas indexam opções em chaves diferentes.
   * Ausente = todos usam `screenKey`.
   */
  resolveOptionsScreenKey?: (field: FieldDefinition) => string;
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
  /** Campo aguardando uma busca externa (ex.: endereço pelo CEP). */
  isFieldLoading: (fieldKey: string) => boolean;
}

export const useCustomFieldsSectionViewModel = (props: CustomFieldsSectionProps): CustomFieldsSectionViewModel => {
  const {
    screenKey,
    fields,
    values: rawValues,
    onChange,
    disabled = false,
    lookupOptions,
    onAddLookupOption,
    onDeleteLookupOption,
    canDeleteLookupOption = false,
    errors,
    onMergeValues,
    resolveOptionsScreenKey,
  } = props;
  const { fieldOptionsByField, addFieldOption, removeFieldOption } = useScreenDefinitions();
  const { tenantRole } = useTenant();
  const referenceOptionsByEntity = useReferenceOptions();
  const theme = useTheme();

  const canDeleteOption = tenantRole === 'admin';

  const optionsScreenKeyOf = useCallback(
    (field: FieldDefinition): string => resolveOptionsScreenKey?.(field) ?? screenKey,
    [resolveOptionsScreenKey, screenKey],
  );

  const resolveRecord = useRecordResolver();

  const { runFieldChangeEffects, isFieldLoading } = useFieldChangeEffects({
    fields,
    values: rawValues,
    resolveRecord,
    onMergeValues,
  });

  // Os campos calculados são derivados aqui apenas para exibição: quem os persiste é
  // formatAndValidateRecord, na gravação, com a mesma avaliação.
  const values = useMemo<Record<string, CustomFieldValue>>(
    () => ({ ...rawValues, ...(computeFieldValues(fields, rawValues) as Record<string, CustomFieldValue>) }),
    [fields, rawValues],
  );

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

  // Números entram aqui vindos de um campo calculado ou de uma gravação por automação (que coage
  // o tipo declarado): devolver '' os apagaria da tela. Campos de texto seguem inalterados.
  const getString = useCallback((fieldKey: string) => {
    const value = readByPath(values, fieldKey);
    if (typeof value === 'number') return String(value);
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
    runFieldChangeEffects(fieldKey, value);
  }, [onChange, runFieldChangeEffects]);

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
      (fieldOptionsByField[fieldOptionsKey(optionsScreenKeyOf(field), field.key)] ?? []).map((o) => ({
        value: o.key,
        label: o.label,
        color: resolveFieldOptionColor(undefined, field.optionsColored, theme),
      })),
    [fieldOptionsByField, optionsScreenKeyOf, theme],
  );

  const handleAddOption = useCallback(
    (field: FieldDefinition, label: string) => addFieldOption(optionsScreenKeyOf(field), field.key, label),
    [addFieldOption, optionsScreenKeyOf],
  );

  const handleDeleteOption = useCallback(
    (field: FieldDefinition, optionKey: string) => removeFieldOption(optionsScreenKeyOf(field), field.key, optionKey),
    [removeFieldOption, optionsScreenKeyOf],
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

  // Escopo com os campos de referência trocados pelo registro apontado, para que `produto.preco`
  // funcione. Vale SÓ nos slots front-only: `validate` e `compute` também rodam no backend, onde só
  // existe o id, e precisam continuar avaliando sobre ele.
  const hydratedScope = useMemo(
    () => buildHydratedFieldScope(fields, values, resolveRecord),
    [fields, values, resolveRecord],
  );

  const isFieldHidden = useCallback(
    (field: FieldDefinition): boolean =>
      evaluateFieldBoolean(field.logic?.hiddenWhen, {
        value: hydratedScope[field.key],
        data: hydratedScope,
      }),
    [hydratedScope],
  );

  const isFieldDisabled = useCallback(
    (field: FieldDefinition): boolean =>
      disabled ||
      Boolean(field.logic?.compute) ||
      Boolean(field.aggregation) ||
      evaluateFieldBoolean(field.logic?.disabledWhen, {
        value: hydratedScope[field.key],
        data: hydratedScope,
      }),
    [disabled, hydratedScope],
  );

  const fieldError = useCallback(
    (field: FieldDefinition): string | null =>
      errors?.[field.key] ??
      evaluateFieldValidation(field.logic?.validate, { value: readByPath(values, field.key), data: values }),
    [errors, values],
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
    isFieldLoading,
  };
};
