import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReferenceSearch } from '../../../shared/useReferenceSearch';
import { useEnsureReferencedRecords } from '../../../shared/useEnsureReferencedRecords';
import { useTheme } from 'styled-components';
import { useLookups } from '../../../../stores/useLookups';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { PERMISSION_SCREENS_MANAGE } from '../../../../domain/schema/access';
import { useReferenceOptions } from '../../../hooks/useReferenceOptions';
import { readValueByPath, sortFieldsByOrder } from '../../../../domain/services/customFieldValues';
import { evaluateFieldBoolean, evaluateFieldValidation } from '../../../../domain/schema/fieldExpression';
import { computeFieldValues, deriveFieldValues } from '../../../../domain/schema/recordRules';
import { buildHydratedFieldScope } from '../../../../domain/schema/referenceScope';
import { buildFieldUiScope } from '../../../../domain/schema/fieldUiScope';
import { isSequenceField } from '../../../../domain/schema/recordSequence';
import { useRecordResolver } from '../../../shared/useRecordResolver';
import { useReferenceOpener } from '../../../shared/useReferenceOpener';
import { useLabel } from '../../../shared/i18n/useT';
import { useFieldChangeEffects } from './useFieldChangeEffects';
import { nextLookupOptionColor, resolveColor, resolveFieldOptionColor } from '../../../../shared/styles/colorUtils';
import type { CustomFieldValue, FieldDefinition } from '../../../../domain/entities';
import type { DynamicSelectOption } from '../DynamicSelect';
import type { ReferenceOption } from '../../../hooks/useReferenceOptions';
import type { ReferenceOpener } from '../../../shared/useReferenceOpener';
import type { FieldFileUpload } from '../../../shared/entityScreen/types';

export interface LookupOptionSet {
  staticOptions: DynamicSelectOption[];
  dynamicOptions: DynamicSelectOption[];
}

const readByPath = readValueByPath;

/**
 * O instante que os campos derivados (`logic.derive`) respondem, mantido em ESTADO — e não lido do
 * relógio no corpo do render, que é função impura e o que a regra de pureza do React Compiler
 * proíbe. Ele se renova quando a aba volta ao foco, pelo mesmo gesto que faz os Stores relerem: o
 * valor derivado fala do momento em que se olha, então "voltar a olhar" é exatamente o evento que
 * precisa refazê-lo.
 */
const useDerivationInstant = (): Date => {
  const [at, setAt] = useState(() => new Date());

  useEffect(() => {
    const refresh = (): void => {
      if (document.visibilityState === 'visible') setAt(new Date());
    };
    document.addEventListener('visibilitychange', refresh);
    return () => document.removeEventListener('visibilitychange', refresh);
  }, []);

  return at;
};

export interface CustomFieldsSectionProps {
  fields: FieldDefinition[];
  values: Record<string, CustomFieldValue>;
  onChange: (fieldKey: string, value: CustomFieldValue) => void;
  disabled?: boolean;
  errors?: Record<string, string>;
  /** Habilita os efeitos de `onChange` (preencher vários campos). Ausente = comportamento anterior. */
  onMergeValues?: (patch: Record<string, unknown>) => void;
  /**
   * Envio de arquivo dos campos `file`. Ausente, esses campos ficam somente-leitura — é o caso de um
   * formulário que não é de registro numa coleção, e portanto não tem caminho onde gravar.
   */
  fileUpload?: FieldFileUpload;
  /**
   * O registro ainda não existe no servidor. Exposto às expressões front-only como `isNew`, para que
   * um campo possa aparecer só na criação (ou só na edição). Ausente = registro já existente.
   */
  isNew?: boolean;
  /**
   * O usuário já alterou algum campo e ainda não salvou. Exposto às expressões front-only como
   * `isDirty`. Ausente = formulário intocado.
   */
  isDirty?: boolean;
  /**
   * A COLEÇÃO do registro em edição — o que `<entity>` vira em `hasPermission` dentro de um
   * `hiddenWhen`/`disabledWhen` de campo. Ausente, o marcador não resolve e o padrão que o usa não
   * casa; o identificador escrito por extenso continua valendo.
   */
  entity?: string;
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
  handleRecolorOption: (field: FieldDefinition, optionKey: string, color: string) => Promise<void>;
  handleDeleteOption: (field: FieldDefinition, optionKey: string) => Promise<void>;
  referenceOptions: (field: FieldDefinition) => ReferenceOption[];
  /** O texto digitado no seletor de referência — é ele que vai ao servidor buscar além das opções carregadas. */
  onReferenceQuery: (field: FieldDefinition, text: string) => void;
  /** Os ids que o servidor achou para o texto do seletor deste campo. */
  referenceMatches: (field: FieldDefinition) => ReadonlySet<string>;
  /**
   * O atalho até o registro que o campo aponta, ou `null` quando não há para onde ir — é o que dá ao
   * controle de referência o gesto de abrir o registro escolhido sem perder o formulário de vista.
   */
  referenceOpener: (field: FieldDefinition) => ReferenceOpener | null;
  isFieldHidden: (field: FieldDefinition) => boolean;
  isFieldDisabled: (field: FieldDefinition) => boolean;
  fieldError: (field: FieldDefinition) => string | null;
  /** O aviso neutro sob o campo — hoje, o do número que o sistema atribui ao salvar. */
  fieldHint: (field: FieldDefinition) => string | null;
  /** Campo aguardando uma busca externa (ex.: endereço pelo CEP). */
  isFieldLoading: (fieldKey: string) => boolean;
  fileUpload: FieldFileUpload | null;
}

export const useCustomFieldsSectionViewModel = (props: CustomFieldsSectionProps): CustomFieldsSectionViewModel => {
  const {
    fields,
    values: rawValues,
    onChange,
    disabled = false,
    errors,
    onMergeValues,
    isNew = false,
    isDirty = false,
    entity,
  } = props;
  const { getOptions, addOption, recolorOption, removeOption } = useLookups();
  const { can, effectivePermissions } = useAuthorization();
  const referenceOptionsByEntity = useReferenceOptions();
  const referencedFrom = useMemo(() => [rawValues as Record<string, unknown>], [rawValues]);
  useEnsureReferencedRecords(referencedFrom, fields);
  const theme = useTheme();
  const label = useLabel();

  const canDeleteOption = can(PERMISSION_SCREENS_MANAGE);

  const resolveRecord = useRecordResolver();
  const resolveReferenceOpener = useReferenceOpener();

  const { runFieldChangeEffects, isFieldLoading } = useFieldChangeEffects({
    fields,
    values: rawValues,
    resolveRecord,
    onMergeValues,
    isNew,
  });

  const derivationInstant = useDerivationInstant();

  // Os campos calculados são derivados aqui apenas para exibição: quem os persiste é
  // formatAndValidateRecord, na gravação, com a mesma avaliação. Os DERIVADOS são avaliados pela
  // mesma razão de sempre — ninguém os persiste em lugar nenhum —, e um registro já lido chega com
  // eles prontos; aqui eles se refazem enquanto se digita, e num registro novo é o único cálculo
  // que existe.
  const values = useMemo<Record<string, CustomFieldValue>>(() => {
    // O derivado enxerga o calculado, e não o contrário: `compute` roda na gravação, onde campo
    // derivado nenhum existe. Avaliar nesta ordem é o que faz a tela concordar com o servidor.
    const computed = { ...rawValues, ...computeFieldValues(fields, rawValues) };
    return {
      ...computed,
      ...deriveFieldValues(fields, computed, derivationInstant),
    } as Record<string, CustomFieldValue>;
  }, [fields, rawValues, derivationInstant]);

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

  /**
   * A cor sorteada na criação deixa de ser definitiva. A troca vale só para a opção CADASTRADA — a
   * fixa vem em código, e regravá-la aqui não teria onde. Nada mais do documento é tocado: o rótulo
   * é o texto do escritório e a chave é o que os registros já gravaram.
   */
  const handleRecolorOption = useCallback(
    async (field: FieldDefinition, optionKey: string, color: string): Promise<void> => {
      if (field.lookupCollection) await recolorOption(field.lookupCollection, optionKey, color);
    },
    [recolorOption],
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

  const referenceSearch = useReferenceSearch();
  const onReferenceQuery = useCallback(
    (field: FieldDefinition, text: string) => referenceSearch.onQuery(field.key, field.refEntity, text),
    [referenceSearch],
  );
  const referenceMatches = useCallback(
    (field: FieldDefinition) => referenceSearch.matchesFor(field.key),
    [referenceSearch],
  );

  const referenceOpener = useCallback(
    (field: FieldDefinition): ReferenceOpener | null => resolveReferenceOpener(field.refEntity),
    [resolveReferenceOpener],
  );

  // Escopo com os campos de referência trocados pelo registro apontado, para que `produto.preco`
  // funcione. Vale SÓ nos slots front-only: `validate` e `compute` também rodam no backend, onde só
  // existe o id, e precisam continuar avaliando sobre ele.
  const hydratedScope = useMemo(
    () => buildHydratedFieldScope(fields, values, resolveRecord),
    [fields, values, resolveRecord],
  );

  // A SITUAÇÃO em que o formulário está aberto, ao lado do registro: é o que permite a um campo
  // aparecer só na criação (`hiddenWhen: 'not isNew'`) ou só na edição (`hiddenWhen: 'isNew'`), e a
  // outro travar depois da primeira alteração (`disabledWhen: 'isDirty'`).
  const uiScope = useMemo(
    () => buildFieldUiScope(hydratedScope, { isNew, isDirty }),
    [hydratedScope, isNew, isDirty],
  );

  /**
   * As permissões e a coleção seguem para a avaliação da MESMA forma que nas ações: pelo contexto.
   * Sem isso, `hasPermission(...)` num `hiddenWhen` de campo dependeria do gate de módulo — que é
   * empurrado por efeito e não provoca recálculo, então erraria na primeira pintura do formulário.
   */
  const exprExtras = useMemo(
    () => ({ permissions: effectivePermissions, ...(entity ? { entity } : {}) }),
    [effectivePermissions, entity],
  );

  const isFieldHidden = useCallback(
    (field: FieldDefinition): boolean =>
      evaluateFieldBoolean(field.logic?.hiddenWhen, {
        value: hydratedScope[field.key],
        data: uiScope,
        ...exprExtras,
      }),
    [hydratedScope, uiScope, exprExtras],
  );

  const isFieldDisabled = useCallback(
    (field: FieldDefinition): boolean =>
      disabled ||
      isSequenceField(field) ||
      Boolean(field.logic?.compute) ||
      Boolean(field.logic?.derive) ||
      Boolean(field.aggregation) ||
      evaluateFieldBoolean(field.logic?.disabledWhen, {
        value: hydratedScope[field.key],
        data: uiScope,
        ...exprExtras,
      }),
    [disabled, hydratedScope, uiScope, exprExtras],
  );

  const fieldError = useCallback(
    (field: FieldDefinition): string | null => {
      const error =
        errors?.[field.key] ??
        evaluateFieldValidation(field.logic?.validate, { value: readByPath(values, field.key), data: values });
      return error === null || error === undefined ? null : label(error);
    },
    [errors, values, label],
  );

  const fieldHint = useCallback(
    (field: FieldDefinition): string | null => {
      if (!isSequenceField(field)) return null;
      const value = readByPath(values, field.key);
      if (value !== undefined && value !== null && value !== '') return null;
      return label(isNew ? '@core.records/sequence.assigned-on-save' : '@core.records/sequence.not-assigned');
    },
    [values, isNew, label],
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
    handleRecolorOption,
    handleDeleteOption,
    referenceOptions,
    onReferenceQuery,
    referenceMatches,
    referenceOpener,
    isFieldHidden,
    isFieldDisabled,
    fieldError,
    fieldHint,
    isFieldLoading,
    fileUpload: props.fileUpload ?? null,
  };
};
