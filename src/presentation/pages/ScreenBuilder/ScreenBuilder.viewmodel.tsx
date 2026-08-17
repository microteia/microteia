import { useCallback, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { useTenant } from '../../../stores/useTenant';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import type { ScreenDefinitionSaveInput } from '../../../stores/useScreenDefinitions';
import { useNotification } from '../../../stores/useNotification';
import { useActions } from '../../../stores/useActions';
import { ensureUniqueKey, slugifyFieldKey, sortFieldsByOrder, validateFieldKey } from '../../../domain/services/customFieldValues';
import { getDefaultTagColor } from '../../../shared/styles/colorUtils';
import { getScreenIconOptions } from '../../shared/screenIcons';
import { useRecordActions } from '../../shared/recordActions/useRecordActions';
import type { ResolvedRecordAction } from '../../shared/recordActions/useRecordActions';
import { resolveListActions, supportedListActions } from '../../shared/listActionCapabilities';
import type { CustomFieldMask, CustomFieldType, FieldDefinition, ScreenDefinition, ScreenListAction } from '../../../domain/entities';
import type { AggregationOp, FieldAggregation, FieldLookupBinding, FieldLogic, FieldRules, FormatPreset, FormatRule, ValidateCheck, ValidateRule } from '../../../domain/schema/fieldRules';
import { AGGREGATION_OP_LABELS } from '../../../domain/schema/fieldRules';
import {
  formatPresetOptions as buildFormatPresetOptions,
  maskPresetOptions as buildMaskPresetOptions,
  useFieldRulePresets,
  validatePresetOptions as buildValidatePresetOptions,
} from '../../shared/useFieldRulePresets';
import type { ExternalLookupProviderOption } from '../../shared/useExternalLookupProviders';
import { useExternalLookupOptions } from '../../shared/useExternalLookupProviders';
import { extractFieldExpressionDependencies } from '../../../domain/schema/fieldExpression';
import { aggregationCreatesCycle } from '../../../domain/schema/aggregationSpec';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useLookups } from '../../../stores/useLookups';
import { useTags } from '../../../stores/useTags';
import { deriveFormFields } from '../../shared/deriveEntitySchema';
import { RESERVED_COLLECTIONS, builtinScreenBaseline, derivedLookupCollection, derivedTagCollection, lookupIdIssue, screenIdIssue, tagListIdIssue } from '../../../domain/schema/screenEntity';
import { isBoundScreen, screenDataCollection } from '../../../domain/services/screenDataCollection';
import type { EntityKey } from '../../../domain/schema/entityRegistry';
import { ENTITY_REGISTRY, ENTITY_REGISTRY_LIST, getEntityByCollection } from '../../../domain/schema/entityRegistry';
import type { WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { ColorSwatchOption } from '../../components/ui/ColorSwatchPicker';

import { useLabel, useT, type TranslateFn } from '../../shared/i18n/useT';

export interface BuiltinScreenRow {
  key: string;
  label: string;
  fields: FieldDefinition[];
}

export interface ScreenListEntry {
  key: string;
  icon: string;
  title: string;
  meta: string;
  disabled: boolean;
}

export interface SelectedScreenState {
  kind: 'dynamic' | 'builtin';
  key: string;
  icon: string;
  title: string;
  meta: string;
  enabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  fields: FieldDefinition[];
}

export interface ChildCandidate {
  key: string;
  label: string;
  fieldOptions: SearchSelectOption[];
}

export interface ScreenFormState {
  titleSingular: string;
  titlePlural: string;
  icon: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
  tagCollection: string;
  listActions: ScreenListAction[];
  viewActionIds: string[];
  cardActionIds: string[];
  /** telaFilha -> campo de vínculo. A relação é sempre configurada de dentro do PAI. */
  childLinks: Record<string, string>;
  enabled: boolean;
  titleFieldKey: string;
  subtitleFieldKey: string;
}

/**
 * Uma caixa por SLOT de ação do cartão. A lista era literal aqui — quatro nomes escritos à mão —, o
 * que fechava a porta que o ponto `ui.record.action` abriu: uma extensão registrava a ação dela e
 * nenhuma tela conseguia habilitá-la, porque a configuração não a oferecia.
 *
 * Duas ações no mesmo slot (excluir e desvincular) são UMA caixa: a tela habilita o slot, e a
 * expressão de cada uma decide qual o usuário vê.
 */
export interface ListActionOption {
  key: ScreenListAction;
  label: string;
  requiresTags: boolean;
}

export const listActionOptionsFrom = (actions: ResolvedRecordAction[]): ListActionOption[] => {
  const bySlot = new Map<string, ListActionOption>();
  for (const action of actions) {
    // O rótulo da caixa é o da ação que dá NOME ao slot; as que apenas o dividem não o renomeiam.
    const owner = action.metadata.key === action.slot;
    if (!owner && bySlot.has(action.slot)) continue;
    bySlot.set(action.slot, {
      key: action.slot,
      label: action.metadata.title,
      requiresTags: !!action.metadata.requiresTags,
    });
  }
  return [...bySlot.values()];
};

export interface FieldOptionFormItem {
  label: string;
  color?: string;
}

export interface FieldFormState {
  label: string;
  fieldKey: string;
  type: CustomFieldType;
  required: boolean;
  section: string;
  placeholder: string;
  multi: boolean;
  mask: CustomFieldMask | '';
  refEntity: string;
  optionsAllowUserAdd: boolean;
  lookupCollection: string;
  optionsColored: boolean;
  staticOptions: FieldOptionFormItem[];
  optionInput: string;
  optionColorInput: string;
  showInList: boolean;
  listLabel: string;
  filterable: boolean;
  ruleFormatPreset: FormatPreset | '';
  ruleFormatPattern: string;
  ruleFormatReplacement: string;
  ruleValidateCheck: ValidateCheck | '';
  ruleValidatePattern: string;
  ruleValidateMessage: string;
  logicValidate: string;
  logicDisabledWhen: string;
  logicHiddenWhen: string;
  logicCompute: string;
  logicOnChange: string;
  lookupProvider: string;
  lookupTargetPrefix: string;
  aggregationFrom: string;
  aggregationVia: string;
  aggregationOp: AggregationOp | '';
  aggregationField: string;
  aggregationFilter: string;
}

export type ScreenModalTab = 'general' | 'list' | 'actions' | 'children';
export type FieldModalTab = 'general' | 'advanced';

export interface ScreenBuilderViewModel {
  isAdmin: boolean;
  isLoading: boolean;
  dynamicDefinitions: ScreenDefinition[];
  fieldsByScreen: Record<string, FieldDefinition[]>;
  builtinRows: BuiltinScreenRow[];
  dynamicListEntries: ScreenListEntry[];
  builtinListEntries: ScreenListEntry[];
  selectedKey: string | null;
  selectScreen: (key: string) => void;
  selectedScreen: SelectedScreenState | null;
  fieldTypeLabel: (type: CustomFieldType) => string;
  isTitleField: (screenKey: string, fieldKey: string) => boolean;
  /** Campo declarado em código (tela fixa): edição restrita e sem exclusão. */
  isNativeField: (screenKey: string, fieldKey: string) => boolean;
  isManagedScreen: (screenKey: string) => boolean;
  isPluginField: (screenKey: string, fieldKey: string) => boolean;
  managedScreenOwner: (screenKey: string) => string | null;
  hasNativeOverride: (screenKey: string, fieldKey: string) => boolean;
  restoreNativeField: (screenKey: string, fieldKey: string) => Promise<void>;
  screenModalOpen: boolean;
  screenModalIsEdit: boolean;
  /** Modal aberto para uma tela do sistema: só configura os registros filhos. */
  screenModalIsBuiltin: boolean;
  screenModalTitle: string;
  screenModalTabs: { key: ScreenModalTab; label: string }[];
  screenModalTab: ScreenModalTab;
  setScreenModalTab: (tab: ScreenModalTab) => void;
  modalListActionOptions: ListActionOption[];
  actionOptions: { value: string; label: string }[];
  setScreenViewActionIds: (ids: string[]) => void;
  setScreenCardActionIds: (ids: string[]) => void;
  screenForm: ScreenFormState;
  updateScreenForm: (patch: Partial<ScreenFormState>) => void;
  toggleListAction: (action: ScreenListAction) => void;
  titleFieldOptions: SearchSelectOption[];
  subtitleFieldOptions: SearchSelectOption[];
  childCandidates: ChildCandidate[];
  toggleChildScreen: (childKey: string) => void;
  setChildLinkField: (childKey: string, fieldKey: string) => void;
  iconOptions: SearchSelectOption[];
  openCreateScreen: () => void;
  openEditScreen: (screenKey: string) => void;
  closeScreenModal: () => void;
  handleSaveScreen: () => Promise<void>;
  savingScreen: boolean;
  toggleScreenEnabled: (screenKey: string) => Promise<void>;
  moveScreen: (screenKey: string, direction: -1 | 1) => Promise<void>;
  requestDeleteScreen: (screenKey: string) => void;
  deleteScreenTarget: ScreenDefinition | null;
  cancelDeleteScreen: () => void;
  confirmDeleteScreen: () => Promise<void>;
  deletingScreen: boolean;
  fieldModalOpen: boolean;
  fieldModalTab: FieldModalTab;
  setFieldModalTab: (tab: FieldModalTab) => void;
  fieldModalIsEdit: boolean;
  fieldModalIsTitleField: boolean;
  /** Modal aberto para um campo do sistema: só apresentação e expressões de front. */
  fieldModalIsNative: boolean;
  fieldForm: FieldFormState;
  updateFieldForm: (patch: Partial<FieldFormState>) => void;
  fieldExpressionVariables: WorkflowVariable[];
  typeOptions: SearchSelectOption[];
  maskOptions: SearchSelectOption[];
  formatPresetOptions: SearchSelectOption[];
  validateCheckOptions: SearchSelectOption[];
  fieldSupportsRules: boolean;
  refEntityOptions: SearchSelectOption[];
  /** Listas do tenant que o campo pode reaproveitar — é assim que duas telas compartilham opções. */
  lookupOptions: SearchSelectOption[];
  /** Conjuntos de etiquetas do tenant que a tela pode reaproveitar. */
  tagListOptions: SearchSelectOption[];
  /** Nome sugerido quando a tela ainda não aponta para nenhum conjunto. */
  suggestedTagCollection: string;
  /** Nome sugerido quando o campo ainda não aponta para nenhuma lista. */
  suggestedLookupCollection: string;
  aggregationFromOptions: SearchSelectOption[];
  aggregationViaOptions: SearchSelectOption[];
  aggregationFieldOptions: SearchSelectOption[];
  aggregationOpOptions: SearchSelectOption[];
  aggregationFilterVariables: WorkflowVariable[];
  lookupProviderOptions: SearchSelectOption[];
  selectedLookupProvider: ExternalLookupProviderOption | null;
  tagColors: ColorSwatchOption[];
  addStaticOption: () => void;
  removeStaticOption: (label: string) => void;
  openCreateField: (screenKey: string) => void;
  openEditField: (screenKey: string, fieldKey: string) => void;
  closeFieldModal: () => void;
  handleSaveField: () => Promise<void>;
  savingField: boolean;
  moveField: (screenKey: string, fieldKey: string, direction: -1 | 1) => Promise<void>;
  draggedFieldKey: string | null;
  dragOverFieldKey: string | null;
  handleFieldDragStart: (fieldKey: string) => void;
  handleFieldDragOver: (fieldKey: string) => void;
  handleFieldDragEnd: () => void;
  handleFieldDrop: (screenKey: string, targetFieldKey: string) => Promise<void>;
  requestDeleteField: (screenKey: string, fieldKey: string) => void;
  deleteFieldTarget: { screenKey: string; field: FieldDefinition } | null;
  cancelDeleteField: () => void;
  confirmDeleteField: () => Promise<void>;
  deletingField: boolean;
}

/**
 * As telas FIXAS do Form Design — derivadas do registro, nunca listadas à mão.
 *
 * Uma lista escrita aqui sobrevive à entidade: quando Processo e Pessoa saíram do kernel, elas
 * continuaram aparecendo como "tela do sistema" mesmo sem extensão instalada, oferecendo um
 * formulário sem esquema por trás. Derivando, a tela some no dia em que a entidade sai — e a que
 * a substitui aparece pelo caminho normal, como qualquer tela do escritório.
 */
const BUILTIN_SCREENS: { key: string; label: string }[] = ENTITY_REGISTRY_LIST
  .filter((entity) => entity.supportsCustomFields)
  .map((entity) => ({ key: entity.collection, label: entity.labelPlural }));

const FIELD_TYPE_KEYS: Record<CustomFieldType, string> = {
  text: 'field.type.text',
  textarea: 'field.type.textarea',
  number: 'field.type.number',
  currency: 'field.type.currency',
  date: 'field.type.date',
  time: 'field.type.time',
  checkbox: 'field.type.checkbox',
  select: 'field.type.select',
  masked: 'field.type.masked',
  reference: 'field.type.reference',
  markdown: 'field.type.markdown',
};

const EMPTY_SCREEN_FORM: ScreenFormState = {
  titleSingular: '',
  titlePlural: '',
  icon: 'apps',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  tagCollection: '',
  listActions: [],
  viewActionIds: [],
  cardActionIds: [],
  childLinks: {},
  enabled: true,
  titleFieldKey: '',
  subtitleFieldKey: '',
};

const EMPTY_FIELD_FORM: FieldFormState = {
  label: '',
  fieldKey: '',
  type: 'text',
  required: false,
  section: '',
  placeholder: '',
  multi: false,
  mask: '',
  refEntity: '',
  optionsAllowUserAdd: false,
  lookupCollection: '',
  optionsColored: false,
  staticOptions: [],
  optionInput: '',
  optionColorInput: '',
  showInList: false,
  listLabel: '',
  filterable: false,
  ruleFormatPreset: '',
  ruleFormatPattern: '',
  ruleFormatReplacement: '',
  ruleValidateCheck: '',
  ruleValidatePattern: '',
  ruleValidateMessage: '',
  logicValidate: '',
  logicDisabledWhen: '',
  logicHiddenWhen: '',
  logicCompute: '',
  logicOnChange: '',
  lookupProvider: '',
  lookupTargetPrefix: '',
  aggregationFrom: '',
  aggregationVia: '',
  aggregationOp: '',
  aggregationField: '',
  aggregationFilter: '',
};

export const RULES_SUPPORTED_FIELD_TYPES: CustomFieldType[] = [
  'text',
  'textarea',
  'masked',
  'markdown',
  'number',
  'currency',
];

const isInvalidRegex = (pattern: string): boolean => {
  if (!pattern.trim()) return false;
  try {
    new RegExp(pattern);
    return false;
  } catch {
    return true;
  }
};

const buildFieldRules = (form: FieldFormState): FieldRules | null => {
  if (!RULES_SUPPORTED_FIELD_TYPES.includes(form.type)) return null;

  const format: FormatRule = {};
  if (form.ruleFormatPreset) format.preset = form.ruleFormatPreset;
  if (form.ruleFormatPattern.trim()) {
    format.pattern = form.ruleFormatPattern.trim();
    format.replacement = form.ruleFormatReplacement;
  }

  const validate: ValidateRule = {};
  if (form.ruleValidateCheck) validate.check = form.ruleValidateCheck;
  if (form.ruleValidatePattern.trim()) validate.pattern = form.ruleValidatePattern.trim();
  if ((validate.check || validate.pattern) && form.ruleValidateMessage.trim()) {
    validate.message = form.ruleValidateMessage.trim();
  }

  const rules: FieldRules = {};
  if (Object.keys(format).length > 0) rules.format = format;
  if (Object.keys(validate).length > 0) rules.validate = validate;
  return Object.keys(rules).length > 0 ? rules : null;
};

const fieldRulesToForm = (rules: FieldRules | null | undefined): Pick<
  FieldFormState,
  'ruleFormatPreset' | 'ruleFormatPattern' | 'ruleFormatReplacement' | 'ruleValidateCheck' | 'ruleValidatePattern' | 'ruleValidateMessage'
> => ({
  ruleFormatPreset: rules?.format?.preset ?? '',
  ruleFormatPattern: rules?.format?.pattern ?? '',
  ruleFormatReplacement: rules?.format?.replacement ?? '',
  ruleValidateCheck: rules?.validate?.check ?? '',
  ruleValidatePattern: rules?.validate?.pattern ?? '',
  ruleValidateMessage: rules?.validate?.message ?? '',
});

const buildFieldLogic = (form: FieldFormState): FieldLogic | null => {
  const logic: FieldLogic = {};
  if (form.logicValidate.trim()) logic.validate = form.logicValidate.trim();
  if (form.logicDisabledWhen.trim()) logic.disabledWhen = form.logicDisabledWhen.trim();
  if (form.logicHiddenWhen.trim()) logic.hiddenWhen = form.logicHiddenWhen.trim();
  if (form.logicCompute.trim()) logic.compute = form.logicCompute.trim();
  if (form.logicOnChange.trim()) logic.onChange = form.logicOnChange.trim();
  const lookup = buildFieldLookup(form);
  if (lookup) logic.onChangeLookup = lookup;
  return Object.keys(logic).length > 0 ? logic : null;
};

/**
 * Ajuste de campo do sistema: só apresentação e as expressões front-only. Tipo, máscara, regras,
 * validação e valor calculado ficam fora — o backend também os lê, e um ajuste que ele não
 * enxergasse faria um workflow gravar registro que a tela rejeita.
 */
const buildFieldLookup = (form: FieldFormState): FieldLookupBinding | null => {
  const provider = form.lookupProvider.trim();
  if (!provider) return null;
  const targetPrefix = form.lookupTargetPrefix.trim();
  return { provider, ...(targetPrefix ? { targetPrefix } : {}) };
};

const buildFieldAggregation = (form: FieldFormState): FieldAggregation | null => {
  const from = form.aggregationFrom.trim();
  const via = form.aggregationVia.trim();
  if (!from || !via || !form.aggregationOp) return null;

  const field = form.aggregationField.trim();
  const filter = form.aggregationFilter.trim();
  return {
    from,
    via,
    op: form.aggregationOp,
    ...(form.aggregationOp !== 'count' && field ? { field } : {}),
    ...(filter ? { filter } : {}),
  };
};

const fieldAggregationToForm = (aggregation: FieldAggregation | null | undefined): Pick<
  FieldFormState,
  'aggregationFrom' | 'aggregationVia' | 'aggregationOp' | 'aggregationField' | 'aggregationFilter'
> => ({
  aggregationFrom: aggregation?.from ?? '',
  aggregationVia: aggregation?.via ?? '',
  aggregationOp: aggregation?.op ?? '',
  aggregationField: aggregation?.field ?? '',
  aggregationFilter: aggregation?.filter ?? '',
});

/**
 * Um campo calculado que dependa (direta ou indiretamente) de si mesmo nunca seria avaliado: o
 * motor descarta os campos em ciclo. Recusar na autoria evita a expressão que "não faz nada".
 */
const findComputeCycle = (
  fields: FieldDefinition[],
  editedKey: string,
  editedCompute: string,
): boolean => {
  const dependenciesOf = new Map<string, string[]>();
  for (const field of fields) {
    if (field.key === editedKey) continue;
    const expr = field.logic?.compute;
    if (expr) dependenciesOf.set(field.key, extractFieldExpressionDependencies(expr));
  }
  dependenciesOf.set(editedKey, extractFieldExpressionDependencies(editedCompute));

  const visiting = new Set<string>();
  const reachesEdited = (key: string): boolean => {
    if (visiting.has(key)) return false;
    visiting.add(key);
    for (const dependency of dependenciesOf.get(key) ?? []) {
      if (dependency === editedKey) return true;
      if (reachesEdited(dependency)) return true;
    }
    return false;
  };

  return reachesEdited(editedKey);
};

const fieldLogicToForm = (logic: FieldLogic | null | undefined): Pick<
  FieldFormState,
  'logicValidate' | 'logicDisabledWhen' | 'logicHiddenWhen' | 'logicCompute' | 'logicOnChange' | 'lookupProvider' | 'lookupTargetPrefix'
> => ({
  logicValidate: logic?.validate ?? '',
  logicDisabledWhen: logic?.disabledWhen ?? '',
  logicHiddenWhen: logic?.hiddenWhen ?? '',
  logicCompute: logic?.compute ?? '',
  logicOnChange: logic?.onChange ?? '',
  lookupProvider: logic?.onChangeLookup?.provider ?? '',
  lookupTargetPrefix: logic?.onChangeLookup?.targetPrefix ?? '',
});

const toSaveInput = (def: ScreenDefinition): ScreenDefinitionSaveInput => ({
  origin: def.origin,
  titleSingular: def.titleSingular,
  titlePlural: def.titlePlural,
  icon: def.icon,
  fields: def.fields,
  titleFieldKey: def.titleFieldKey,
  subtitleFieldKey: def.subtitleFieldKey ?? null,
  hasNotes: def.hasNotes,
  hasDocuments: def.hasDocuments,
  hasTags: def.hasTags,
  tagCollection: def.tagCollection ?? '',
  // Sem isto, salvar qualquer outra coisa na tela desfaria o vínculo com a coleção alvo.
  dataCollection: def.dataCollection ?? null,
  eventPrefix: def.eventPrefix ?? null,
  writeRoles: def.writeRoles ?? null,
  memberWritableFields: def.memberWritableFields ?? null,
  authorCanDelete: def.authorCanDelete ?? null,
  listActions: def.listActions,
  viewActionIds: def.viewActionIds,
  cardActionIds: def.cardActionIds,
  parentEntity: def.parentEntity ?? null,
  parentFieldKey: def.parentFieldKey ?? null,
  sidebarOrder: def.sidebarOrder,
  enabled: def.enabled,
  // Precisa viajar em TODO save: sem isso, salvar qualquer outra coisa na tela apagaria a marca
  // de qual extensão é dona dela.
  ownerPluginId: def.ownerPluginId ?? null,
  managed: def.managed ?? null,
  hideFromSidebar: def.hideFromSidebar ?? null,
  hideFromParentTabs: def.hideFromParentTabs ?? null,
});

const buildDynamicMeta = (t: TranslateFn, def: ScreenDefinition, fieldCount: number): string => {
  const parts = [t('screen.meta.fields', { count: fieldCount })];
  if (def.hasNotes) parts.push(t('core.ui/tab.notes'));
  if (def.hasDocuments) parts.push(t('core.ui/tab.documents'));
  if (def.hasTags) parts.push(t('core.ui/tags.title'));
  return parts.join(' · ');
};

/** O documento mínimo de uma tela fixa, no primeiro ajuste — a MESMA baseline que a instalação de um
 *  complemento de extensão usa, para que os dois caminhos gravem a tela do kernel do mesmo jeito. */
const builtinSaveInput = (key: string): ScreenDefinitionSaveInput => builtinScreenBaseline(key);

export const useScreenBuilderViewModel = (): ScreenBuilderViewModel => {
  const { tenantRole } = useTenant();
  const { definitions, dynamicScreens, isLoading, saveDefinition, deleteDefinition } = useScreenDefinitions();
  const recordActions = useRecordActions();
  const label = useLabel();
  const t = useT('core.records');

  /** Os slots cujas ações só fazem sentido numa tela com etiquetas — declarado, não presumido. */
  const tagDependentSlots = useMemo(
    () => new Set(recordActions.filter((action) => action.metadata.requiresTags).map((action) => action.slot)),
    [recordActions],
  );
  const schemaContext = useSchemaContext();
  const fieldRulePresets = useFieldRulePresets();
  const { availableLookups, declareLookup } = useLookups();
  const { availableTagLists, declareTagList } = useTags();
  const externalLookupProviders = useExternalLookupOptions();
  const { notify } = useNotification();
  const { actions } = useActions();
  const theme = useTheme();

  const isAdmin = tenantRole === 'admin';
  const tagColors = theme.tagColors;
  const defaultTagColor = useMemo(() => getDefaultTagColor(theme), [theme]);

  const [screenModal, setScreenModal] = useState<{ screenKey: string | null } | null>(null);
  // Telas do sistema não têm o interruptor "Habilitar Etiquetas": a capacidade delas vem de
  // supportedListActions. Por isso a regra hasTags → manageTags vale só para telas customizadas.
  const screenModalIsBuiltin = !!screenModal?.screenKey
    && BUILTIN_SCREENS.some((b) => b.key === screenModal.screenKey);
  const [screenModalTab, setScreenModalTab] = useState<ScreenModalTab>('general');
  const [fieldModalTab, setFieldModalTab] = useState<FieldModalTab>('general');
  const [screenForm, setScreenForm] = useState<ScreenFormState>(EMPTY_SCREEN_FORM);
  const [savingScreen, setSavingScreen] = useState(false);
  const [deleteScreenTarget, setDeleteScreenTarget] = useState<ScreenDefinition | null>(null);
  const [deletingScreen, setDeletingScreen] = useState(false);

  const [fieldModal, setFieldModal] = useState<{ screenKey: string; fieldKey: string | null } | null>(null);
  const [fieldModalIsNative, setFieldModalIsNative] = useState(false);
  const [fieldForm, setFieldForm] = useState<FieldFormState>(EMPTY_FIELD_FORM);
  const [savingField, setSavingField] = useState(false);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<{ screenKey: string; field: FieldDefinition } | null>(null);
  const [deletingField, setDeletingField] = useState(false);

  const [selectedKeyState, setSelectedKeyState] = useState<string | null>(null);
  const [draggedFieldKey, setDraggedFieldKey] = useState<string | null>(null);
  const [dragOverFieldKey, setDragOverFieldKey] = useState<string | null>(null);

  /**
   * Uma tela ligada a outra coleção (`dataCollection`) só fica de fora quando a coleção é uma
   * entidade DO KERNEL: aí a linha fixa já a configura, e duas portas para o mesmo esquema apenas
   * confundiriam.
   *
   * Quando a entidade saiu do kernel, a tela ligada passa a ser a ÚNICA que descreve a coleção —
   * esconder ainda seria deixar Pessoas e Processos sem porta nenhuma no Form Design, que foi o que
   * aconteceu. O documento que leva o nome da coleção não substitui: ele existe só para as rules
   * lerem a permissão, sem campos e sem UI.
   */
  const dynamicDefinitions = useMemo(
    () => definitions
      .filter((def) => def.origin !== 'builtin')
      .filter((def) => !isBoundScreen(def) || !(screenDataCollection(def) in ENTITY_REGISTRY))
      .sort((a, b) => a.sidebarOrder - b.sidebarOrder),
    [definitions],
  );

  const fieldsByScreen = useMemo(() => {
    const map: Record<string, FieldDefinition[]> = {};
    definitions.forEach((def) => { map[def.id] = sortFieldsByOrder(def.fields); });
    return map;
  }, [definitions]);

  /**
   * Lista final de campos de CADA tela — fixos declarados em código e adicionais do tenant já
   * mesclados por `resolveEntity`. É a mesma função que monta o formulário, então o que o Form
   * Design mostra é exatamente o que a tela renderiza.
   */
  const resolvedFieldsByScreen = useMemo(() => {
    const map: Record<string, FieldDefinition[]> = {};
    for (const builtin of BUILTIN_SCREENS) {
      map[builtin.key] = deriveFormFields(schemaContext, builtin.key as EntityKey);
    }
    for (const def of definitions) {
      if (map[def.id]) continue;
      // O esquema mora na COLEÇÃO, não na chave da tela: numa tela ligada, resolver pela chave
      // devolveria uma lista vazia — o Form Design mostraria a tela sem campo nenhum.
      map[def.id] = deriveFormFields(schemaContext, screenDataCollection(def));
    }
    return map;
  }, [schemaContext, definitions]);

  const resolvedField = useCallback(
    (screenKey: string, fieldKey: string) => resolvedFieldsByScreen[screenKey]?.find((f) => f.key === fieldKey),
    [resolvedFieldsByScreen],
  );

  /** Campo do kernel: configurável à vontade, mas nunca excluível. */
  const isNativeField = useCallback(
    (screenKey: string, fieldKey: string) => resolvedField(screenKey, fieldKey)?.origin === 'builtin',
    [resolvedField],
  );

  // Telas e campos trazidos por uma extensão: estrutura somente-leitura no Form Design (só a
  // extensão altera/remove). O usuário ainda pode adicionar campos próprios por cima.
  const managedScreenKeys = useMemo(
    () => new Set(dynamicDefinitions.filter((def) => def.origin === 'plugin').map((def) => def.id)),
    [dynamicDefinitions],
  );
  const pluginFieldKeysByScreen = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const def of dynamicDefinitions) {
      const owned = def.fields.filter((f) => f.origin === 'plugin').map((f) => f.key);
      if (owned.length > 0) map[def.id] = new Set(owned);
    }
    return map;
  }, [dynamicDefinitions]);

  const isManagedScreen = useCallback((screenKey: string) => managedScreenKeys.has(screenKey), [managedScreenKeys]);
  const isPluginField = useCallback(
    (screenKey: string, fieldKey: string) => pluginFieldKeysByScreen[screenKey]?.has(fieldKey) === true,
    [pluginFieldKeysByScreen],
  );
  const managedScreenOwner = useCallback(
    (screenKey: string) => dynamicDefinitions.find((def) => def.id === screenKey)?.ownerPluginId ?? null,
    [dynamicDefinitions],
  );

  // O rótulo de uma tela fixa é declarado no registro como REFERÊNCIA (`@core.tenant/entity.plural`),
  // pelo mesmo motivo que o de uma tela de extensão: quem declara não sabe em que idioma será lido.
  const builtinRows = useMemo<BuiltinScreenRow[]>(
    () => BUILTIN_SCREENS.map((b) => ({
      key: b.key,
      label: label(b.label),
      fields: resolvedFieldsByScreen[b.key] ?? [],
    })),
    [resolvedFieldsByScreen, label],
  );

  const dynamicListEntries = useMemo<ScreenListEntry[]>(
    () => dynamicDefinitions.map((def) => ({
      key: def.id,
      icon: def.icon,
      title: def.titlePlural,
      meta: buildDynamicMeta(t, def, fieldsByScreen[def.id]?.length ?? 0),
      disabled: !def.enabled,
    })),
    [dynamicDefinitions, fieldsByScreen, t],
  );

  /**
   * O painel é "campos adicionais nas telas do sistema", então o número que importa ali é o que o
   * ESCRITÓRIO acrescentou. Contar a lista inteira diria "5 campos adicionais" numa tela em que
   * ninguém acrescentou nada — os cinco são do kernel.
   */
  const extraFieldCount = useCallback(
    (fields: FieldDefinition[]) => fields.filter((field) => field.origin !== 'builtin').length,
    [],
  );

  const builtinListEntries = useMemo<ScreenListEntry[]>(
    () => builtinRows.map((row) => ({
      key: row.key,
      icon: 'apps',
      title: row.label,
      meta: t('screen.meta.extra-fields', { count: extraFieldCount(row.fields) }),
      disabled: false,
    })),
    [builtinRows, t, extraFieldCount],
  );

  const selectedKey = useMemo(() => {
    const allKeys = [...dynamicListEntries.map((e) => e.key), ...builtinListEntries.map((e) => e.key)];
    if (selectedKeyState && allKeys.includes(selectedKeyState)) return selectedKeyState;
    return allKeys[0] ?? null;
  }, [selectedKeyState, dynamicListEntries, builtinListEntries]);

  const selectScreen = useCallback((key: string) => setSelectedKeyState(key), []);

  /**
   * O rótulo do campo é EXIBIDO resolvido e EDITADO cru.
   *
   * Um campo declarado em código traz uma referência (`@core.tenant/office.name`), e mostrá-la como
   * está seria mostrar o endereço em vez do texto. Mas o modal de edição continua lendo
   * `resolvedField`, que guarda a referência: preencher o campo "Rótulo" com o texto já traduzido
   * congelaria a tradução no escritório assim que alguém salvasse a tela sem mexer no rótulo — e o
   * inglês nunca mais voltaria para essa tela.
   */
  const forDisplay = useCallback(
    (fields: FieldDefinition[]) => fields.map((field) => ({ ...field, label: label(field.label) })),
    [label],
  );

  const selectedScreen = useMemo<SelectedScreenState | null>(() => {
    if (!selectedKey) return null;
    const dynIndex = dynamicDefinitions.findIndex((def) => def.id === selectedKey);
    if (dynIndex >= 0) {
      const def = dynamicDefinitions[dynIndex];
      return {
        kind: 'dynamic',
        key: def.id,
        icon: def.icon,
        title: def.titlePlural,
        meta: buildDynamicMeta(t, def, fieldsByScreen[def.id]?.length ?? 0),
        enabled: def.enabled,
        canMoveUp: dynIndex > 0,
        canMoveDown: dynIndex < dynamicDefinitions.length - 1,
        fields: forDisplay(fieldsByScreen[def.id] ?? []),
      };
    }
    const row = builtinRows.find((r) => r.key === selectedKey);
    if (row) {
      return {
        kind: 'builtin',
        key: row.key,
        icon: 'apps',
        title: row.label,
        meta: t('screen.meta.extra-fields', { count: extraFieldCount(row.fields) }),
        enabled: true,
        canMoveUp: false,
        canMoveDown: false,
        fields: forDisplay(row.fields),
      };
    }
    return null;
  }, [selectedKey, dynamicDefinitions, builtinRows, fieldsByScreen, t, forDisplay, extraFieldCount]);

  const getDefinitionByKey = useCallback(
    (screenKey: string) => definitions.find((def) => def.id === screenKey),
    [definitions],
  );

  const fieldTypeLabel = useCallback((type: CustomFieldType) => t(FIELD_TYPE_KEYS[type]), [t]);

  const isTitleField = useCallback((screenKey: string, fieldKey: string) => {
    const def = getDefinitionByKey(screenKey);
    return !!def && def.origin !== 'builtin' && def.titleFieldKey === fieldKey;
  }, [getDefinitionByKey]);

  // Sem etiquetas na tela não há o que gerenciar pelo card: desligar "Habilitar Etiquetas"
  // retira a ação da configuração, para não gravar uma combinação que a listagem ignoraria.
  const updateScreenForm = useCallback((patch: Partial<ScreenFormState>) => {
    setScreenForm((prev) => {
      const next = { ...prev, ...patch };
      if (screenModalIsBuiltin || next.hasTags) return next;
      return { ...next, listActions: next.listActions.filter((a) => !tagDependentSlots.has(a)) };
    });
  }, [screenModalIsBuiltin, tagDependentSlots]);

  const actionOptions = useMemo(
    () => actions.filter((action) => action.enabled).map((action) => ({ value: action.id, label: action.title })),
    [actions],
  );

  const setScreenViewActionIds = useCallback(
    (ids: string[]) => setScreenForm((prev) => ({ ...prev, viewActionIds: ids })),
    [],
  );

  const setScreenCardActionIds = useCallback(
    (ids: string[]) => setScreenForm((prev) => ({ ...prev, cardActionIds: ids })),
    [],
  );

  const toggleListAction = useCallback((action: ScreenListAction) => {
    setScreenForm((prev) => {
      if (action === 'manageTags' && !screenModalIsBuiltin && !prev.hasTags) return prev;
      return {
        ...prev,
        listActions: prev.listActions.includes(action)
          ? prev.listActions.filter((a) => a !== action)
          : [...prev.listActions, action],
      };
    });
  }, [screenModalIsBuiltin]);

  const updateFieldForm = useCallback((patch: Partial<FieldFormState>) => {
    setFieldForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.label !== undefined && prev.listLabel === prev.label) {
        next.listLabel = patch.label;
      }
      // Auto-atualiza fieldKey quando label muda (apenas durante criação, não edição)
      if (patch.label !== undefined && !fieldModal?.fieldKey && patch.fieldKey === undefined) {
        next.fieldKey = slugifyFieldKey(patch.label);
      }
      return next;
    });
  }, [fieldModal]);

  const openCreateScreen = useCallback(() => {
    setScreenForm(EMPTY_SCREEN_FORM);
    setScreenModalTab('general');
    setScreenModal({ screenKey: null });
  }, []);

  const openEditScreen = useCallback((screenKey: string) => {
    setScreenModalTab('general');
    const def = getDefinitionByKey(screenKey);
    const childLinks = Object.fromEntries(
      dynamicDefinitions
        .filter((child) => child.parentEntity === screenKey && child.parentFieldKey)
        .map((child) => [child.id, child.parentFieldKey as string]),
    );
    // Tela do sistema: título/ícone/abas são fixos, então o modal serve só aos registros filhos.
    // (uma tela fixa PODE ter definição gravada, por causa dos campos adicionais — por isso a
    // checagem é pela lista de builtins, não pela ausência de definição)
    if (BUILTIN_SCREENS.some((b) => b.key === screenKey) || !def) {
      setScreenForm({
        ...EMPTY_SCREEN_FORM,
        childLinks,
        listActions: resolveListActions(screenKey, def?.listActions),
        viewActionIds: def?.viewActionIds ?? [],
        cardActionIds: def?.cardActionIds ?? [],
      });
      setScreenModal({ screenKey });
      return;
    }
    setScreenForm({
      titleSingular: def.titleSingular,
      titlePlural: def.titlePlural,
      icon: def.icon,
      hasNotes: def.hasNotes,
      hasDocuments: def.hasDocuments,
      hasTags: def.hasTags,
      tagCollection: def.tagCollection ?? '',
      listActions: def.hasTags ? def.listActions : def.listActions.filter((a) => !tagDependentSlots.has(a)),
      viewActionIds: def.viewActionIds,
      cardActionIds: def.cardActionIds,
      childLinks,
      enabled: def.enabled,
      titleFieldKey: def.titleFieldKey,
      subtitleFieldKey: def.subtitleFieldKey ?? '',
    });
    setScreenModal({ screenKey });
  }, [getDefinitionByKey, dynamicDefinitions, tagDependentSlots]);

  const closeScreenModal = useCallback(() => setScreenModal(null), []);

  // Telas que já têm um campo apontando para esta — só elas podem virar filhas.
  const childCandidates = useMemo<ChildCandidate[]>(() => {
    const current = screenModal?.screenKey;
    if (!current) return [];
    // Uma relação aponta para a COLEÇÃO, não para a chave da tela: numa tela ligada, comparar com a
    // chave não encontraria filho nenhum.
    const currentDef = getDefinitionByKey(current);
    const currentCollection = currentDef ? screenDataCollection(currentDef) : current;
    return dynamicDefinitions
      .filter((def) => def.id !== current)
      .map((def) => ({
        key: def.id,
        label: def.titlePlural,
        fieldOptions: def.fields
          .filter((field) => field.type === 'reference' && field.refEntity === currentCollection)
          .map((field) => ({ value: field.key, label: field.label })),
      }))
      .filter((candidate) => candidate.fieldOptions.length > 0);
  }, [dynamicDefinitions, screenModal, getDefinitionByKey]);

  const toggleChildScreen = useCallback((childKey: string) => {
    setScreenForm((prev) => {
      const next = { ...prev.childLinks };
      if (next[childKey] !== undefined) {
        delete next[childKey];
      } else {
        const options = childCandidates.find((c) => c.key === childKey)?.fieldOptions ?? [];
        next[childKey] = options.length === 1 ? options[0].value : '';
      }
      return { ...prev, childLinks: next };
    });
  }, [childCandidates]);

  const setChildLinkField = useCallback((childKey: string, fieldKey: string) => {
    setScreenForm((prev) => ({ ...prev, childLinks: { ...prev.childLinks, [childKey]: fieldKey } }));
  }, []);

  const iconOptions = useMemo<SearchSelectOption[]>(
    () => getScreenIconOptions().map((option) => ({
      value: option.key,
      label: label(option.label),
      icon: option.Icon,
    })),
    [label],
  );

  /**
   * Os campos que a tela REALMENTE renderiza — os declarados em código, os da extensão e os do
   * escritório, já mesclados. Ler `def.fields` deixava de fora tudo que não está materializado no
   * documento, e numa tela ligada a outra coleção nem sempre é o documento que descreve o esquema.
   */
  const modalScreenFields = useMemo<FieldDefinition[]>(() => {
    const key = screenModal?.screenKey;
    if (!key) return [];
    return resolvedFieldsByScreen[key] ?? getDefinitionByKey(key)?.fields ?? [];
  }, [screenModal, resolvedFieldsByScreen, getDefinitionByKey]);

  const titleFieldOptions = useMemo<SearchSelectOption[]>(
    () => modalScreenFields
      .filter((f) => f.type === 'text' && f.required)
      .map((f) => ({ value: f.key, label: f.label })),
    [modalScreenFields],
  );

  /**
   * O subtítulo aceita qualquer campo que caiba numa LINHA ao lado do título — inclusive seleção e
   * relação, que o cartão e o cabeçalho resolvem para o rótulo, e não para o id ou a chave. Ficam de
   * fora só o texto longo e o markdown, que não cabem, e o Sim/Não, que nada informa ali.
   */
  const subtitleFieldOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: t('screen.subtitle-field.placeholder') },
      ...modalScreenFields
        .filter((f) => f.type !== 'textarea' && f.type !== 'markdown' && f.type !== 'checkbox')
        .map((f) => ({ value: f.key, label: f.label })),
    ],
    [modalScreenFields, t],
  );

  // O rótulo é resolvido AQUI, e não na View: a caixa lista ações nativas (referência) e de
  // extensão (texto do autor) lado a lado, e um caminho só de rótulo é o que impede a referência de
  // vazar para a tela.
  const listActionOptions = useMemo(
    () => listActionOptionsFrom(recordActions).map((option) => ({ ...option, label: label(option.label) })),
    [recordActions, label],
  );

  const modalListActionOptions = useMemo(() => {
    if (!screenModalIsBuiltin) return listActionOptions;
    const supported = supportedListActions(screenModal?.screenKey ?? '');
    return listActionOptions.filter((option) => supported.includes(option.key));
  }, [screenModalIsBuiltin, screenModal, listActionOptions]);

  // Nas telas do sistema não há "Geral" (título, ícone e abas são fixos), e "Registros filhos"
  // só existe quando alguma tela aponta para esta.
  const screenModalTabs = useMemo<{ key: ScreenModalTab; label: string }[]>(() => [
    ...(screenModalIsBuiltin ? [] : [{ key: 'general' as const, label: t('screen.tab.general') }]),
    { key: 'list' as const, label: t('screen.tab.list') },
    { key: 'actions' as const, label: t('screen.tab.actions') },
    ...(!!screenModal?.screenKey && childCandidates.length > 0
      ? [{ key: 'children' as const, label: t('screen.tab.children') }]
      : []),
  ], [screenModalIsBuiltin, screenModal, childCandidates, t]);

  const activeScreenModalTab = useMemo<ScreenModalTab>(
    () => (screenModalTabs.some((tab) => tab.key === screenModalTab)
      ? screenModalTab
      : screenModalTabs[0].key),
    [screenModalTabs, screenModalTab],
  );

  /** O vínculo é configurado no pai, mas o dado mora na definição da tela FILHA. */
  const persistChildLinks = useCallback(async (parentKey: string) => {
    for (const candidate of childCandidates) {
      const childDef = getDefinitionByKey(candidate.key);
      if (!childDef) continue;
      const linkField = screenForm.childLinks[candidate.key];
      const isChildOfThis = childDef.parentEntity === parentKey;
      if (linkField) {
        if (!isChildOfThis || childDef.parentFieldKey !== linkField) {
          await saveDefinition(childDef.id, {
            ...toSaveInput(childDef),
            parentEntity: parentKey,
            parentFieldKey: linkField,
          });
        }
      } else if (isChildOfThis) {
        await saveDefinition(childDef.id, {
          ...toSaveInput(childDef),
          parentEntity: null,
          parentFieldKey: null,
        });
      }
    }
  }, [childCandidates, getDefinitionByKey, saveDefinition, screenForm.childLinks]);

  const handleSaveScreen = useCallback(async () => {
    const isBuiltinParent = !!screenModal?.screenKey
      && BUILTIN_SCREENS.some((b) => b.key === screenModal.screenKey);
    if (!isBuiltinParent && (!screenForm.titleSingular.trim() || !screenForm.titlePlural.trim())) {
      setScreenModalTab('general');
      notify(t('screen.error.titles-required'), 'error');
      return;
    }
    const childMissingField = Object.entries(screenForm.childLinks).find(([, field]) => !field);
    if (childMissingField) {
      const label = childCandidates.find((c) => c.key === childMissingField[0])?.label ?? 'registro filho';
      setScreenModalTab('children');
      notify(t('screen.error.link-field-required', { label }), 'error');
      return;
    }
    setSavingScreen(true);
    try {
      // Tela do sistema: nada a salvar nela própria, só os vínculos dos filhos.
      if (screenModal?.screenKey && BUILTIN_SCREENS.some((b) => b.key === screenModal.screenKey)) {
        const builtinDef = getDefinitionByKey(screenModal.screenKey);
        await saveDefinition(screenModal.screenKey, {
          ...(builtinDef ? toSaveInput(builtinDef) : builtinSaveInput(screenModal.screenKey)),
          listActions: screenForm.listActions,
          viewActionIds: screenForm.viewActionIds,
          cardActionIds: screenForm.cardActionIds,
        });
        await persistChildLinks(screenModal.screenKey);
        notify('Registros filhos atualizados!', 'success');
        setScreenModal(null);
        return;
      }
      // Etiquetas ligadas EXIGEM coleção: é ela que sobrevive à exclusão da tela e o que duas telas
      // apontam em comum para compartilhá-las. Na criação, o nome sai da chave que a tela vai
      // receber — a mesma derivação do ramo de baixo.
      const screenKeyForTags = screenModal?.screenKey
        ?? ensureUniqueKey(slugifyFieldKey(screenForm.titlePlural), new Set([
          ...definitions.map((def) => def.id),
          ...BUILTIN_SCREENS.map((b) => b.key),
          ...RESERVED_COLLECTIONS,
        ]));
      const tagCollection = screenForm.hasTags
        ? (screenForm.tagCollection.trim() || derivedTagCollection(screenKeyForTags))
        : (screenForm.tagCollection.trim() || null);
      const isNewTagList = !!tagCollection && !schemaContext.tagLists.has(tagCollection);
      if (isNewTagList) {
        const issue = tagListIdIssue(tagCollection as string, schemaContext);
        if (issue) {
          notify(label(issue.message, issue.messageParams), 'error');
          return;
        }
      }

      if (isNewTagList) {
        await declareTagList(tagCollection as string, `Etiquetas: ${screenForm.titlePlural.trim()}`);
      }

      if (screenModal?.screenKey) {
        const def = getDefinitionByKey(screenModal.screenKey);
        if (!def) return;
        const titleFieldKey = def.origin === 'builtin' ? '' : (screenForm.titleFieldKey || def.titleFieldKey);
        const subtitleFieldKey = def.origin === 'builtin' ? null : (screenForm.subtitleFieldKey || null);
        await saveDefinition(def.id, {
          ...toSaveInput(def),
          titleSingular: screenForm.titleSingular.trim(),
          titlePlural: screenForm.titlePlural.trim(),
          icon: screenForm.icon,
          hasNotes: screenForm.hasNotes,
          hasDocuments: screenForm.hasDocuments,
          hasTags: screenForm.hasTags,
          tagCollection,
          listActions: screenForm.listActions,
          viewActionIds: screenForm.viewActionIds,
          cardActionIds: screenForm.cardActionIds,
          enabled: screenForm.enabled,
          titleFieldKey,
          subtitleFieldKey,
        });

        await persistChildLinks(def.id);

        notify('Tela atualizada com sucesso!', 'success');
      } else {
        // A chave da tela É o nome da coleção no Firestore: não pode colidir com outra tela nem
        // com uma coleção de sistema.
        const existingKeys = new Set([
          ...definitions.map((def) => def.id),
          ...BUILTIN_SCREENS.map((b) => b.key),
          ...RESERVED_COLLECTIONS,
        ]);
        const screenKey = ensureUniqueKey(slugifyFieldKey(screenForm.titlePlural), existingKeys);
        const keyIssue = screenIdIssue(screenKey, schemaContext);
        if (keyIssue) {
          notify(label(keyIssue.message, keyIssue.messageParams), 'error');
          return;
        }
        const maxOrder = dynamicDefinitions.reduce((max, def) => Math.max(max, def.sidebarOrder), -1);
        const nameField: FieldDefinition = {
          key: 'nome',
          label: t('field.default-name'),
          type: 'text',
          required: true,
          order: 0,
          origin: 'design',
          showInList: true,
          filterable: true,
        };
        await saveDefinition(screenKey, {
          origin: 'design',
          titleSingular: screenForm.titleSingular.trim(),
          titlePlural: screenForm.titlePlural.trim(),
          icon: screenForm.icon,
          fields: [nameField],
          titleFieldKey: nameField.key,
          hasNotes: screenForm.hasNotes,
          hasDocuments: screenForm.hasDocuments,
          hasTags: screenForm.hasTags,
          tagCollection,
          listActions: screenForm.listActions,
          viewActionIds: screenForm.viewActionIds,
          cardActionIds: screenForm.cardActionIds,
          parentEntity: null,
          parentFieldKey: null,
          sidebarOrder: maxOrder + 1,
          enabled: true,
        });
        notify(t('screen.created'), 'success');
        setSelectedKeyState(screenKey);
      }
      setScreenModal(null);
    } catch (err) {
      console.error('[ScreenBuilder handleSaveScreen]', err);
      notify('Erro ao salvar a tela.', 'error');
    } finally {
      setSavingScreen(false);
    }
  }, [screenForm, screenModal, getDefinitionByKey, saveDefinition, definitions, dynamicDefinitions, childCandidates, persistChildLinks, notify, schemaContext, declareTagList, t, label]);

  const toggleScreenEnabled = useCallback(async (screenKey: string) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    try {
      await saveDefinition(def.id, { ...toSaveInput(def), enabled: !def.enabled });
      notify(def.enabled ? 'Tela desativada.' : 'Tela ativada.', 'success');
    } catch {
      notify('Erro ao alterar o estado da tela.', 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify]);

  const moveScreen = useCallback(async (screenKey: string, direction: -1 | 1) => {
    const ordered = [...dynamicDefinitions];
    const index = ordered.findIndex((def) => def.id === screenKey);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const [moved] = ordered.splice(index, 1);
    ordered.splice(targetIndex, 0, moved);
    try {
      await Promise.all(
        ordered
          .map((def, idx) => ({ def, idx }))
          .filter(({ def, idx }) => def.sidebarOrder !== idx)
          .map(({ def, idx }) => saveDefinition(def.id, { ...toSaveInput(def), sidebarOrder: idx })),
      );
    } catch {
      notify('Erro ao reordenar as telas.', 'error');
    }
  }, [dynamicDefinitions, saveDefinition, notify]);

  const requestDeleteScreen = useCallback((screenKey: string) => {
    if (isManagedScreen(screenKey)) {
      notify(t('screen.managed.cannot-delete'), 'info');
      return;
    }
    const def = getDefinitionByKey(screenKey);
    if (def) setDeleteScreenTarget(def);
  }, [getDefinitionByKey, isManagedScreen, notify, t]);

  const cancelDeleteScreen = useCallback(() => setDeleteScreenTarget(null), []);

  const confirmDeleteScreen = useCallback(async () => {
    if (!deleteScreenTarget) return;
    setDeletingScreen(true);
    try {
      await deleteDefinition(deleteScreenTarget.id);
      notify(t('screen.deleted'), 'success');
      setDeleteScreenTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao excluir a tela.', 'error');
    } finally {
      setDeletingScreen(false);
    }
  }, [deleteScreenTarget, deleteDefinition, notify, t]);

  const openCreateField = useCallback((screenKey: string) => {
    setFieldForm({ ...EMPTY_FIELD_FORM, optionColorInput: defaultTagColor });
    setFieldModalTab('general');
    setFieldModalIsNative(false);
    setFieldModal({ screenKey, fieldKey: null });
  }, [defaultTagColor]);

  const openEditField = useCallback((screenKey: string, fieldKey: string) => {
    setFieldModalTab('general');
    const field = resolvedField(screenKey, fieldKey);
    if (!field) return;
    setFieldModalIsNative(field.origin === 'builtin');
    setFieldForm({
      label: field.label,
      fieldKey: field.key,
      type: field.type,
      required: field.required,
      section: field.section ?? '',
      placeholder: field.placeholder ?? '',
      multi: field.multi ?? false,
      mask: field.mask ?? '',
      refEntity: field.refEntity ?? '',
      optionsAllowUserAdd: field.optionsAllowUserAdd ?? false,
      lookupCollection: field.lookupCollection ?? '',
      optionsColored: field.optionsColored ?? false,
      staticOptions: (field.options ?? []).map((o) => ({ label: o.label, color: o.color })),
      optionInput: '',
      optionColorInput: defaultTagColor,
      showInList: field.showInList ?? false,
      listLabel: field.listLabel ?? '',
      filterable: field.filterable ?? false,
      ...fieldRulesToForm(field.rules),
      ...fieldLogicToForm(field.logic),
      ...fieldAggregationToForm(field.aggregation),
    });
    setFieldModal({ screenKey, fieldKey });
  }, [defaultTagColor, resolvedField]);

  const closeFieldModal = useCallback(() => setFieldModal(null), []);

  const typeOptions = useMemo<SearchSelectOption[]>(
    () => (Object.keys(FIELD_TYPE_KEYS) as CustomFieldType[]).map((type) => ({
      value: type,
      label: t(FIELD_TYPE_KEYS[type]),
    })),
    [t],
  );

  const maskOptions = useMemo<SearchSelectOption[]>(
    () => buildMaskPresetOptions(label, fieldRulePresets, fieldForm.type),
    [fieldRulePresets, fieldForm.type, label],
  );

  const formatPresetOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: t('core.automation/parameter.preset.none') },
      ...buildFormatPresetOptions(label, fieldRulePresets, fieldForm.type),
    ],
    [fieldRulePresets, fieldForm.type, label, t],
  );

  const validateCheckOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: t('core.automation/parameter.preset.none') },
      ...buildValidatePresetOptions(label, fieldRulePresets, fieldForm.type),
    ],
    [fieldRulePresets, fieldForm.type, label, t],
  );

  const fieldSupportsRules = useMemo(
    () => RULES_SUPPORTED_FIELD_TYPES.includes(fieldForm.type),
    [fieldForm.type],
  );

  /**
   * As telas que um campo de referência pode apontar. O valor é a COLEÇÃO, nunca a chave da tela: é
   * `refEntity: 'contracts'` que o formulário resolve em runtime, e é assim que uma relação sobrevive
   * a uma entidade mudando de dono — a coleção tem nome global, a chave varia por escritório.
   *
   * Oferecer a chave deixava o campo já gravado sem a própria opção: a tela de Contratos entrava
   * como `contratos` enquanto o campo guardava `contracts`, e o seletor acusava "Registro não
   * encontrado (contracts)" com tudo funcionando por baixo.
   *
   * Duas telas podem descrever a MESMA coleção (a de extensão e o documento de baseline que só
   * carrega a permissão): entra uma opção só, com o rótulo de quem tem título.
   */
  const refEntityOptions = useMemo<SearchSelectOption[]>(() => {
    const currentCollection = fieldModal
      ? screenDataCollection(getDefinitionByKey(fieldModal.screenKey) ?? { id: fieldModal.screenKey, dataCollection: null })
      : null;

    const byCollection = new Map<string, SearchSelectOption>();
    for (const def of dynamicScreens) {
      const collection = screenDataCollection(def);
      if (collection === currentCollection) continue;
      const existing = byCollection.get(collection);
      if (existing && existing.label) continue;
      byCollection.set(collection, { value: collection, label: def.titlePlural || collection });
    }

    return [
      ...BUILTIN_SCREENS.map((b) => ({ value: b.key, label: label(b.label) })),
      ...byCollection.values(),
    ];
  }, [dynamicScreens, fieldModal, getDefinitionByKey, label]);

  const lookupOptions = useMemo<SearchSelectOption[]>(
    () => availableLookups.map((lookup) => ({ value: lookup.collection, label: `${lookup.label} (${lookup.collection})` })),
    [availableLookups],
  );

  const tagListOptions = useMemo<SearchSelectOption[]>(
    () => availableTagLists.map((tagList) => ({
      value: tagList.collection,
      // O rótulo da lista é uma REFERÊNCIA; ela vai como parâmetro, não concatenada — dentro de uma
      // frase ela não resolveria. Os parâmetros dela sobem junto, para a composição interpolar.
      label: t('tag-list.option', {
        ...tagList.labelParams,
        name: tagList.label,
        collection: tagList.collection,
      }),
    })),
    [availableTagLists, t],
  );

  const suggestedTagCollection = useMemo(
    () => derivedTagCollection(screenModal?.screenKey || slugifyFieldKey(screenForm.titlePlural.trim())),
    [screenModal, screenForm.titlePlural],
  );

  const suggestedLookupCollection = useMemo(() => {
    if (!fieldModal) return '';
    const key = fieldModal.fieldKey || fieldForm.fieldKey.trim() || slugifyFieldKey(fieldForm.label.trim());
    return key ? derivedLookupCollection(fieldModal.screenKey, key) : '';
  }, [fieldModal, fieldForm.fieldKey, fieldForm.label]);

  // Só faz sentido agregar de uma tela que aponte de volta para esta: é o vínculo pai/filho que
  // define quais registros pertencem ao agregado.
  const aggregationChildScreens = useMemo(
    () => {
      const key = fieldModal?.screenKey;
      if (!key) return [];
      const owner = getDefinitionByKey(key);
      const collection = owner ? screenDataCollection(owner) : key;
      return dynamicScreens.filter(
        (def) => def.id !== key && def.fields.some((f) => f.type === 'reference' && f.refEntity === collection),
      );
    },
    [dynamicScreens, fieldModal, getDefinitionByKey],
  );

  const aggregationFromOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: t('field.aggregation.none') },
      ...aggregationChildScreens.map((def) => ({ value: def.id, label: def.titlePlural })),
    ],
    [aggregationChildScreens, t],
  );

  const aggregationViaOptions = useMemo<SearchSelectOption[]>(() => {
    const child = aggregationChildScreens.find((def) => def.id === fieldForm.aggregationFrom);
    return (child?.fields ?? [])
      .filter((f) => f.type === 'reference' && f.refEntity === fieldModal?.screenKey)
      .map((f) => ({ value: f.key, label: f.label }));
  }, [aggregationChildScreens, fieldForm.aggregationFrom, fieldModal]);

  const aggregationFieldOptions = useMemo<SearchSelectOption[]>(() => {
    const child = aggregationChildScreens.find((def) => def.id === fieldForm.aggregationFrom);
    return (child?.fields ?? [])
      .filter((f) => f.type === 'number' || f.type === 'currency')
      .map((f) => ({ value: f.key, label: f.label }));
  }, [aggregationChildScreens, fieldForm.aggregationFrom]);

  const lookupProviderOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: t('core.automation/parameter.preset.none') },
      ...externalLookupProviders.map((provider) => ({ value: provider.value, label: provider.label })),
    ],
    [externalLookupProviders, t],
  );

  /**
   * O provedor escolhido, com host e chaves de saída. É o que torna a escolha revisável: a URL de
   * destino é dado declarado, e o autor precisa ver a quem o valor digitado vai ser enviado.
   */
  const selectedLookupProvider = useMemo(
    () => externalLookupProviders.find((provider) => provider.value === fieldForm.lookupProvider) ?? null,
    [externalLookupProviders, fieldForm.lookupProvider],
  );

  const aggregationOpOptions = useMemo<SearchSelectOption[]>(
    () => Object.entries(AGGREGATION_OP_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  // O filtro é avaliado sobre o FILHO: as sugestões são os campos da tela filha, não desta.
  const aggregationFilterVariables = useMemo<WorkflowVariable[]>(() => {
    const child = aggregationChildScreens.find((def) => def.id === fieldForm.aggregationFrom);
    return (child?.fields ?? []).map((f) => ({ name: f.key, definedBy: f.label }));
  }, [aggregationChildScreens, fieldForm.aggregationFrom]);

  const addStaticOption = useCallback(() => {
    setFieldForm((prev) => {
      const value = prev.optionInput.trim();
      if (!value || prev.staticOptions.some((o) => o.label === value)) return { ...prev, optionInput: '' };
      const newOption: FieldOptionFormItem = {
        label: value,
        color: prev.optionsColored ? prev.optionColorInput : undefined,
      };
      return { ...prev, staticOptions: [...prev.staticOptions, newOption], optionInput: '' };
    });
  }, []);

  const removeStaticOption = useCallback((label: string) => {
    setFieldForm((prev) => ({ ...prev, staticOptions: prev.staticOptions.filter((o) => o.label !== label) }));
  }, []);

  const fieldModalIsTitleField = useMemo(
    () => !!fieldModal?.fieldKey && isTitleField(fieldModal.screenKey, fieldModal.fieldKey),
    [fieldModal, isTitleField],
  );

  const fieldExpressionVariables = useMemo<WorkflowVariable[]>(() => {
    if (!fieldModal) return [];
    const seen = new Set<string>();
    const vars: WorkflowVariable[] = [{ name: 'value', definedBy: t('field.expression.own-value') }];
    seen.add('value');
    const push = (name: string, definedBy: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      vars.push({ name, definedBy });
    };
    getEntityByCollection(fieldModal.screenKey)?.fields.forEach((f) => push(f.key, f.label));

    const screenFields = getDefinitionByKey(fieldModal.screenKey)?.fields ?? [];
    screenFields.forEach((f) => push(f.key, f.label));

    // Campo de referência é navegável nos slots front-only (`produto.preco`): sugere os campos da
    // tela apontada, já prefixados.
    for (const field of screenFields) {
      if (field.type !== 'reference' || !field.refEntity) continue;
      const target = getDefinitionByKey(field.refEntity);
      const targetFields = target?.fields ?? getEntityByCollection(field.refEntity)?.fields ?? [];
      push(`${field.key}.id`, `${field.label} — identificador`);
      targetFields.forEach((t) => push(`${field.key}.${t.key}`, `${field.label} — ${t.label}`));
    }

    return vars;
  }, [fieldModal, getDefinitionByKey, t]);

  const handleSaveField = useCallback(async () => {
    if (!fieldModal) return;
    // Abre a aba dona do campo recusado: com o formulário em abas, avisar sem trazer o
    // usuário até o campo deixaria o erro invisível.
    const reject = (tab: FieldModalTab, message: string) => {
      setFieldModalTab(tab);
      notify(message, 'error');
    };
    const fieldLabel = fieldForm.label.trim();
    if (!fieldLabel) {
      reject('general', 'Informe o nome do campo.');
      return;
    }


    // Validação do fieldKey (apenas em criação, não edição)
    if (!fieldModal.fieldKey) {
      const fieldKeyToValidate = fieldForm.fieldKey.trim() || slugifyFieldKey(fieldLabel);
      const validationError = validateFieldKey(fieldKeyToValidate);
      if (validationError) {
        reject('general', label(validationError.message, validationError.messageParams));
        return;
      }
    }

    const fieldKeyForLookup = fieldModal.fieldKey || fieldForm.fieldKey.trim() || slugifyFieldKey(fieldLabel);

    // Uma seleção cujas opções vêm de uma LISTA não precisa de opções declaradas no campo — é o
    // caso de vários campos do kernel. A checagem vale só para quem tira as opções do próprio campo.
    const lookupCollection = fieldForm.type === 'select' && fieldForm.optionsAllowUserAdd
      ? (fieldForm.lookupCollection.trim() || derivedLookupCollection(fieldModal.screenKey, fieldKeyForLookup))
      : (fieldForm.lookupCollection.trim() || null);
    if (
      fieldForm.type === 'select'
      && !lookupCollection
      && fieldForm.staticOptions.length === 0
      && !fieldForm.optionsAllowUserAdd
    ) {
      reject('general', t('field.error.options-required'));
      return;
    }
    // Só um nome NOVO passa pela validação. Uma lista que já existe é escolha legítima — inclusive
    // as do kernel, que estão entre as coleções reservadas justamente por já terem dono.
    const isNewLookup = !!lookupCollection && !schemaContext.lookups.has(lookupCollection);
    if (isNewLookup) {
      const issue = lookupIdIssue(lookupCollection as string, schemaContext);
      if (issue) {
        reject('general', label(issue.message, issue.messageParams));
        return;
      }
    }
    if (fieldForm.type === 'masked' && !fieldForm.mask) {
      reject('general', t('field.error.mask-required'));
      return;
    }
    if (fieldForm.type === 'reference' && !fieldForm.refEntity) {
      reject('general', 'Escolha a tela vinculada ao campo.');
      return;
    }
    if (isInvalidRegex(fieldForm.ruleValidatePattern)) {
      reject('advanced', t('field.error.validate-regex'));
      return;
    }
    if (isInvalidRegex(fieldForm.ruleFormatPattern)) {
      reject('advanced', t('field.error.format-regex'));
      return;
    }
    if (fieldForm.logicCompute.trim()) {
      const computeKey = fieldModal.fieldKey ?? (fieldForm.fieldKey.trim() || slugifyFieldKey(fieldLabel));
      const screenFields = getDefinitionByKey(fieldModal.screenKey)?.fields ?? [];
      if (findComputeCycle(screenFields, computeKey, fieldForm.logicCompute.trim())) {
        reject('advanced', t('field.error.compute-cycle'));
        return;
      }
    }
    const aggregation = buildFieldAggregation(fieldForm);
    if (aggregation) {
      if (aggregation.op !== 'count' && !aggregation.field) {
        reject('advanced', t('field.error.aggregation-field'));
        return;
      }
      if (aggregationCreatesCycle(schemaContext, fieldModal.screenKey, aggregation.from)) {
        reject('advanced', t('field.error.aggregation-cycle'));
        return;
      }
    }
    const rules = buildFieldRules(fieldForm);
    const logic = buildFieldLogic(fieldForm);
    setSavingField(true);
    try {
      const existing = getDefinitionByKey(fieldModal.screenKey);
      const baseInput = existing ? toSaveInput(existing) : builtinSaveInput(fieldModal.screenKey);
      const fields = sortFieldsByOrder(baseInput.fields);
      let nextFields: FieldDefinition[];
      if (fieldModal.fieldKey) {
        // Um campo do kernel só entra em `fields[]` quando o usuário o ajusta pela primeira vez:
        // a declaração inteira é materializada aqui, e a partir daí o documento é a verdade.
        const editedKey = fieldModal.fieldKey;
        const base = fields.some((f) => f.key === editedKey)
          ? fields
          : [...fields, resolvedField(fieldModal.screenKey, editedKey)].filter(
              (f): f is FieldDefinition => f !== undefined,
            );
        nextFields = base.map((f) => {
          if (f.key !== editedKey) return f;
          return {
            ...f,
            label: fieldLabel,
            required: fieldModalIsTitleField ? true : fieldForm.required,
            section: fieldForm.section.trim() || null,
            placeholder: fieldForm.placeholder.trim() || null,
            multi: fieldForm.multi,
            mask: fieldForm.type === 'masked' && fieldForm.mask !== '' ? fieldForm.mask : null,
            refEntity: fieldForm.type === 'reference' ? fieldForm.refEntity : null,
            optionsAllowUserAdd: fieldForm.optionsAllowUserAdd,
            lookupCollection,
            optionsColored: fieldForm.type === 'select' ? fieldForm.optionsColored : false,
            options: fieldForm.type === 'select'
              ? fieldForm.staticOptions.map((o) => ({ key: o.label, label: o.label, isStatic: true, color: o.color }))
              : [],
            showInList: fieldForm.showInList,
            listLabel: fieldForm.showInList ? (fieldForm.listLabel.trim() || null) : null,
            filterable: fieldForm.filterable,
            rules,
            logic,
            aggregation,
          };
        });
      } else {
        const existingKeys = new Set(fields.map((f) => f.key));
        // Usa o fieldKey do form (preenchido automaticamente ou editado pelo usuário)
        const baseKey = fieldForm.fieldKey.trim() || slugifyFieldKey(fieldLabel);
        const key = ensureUniqueKey(baseKey, existingKeys);
        // A última posição é a da lista RESOLVIDA (fixos do código + adicionais do tenant), não a de
        // `fields[]`: numa tela do kernel o documento começa vazio, e contar só ele punha o campo
        // novo na frente de todos os declarados em código.
        const visible = resolvedFieldsByScreen[fieldModal.screenKey] ?? [];
        const maxOrder = [...fields, ...visible].reduce((max, f) => Math.max(max, f.order), -1);
        nextFields = [...fields, {
          key,
          label: fieldLabel,
          type: fieldForm.type,
          required: fieldForm.required,
          order: maxOrder + 1,
          origin: 'design',
          section: fieldForm.section.trim() || null,
          placeholder: fieldForm.placeholder.trim() || null,
          multi: fieldForm.multi,
          mask: fieldForm.type === 'masked' && fieldForm.mask !== '' ? fieldForm.mask : null,
          refEntity: fieldForm.type === 'reference' ? fieldForm.refEntity : null,
          optionsAllowUserAdd: fieldForm.optionsAllowUserAdd,
          lookupCollection,
          optionsColored: fieldForm.type === 'select' ? fieldForm.optionsColored : false,
          options: fieldForm.type === 'select'
            ? fieldForm.staticOptions.map((o) => ({ key: o.label, label: o.label, isStatic: true, color: o.color }))
            : [],
          showInList: fieldForm.showInList,
          listLabel: fieldForm.showInList ? (fieldForm.listLabel.trim() || null) : null,
          filterable: fieldForm.filterable,
          rules,
          aggregation,
          logic,
        }];
      }
      // A declaração vem ANTES do campo: é ela que as Security Rules consultam para autorizar a
      // primeira opção que o usuário cadastrar na coleção.
      if (isNewLookup) {
        await declareLookup(lookupCollection as string, fieldLabel);
      }
      await saveDefinition(fieldModal.screenKey, { ...baseInput, fields: nextFields });
      notify(fieldModal.fieldKey ? 'Campo atualizado com sucesso!' : 'Campo adicionado com sucesso!', 'success');
      setFieldModal(null);
    } catch {
      notify('Erro ao salvar o campo.', 'error');
    } finally {
      setSavingField(false);
    }
  }, [fieldModal, fieldForm, fieldModalIsTitleField, getDefinitionByKey, saveDefinition, notify, schemaContext, resolvedField, resolvedFieldsByScreen, declareLookup, t, label]);

  /**
   * Grava a ordem da lista como posições absolutas em `fields[]`. Um campo já gravado viaja como
   * está no documento, só com o `order` novo: a lista exibida vem da forma CANÔNICA do schema, que
   * não carrega tudo que a autoria guarda (`filterable`, `listLabel`) e devolve `undefined` no que
   * o documento não trazia — reordenar a partir dela apagava ajustes e o Firestore recusava a
   * gravação inteira. Um campo do kernel ainda não gravado só é materializado quando a nova posição
   * difere da declarada em código, e o que não vai ao formulário segue intocado no documento.
   */
  const applyFieldOrder = useCallback(async (screenKey: string, fields: FieldDefinition[]) => {
    const def = getDefinitionByKey(screenKey);
    const baseInput = def ? toSaveInput(def) : builtinSaveInput(screenKey);
    const storedFields = def?.fields ?? [];
    const storedByKey = new Map(storedFields.map((field) => [field.key, field]));

    const reordered = fields.flatMap((field, index) => {
      const stored = storedByKey.get(field.key);
      if (stored) return [{ ...stored, order: index }];
      return field.order === index ? [] : [{ ...field, order: index }];
    });
    const listedKeys = new Set(fields.map((field) => field.key));
    const untouched = storedFields.filter((field) => !listedKeys.has(field.key));

    try {
      await saveDefinition(screenKey, { ...baseInput, fields: [...reordered, ...untouched] });
    } catch {
      notify('Erro ao reordenar os campos.', 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify]);

  const visibleFieldsOf = useCallback(
    (screenKey: string): FieldDefinition[] => resolvedFieldsByScreen[screenKey] ?? [],
    [resolvedFieldsByScreen],
  );

  const moveField = useCallback(async (screenKey: string, fieldKey: string, direction: -1 | 1) => {
    const fields = [...visibleFieldsOf(screenKey)];
    const index = fields.findIndex((f) => f.key === fieldKey);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) return;
    const [moved] = fields.splice(index, 1);
    fields.splice(targetIndex, 0, moved);
    await applyFieldOrder(screenKey, fields);
  }, [visibleFieldsOf, applyFieldOrder]);

  const handleFieldDragStart = useCallback((fieldKey: string) => {
    setDraggedFieldKey(fieldKey);
  }, []);

  const handleFieldDragOver = useCallback((fieldKey: string) => {
    setDragOverFieldKey((prev) => (prev === fieldKey ? prev : fieldKey));
  }, []);

  const handleFieldDragEnd = useCallback(() => {
    setDraggedFieldKey(null);
    setDragOverFieldKey(null);
  }, []);

  const handleFieldDrop = useCallback(async (screenKey: string, targetFieldKey: string) => {
    const sourceKey = draggedFieldKey;
    setDraggedFieldKey(null);
    setDragOverFieldKey(null);
    if (!sourceKey || sourceKey === targetFieldKey) return;
    const fields = [...visibleFieldsOf(screenKey)];
    const fromIndex = fields.findIndex((f) => f.key === sourceKey);
    const toIndex = fields.findIndex((f) => f.key === targetFieldKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, moved);
    await applyFieldOrder(screenKey, fields);
  }, [draggedFieldKey, visibleFieldsOf, applyFieldOrder]);

  const requestDeleteField = useCallback((screenKey: string, fieldKey: string) => {
    if (isPluginField(screenKey, fieldKey)) {
      notify(t('field.managed.cannot-delete'), 'info');
      return;
    }
    const def = getDefinitionByKey(screenKey);
    const field = def?.fields.find((f) => f.key === fieldKey);
    if (field) setDeleteFieldTarget({ screenKey, field });
  }, [getDefinitionByKey, isPluginField, notify, t]);

  /** Um campo do kernel só está "ajustado" depois de materializado no documento da tela. */
  const hasNativeOverride = useCallback(
    (screenKey: string, fieldKey: string) =>
      (getDefinitionByKey(screenKey)?.fields ?? []).some(
        (field) => field.key === fieldKey && field.origin === 'builtin',
      ),
    [getDefinitionByKey],
  );

  /** Restaurar é remover a entrada materializada: a declaração de código volta a valer. */
  const restoreNativeField = useCallback(async (screenKey: string, fieldKey: string) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    const rest = def.fields.filter(
      (field) => !(field.key === fieldKey && field.origin === 'builtin'),
    );
    if (rest.length === def.fields.length) return;
    try {
      await saveDefinition(screenKey, { ...toSaveInput(def), fields: rest });
      notify(t('field.restored'), 'success');
    } catch {
      notify('Erro ao restaurar o campo.', 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify, t]);

  const cancelDeleteField = useCallback(() => setDeleteFieldTarget(null), []);

  const confirmDeleteField = useCallback(async () => {
    if (!deleteFieldTarget) return;
    const def = getDefinitionByKey(deleteFieldTarget.screenKey);
    if (!def) return;
    setDeletingField(true);
    try {
      const nextFields = def.fields.filter((f) => f.key !== deleteFieldTarget.field.key);
      await saveDefinition(def.id, { ...toSaveInput(def), fields: nextFields });
      notify(t('field.deleted'), 'success');
      setDeleteFieldTarget(null);
    } catch {
      notify('Erro ao excluir o campo.', 'error');
    } finally {
      setDeletingField(false);
    }
  }, [deleteFieldTarget, getDefinitionByKey, saveDefinition, notify, t]);

  return {
    isAdmin,
    isLoading,
    dynamicDefinitions,
    fieldsByScreen,
    builtinRows,
    dynamicListEntries,
    builtinListEntries,
    selectedKey,
    selectScreen,
    selectedScreen,
    fieldTypeLabel,
    isTitleField,
    isNativeField,
    isManagedScreen,
    isPluginField,
    managedScreenOwner,
    hasNativeOverride,
    restoreNativeField,
    screenModalOpen: screenModal !== null,
    screenModalIsEdit: !!screenModal?.screenKey,
    screenModalIsBuiltin,
    modalListActionOptions,
    actionOptions,
    setScreenViewActionIds,
    setScreenCardActionIds,
    screenModalTabs,
    screenModalTab: activeScreenModalTab,
    setScreenModalTab,
    screenModalTitle: screenModalIsBuiltin
      ? t('screen.modal.builtin', {
        name: label(BUILTIN_SCREENS.find((b) => b.key === screenModal?.screenKey)?.label) || t('screen.fallback'),
      })
      : t(screenModal?.screenKey ? 'screen.modal.edit' : 'screen.modal.new'),
    screenForm,
    updateScreenForm,
    toggleListAction,
    titleFieldOptions,
    subtitleFieldOptions,
    childCandidates,
    toggleChildScreen,
    setChildLinkField,
    iconOptions,
    openCreateScreen,
    openEditScreen,
    closeScreenModal,
    handleSaveScreen,
    savingScreen,
    toggleScreenEnabled,
    moveScreen,
    requestDeleteScreen,
    deleteScreenTarget,
    cancelDeleteScreen,
    confirmDeleteScreen,
    deletingScreen,
    fieldModalOpen: fieldModal !== null,
    fieldModalTab,
    setFieldModalTab,
    fieldModalIsEdit: !!fieldModal?.fieldKey,
    fieldModalIsTitleField,
    fieldModalIsNative,
    fieldForm,
    updateFieldForm,
    fieldExpressionVariables,
    typeOptions,
    maskOptions,
    formatPresetOptions,
    validateCheckOptions,
    fieldSupportsRules,
    refEntityOptions,
    lookupOptions,
    tagListOptions,
    suggestedTagCollection,
    suggestedLookupCollection,
    aggregationFromOptions,
    aggregationViaOptions,
    aggregationFieldOptions,
    aggregationOpOptions,
    aggregationFilterVariables,
    lookupProviderOptions,
    selectedLookupProvider,
    tagColors,
    addStaticOption,
    removeStaticOption,
    openCreateField,
    openEditField,
    closeFieldModal,
    handleSaveField,
    savingField,
    moveField,
    draggedFieldKey,
    dragOverFieldKey,
    handleFieldDragStart,
    handleFieldDragOver,
    handleFieldDragEnd,
    handleFieldDrop,
    requestDeleteField,
    deleteFieldTarget,
    cancelDeleteField,
    confirmDeleteField,
    deletingField,
  };
};
