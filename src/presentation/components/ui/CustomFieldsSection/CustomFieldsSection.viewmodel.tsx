import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useLookups } from '../../../../stores/useLookups';
import { useTenant } from '../../../../stores/useTenant';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import { readValueByPath, sortFieldsByOrder } from '../../../../domain/services/customFieldValues';
import { evaluateFieldBoolean, evaluateFieldValidation } from '../../../../domain/schema/fieldExpression';
import { computeFieldValues } from '../../../../domain/schema/recordRules';
import { buildHydratedFieldScope } from '../../../../domain/schema/referenceScope';
import { useRecordResolver } from '../../../shared/useRecordResolver';
import { useFieldChangeEffects } from './useFieldChangeEffects';
import { nextLookupOptionColor, resolveColor, resolveFieldOptionColor } from '../../../../shared/styles/colorUtils';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';
import type { DynamicSelectOption } from '../DynamicSelect';
import type { ReferenceOption } from '../../../hooks/useReferenceOptions';

export interface LookupOptionSet {
  staticOptions: DynamicSelectOption[];
  dynamicOptions: DynamicSelectOption[];
}

const readByPath = readValueByPath;

export interface CustomFieldsSectionProps {
  fields: FieldDefinition[];
  values: Record<string, CustomFieldValue>;
  onChange: (fieldKey: string, value: CustomFieldValue) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  /** Habilita os efeitos de `onChange` (preencher vários campos). Ausente = comportamento anterior. */
  onMergeValues?: (patch: Record<string, unknown>) => void;
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
  /** Campo aguardando uma busca externa (ex.: endereço pelo CEP). */
  isFieldLoading: (fieldKey: string) => boolean;
}

export const useCustomFieldsSectionViewModel = (props: CustomFieldsSectionProps): CustomFieldsSectionViewModel => {
  const {
    fields,
    values: rawValues,
    onChange,
    disabled = false,
    errors,
    onMergeValues,
  } = props;
  const { getOptions, addOption, removeOption } = useLookups();
  const { tenantRole } = useTenant();
  const referenceOptionsByEntity = useReferenceOptions();
  const theme = useTheme();

  const canDeleteOption = tenantRole === 'admin';

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

  /**
   * As opções que o usuário NÃO pode excluir: as declaradas no próprio campo (lista fechada) e as
   * que já vêm prontas na lista do kernel (`lookupDefaults`). O `DynamicSelect` as renderiza sem o
   * botão de excluir, separadas das cadastradas pelo escritório.
   */
  const staticSelectOptions = useCallback(
    (field: FieldDefinition): DynamicSelectOption[] => {
      const declared = (field.options ?? []).map((option) => ({
        value: option.key,
        label: option.label,
        color: resolveFieldOptionColor(option.color, field.optionsColored, theme),
      }));
      const fromKernel = getOptions(field.lookupCollection ?? '')
        .filter((option) => option.isStatic)
        .map((option) => ({
          value: option.key,
          label: option.label,
          color: resolveColor(option.color, theme, false),
        }));
      return [...declared, ...fromKernel];
    },
    [getOptions, theme],
  );

  /**
   * As opções cadastradas pelo usuário moram na COLEÇÃO que o campo declara em `lookupCollection` —
   * `caseCourts` para um campo do kernel, `medico_especialidade` para um do Form Design. Um caminho
   * só: nada aqui pergunta de onde o campo veio.
   *
   * O valor gravado é a CHAVE da opção, e não o rótulo: é assim que a listagem filtra e é assim que
   * a lista cuja chave difere do rótulo (`pending` / "Pendente") continua legível dos dois lados. Na
   * opção cadastrada no escritório os dois são o mesmo texto.
   */
  const dynamicSelectOptions = useCallback(
    (field: FieldDefinition): DynamicSelectOption[] =>
      getOptions(field.lookupCollection ?? '')
        .filter((option) => !option.isStatic)
        .map((option) => ({
          value: option.key,
          label: option.label,
          color: resolveColor(option.color, theme, false),
        })),
    [getOptions, theme],
  );

  const handleAddOption = useCallback(
    async (field: FieldDefinition, label: string): Promise<void> => {
      if (!field.lookupCollection) return;
      const existing = getOptions(field.lookupCollection).map((option) => option.color);
      await addOption(
        field.lookupCollection,
        label,
        nextLookupOptionColor(existing, field.optionsColored, theme),
      );
    },
    [addOption, getOptions, theme],
  );

  const handleDeleteOption = useCallback(
    async (field: FieldDefinition, optionKey: string): Promise<void> => {
      if (field.lookupCollection) await removeOption(field.lookupCollection, optionKey);
    },
    [removeOption],
  );

  const referenceOptions = useCallback(
    (field: FieldDefinition): ReferenceOption[] =>
      referenceOptionsByEntity[field.refEntity ?? ''] ?? [],
    [referenceOptionsByEntity],
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
    isFieldHidden,
    isFieldDisabled,
    fieldError,
    isFieldLoading,
  };
};
