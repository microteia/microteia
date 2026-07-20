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
import { resolveListActions, supportedListActions } from '../../shared/listActionCapabilities';
import type { CustomFieldMask, CustomFieldType, FieldDefinition, ScreenDefinition, ScreenListAction } from '../../../domain/entities';
import type { AggregationOp, FieldAggregation, FieldLogic, FieldRules, FormatPreset, FormatRule, ValidateCheck, ValidateRule } from '../../../domain/schema/fieldRules';
import { AGGREGATION_OP_LABELS, FORMAT_PRESET_LABELS, VALIDATE_CHECK_LABELS } from '../../../domain/schema/fieldRules';
import { extractFieldExpressionDependencies } from '../../../domain/schema/fieldExpression';
import { aggregationCreatesCycle } from '../../../domain/schema/aggregationSpec';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { getEntityByCollection } from '../../../domain/schema/entityRegistry';
import type { WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { ColorSwatchOption } from '../../components/ui/ColorSwatchPicker';

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
  listActions: ScreenListAction[];
  viewActionIds: string[];
  cardActionIds: string[];
  /** telaFilha -> campo de vínculo. A relação é sempre configurada de dentro do PAI. */
  childLinks: Record<string, string>;
  enabled: boolean;
  titleFieldKey: string;
}

export const LIST_ACTION_OPTIONS: { key: ScreenListAction; label: string }[] = [
  { key: 'copyLink', label: 'Copiar link' },
  { key: 'clone', label: 'Duplicar' },
  { key: 'manageTags', label: 'Gerenciar etiquetas' },
  { key: 'delete', label: 'Excluir' },
];

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
  screenModalOpen: boolean;
  screenModalIsEdit: boolean;
  /** Modal aberto para uma tela do sistema: só configura os registros filhos. */
  screenModalIsBuiltin: boolean;
  screenModalTitle: string;
  screenModalTabs: { key: ScreenModalTab; label: string }[];
  screenModalTab: ScreenModalTab;
  setScreenModalTab: (tab: ScreenModalTab) => void;
  modalListActionOptions: { key: ScreenListAction; label: string }[];
  actionOptions: { value: string; label: string }[];
  setScreenViewActionIds: (ids: string[]) => void;
  setScreenCardActionIds: (ids: string[]) => void;
  screenForm: ScreenFormState;
  updateScreenForm: (patch: Partial<ScreenFormState>) => void;
  toggleListAction: (action: ScreenListAction) => void;
  titleFieldOptions: SearchSelectOption[];
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
  fieldForm: FieldFormState;
  updateFieldForm: (patch: Partial<FieldFormState>) => void;
  fieldExpressionVariables: WorkflowVariable[];
  typeOptions: SearchSelectOption[];
  maskOptions: SearchSelectOption[];
  formatPresetOptions: SearchSelectOption[];
  validateCheckOptions: SearchSelectOption[];
  fieldSupportsRules: boolean;
  refEntityOptions: SearchSelectOption[];
  aggregationFromOptions: SearchSelectOption[];
  aggregationViaOptions: SearchSelectOption[];
  aggregationFieldOptions: SearchSelectOption[];
  aggregationOpOptions: SearchSelectOption[];
  aggregationFilterVariables: WorkflowVariable[];
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

const BUILTIN_SCREENS: { key: string; label: string }[] = [
  { key: 'persons', label: 'Pessoas' },
  { key: 'cases', label: 'Processos' },
  { key: 'contracts', label: 'Contratos' },
  { key: 'financials', label: 'Financeiro' },
  { key: 'deadlines', label: 'Prazos' },
];

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Texto',
  textarea: 'Texto longo',
  number: 'Número',
  currency: 'Moeda (R$)',
  date: 'Data',
  checkbox: 'Sim/Não',
  select: 'Seleção',
  masked: 'Com máscara',
  reference: 'Vínculo com registro',
  markdown: 'Markdown',
};

const MASK_LABELS: Record<CustomFieldMask, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  phone: 'Telefone',
  cep: 'CEP',
};

const EMPTY_SCREEN_FORM: ScreenFormState = {
  titleSingular: '',
  titlePlural: '',
  icon: 'apps',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  listActions: [],
  viewActionIds: [],
  cardActionIds: [],
  childLinks: {},
  enabled: true,
  titleFieldKey: '',
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
  return Object.keys(logic).length > 0 ? logic : null;
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
  'logicValidate' | 'logicDisabledWhen' | 'logicHiddenWhen' | 'logicCompute'
> => ({
  logicValidate: logic?.validate ?? '',
  logicDisabledWhen: logic?.disabledWhen ?? '',
  logicHiddenWhen: logic?.hiddenWhen ?? '',
  logicCompute: logic?.compute ?? '',
});

const toSaveInput = (def: ScreenDefinition): ScreenDefinitionSaveInput => ({
  builtin: def.builtin,
  titleSingular: def.titleSingular,
  titlePlural: def.titlePlural,
  icon: def.icon,
  fields: def.fields,
  titleFieldKey: def.titleFieldKey,
  hasNotes: def.hasNotes,
  hasDocuments: def.hasDocuments,
  hasTags: def.hasTags,
  listActions: def.listActions,
  viewActionIds: def.viewActionIds,
  cardActionIds: def.cardActionIds,
  parentEntity: def.parentEntity ?? null,
  parentFieldKey: def.parentFieldKey ?? null,
  sidebarOrder: def.sidebarOrder,
  enabled: def.enabled,
});

const buildDynamicMeta = (def: ScreenDefinition, fieldCount: number): string => {
  const parts = [`${fieldCount} campo(s)`];
  if (def.hasNotes) parts.push('Anotações');
  if (def.hasDocuments) parts.push('Documentos');
  if (def.hasTags) parts.push('Etiquetas');
  return parts.join(' · ');
};

const builtinSaveInput = (key: string): ScreenDefinitionSaveInput => {
  const label = BUILTIN_SCREENS.find((b) => b.key === key)?.label ?? key;
  return {
    builtin: true,
    titleSingular: label,
    titlePlural: label,
    icon: 'apps',
    fields: [],
    titleFieldKey: '',
    hasNotes: false,
    hasDocuments: false,
    hasTags: false,
    listActions: [],
    viewActionIds: [],
    cardActionIds: [],
    parentEntity: null,
    parentFieldKey: null,
    sidebarOrder: 0,
    enabled: true,
  };
};

export const useScreenBuilderViewModel = (): ScreenBuilderViewModel => {
  const { tenantRole } = useTenant();
  const { definitions, dynamicScreens, isLoading, saveDefinition, deleteDefinition } = useScreenDefinitions();
  const schemaContext = useSchemaContext();
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
  const [fieldForm, setFieldForm] = useState<FieldFormState>(EMPTY_FIELD_FORM);
  const [savingField, setSavingField] = useState(false);
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<{ screenKey: string; field: FieldDefinition } | null>(null);
  const [deletingField, setDeletingField] = useState(false);

  const [selectedKeyState, setSelectedKeyState] = useState<string | null>(null);
  const [draggedFieldKey, setDraggedFieldKey] = useState<string | null>(null);
  const [dragOverFieldKey, setDragOverFieldKey] = useState<string | null>(null);

  const dynamicDefinitions = useMemo(
    () => definitions
      .filter((def) => !def.builtin)
      .sort((a, b) => a.sidebarOrder - b.sidebarOrder),
    [definitions],
  );

  const fieldsByScreen = useMemo(() => {
    const map: Record<string, FieldDefinition[]> = {};
    definitions.forEach((def) => { map[def.id] = sortFieldsByOrder(def.fields); });
    return map;
  }, [definitions]);

  const builtinRows = useMemo<BuiltinScreenRow[]>(
    () => BUILTIN_SCREENS.map((b) => ({
      key: b.key,
      label: b.label,
      fields: fieldsByScreen[b.key] ?? [],
    })),
    [fieldsByScreen],
  );

  const dynamicListEntries = useMemo<ScreenListEntry[]>(
    () => dynamicDefinitions.map((def) => ({
      key: def.id,
      icon: def.icon,
      title: def.titlePlural,
      meta: buildDynamicMeta(def, fieldsByScreen[def.id]?.length ?? 0),
      disabled: !def.enabled,
    })),
    [dynamicDefinitions, fieldsByScreen],
  );

  const builtinListEntries = useMemo<ScreenListEntry[]>(
    () => builtinRows.map((row) => ({
      key: row.key,
      icon: 'apps',
      title: row.label,
      meta: `${row.fields.length} campo(s) adicional(is)`,
      disabled: false,
    })),
    [builtinRows],
  );

  const selectedKey = useMemo(() => {
    const allKeys = [...dynamicListEntries.map((e) => e.key), ...builtinListEntries.map((e) => e.key)];
    if (selectedKeyState && allKeys.includes(selectedKeyState)) return selectedKeyState;
    return allKeys[0] ?? null;
  }, [selectedKeyState, dynamicListEntries, builtinListEntries]);

  const selectScreen = useCallback((key: string) => setSelectedKeyState(key), []);

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
        meta: buildDynamicMeta(def, fieldsByScreen[def.id]?.length ?? 0),
        enabled: def.enabled,
        canMoveUp: dynIndex > 0,
        canMoveDown: dynIndex < dynamicDefinitions.length - 1,
        fields: fieldsByScreen[def.id] ?? [],
      };
    }
    const row = builtinRows.find((r) => r.key === selectedKey);
    if (row) {
      return {
        kind: 'builtin',
        key: row.key,
        icon: 'apps',
        title: row.label,
        meta: `${row.fields.length} campo(s) adicional(is)`,
        enabled: true,
        canMoveUp: false,
        canMoveDown: false,
        fields: row.fields,
      };
    }
    return null;
  }, [selectedKey, dynamicDefinitions, builtinRows, fieldsByScreen]);

  const getDefinitionByKey = useCallback(
    (screenKey: string) => definitions.find((def) => def.id === screenKey),
    [definitions],
  );

  const fieldTypeLabel = useCallback((type: CustomFieldType) => FIELD_TYPE_LABELS[type], []);

  const isTitleField = useCallback((screenKey: string, fieldKey: string) => {
    const def = getDefinitionByKey(screenKey);
    return !!def && !def.builtin && def.titleFieldKey === fieldKey;
  }, [getDefinitionByKey]);

  // Sem etiquetas na tela não há o que gerenciar pelo card: desligar "Habilitar Etiquetas"
  // retira a ação da configuração, para não gravar uma combinação que a listagem ignoraria.
  const updateScreenForm = useCallback((patch: Partial<ScreenFormState>) => {
    setScreenForm((prev) => {
      const next = { ...prev, ...patch };
      if (screenModalIsBuiltin || next.hasTags) return next;
      return { ...next, listActions: next.listActions.filter((a) => a !== 'manageTags') };
    });
  }, [screenModalIsBuiltin]);

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
      listActions: def.hasTags ? def.listActions : def.listActions.filter((a) => a !== 'manageTags'),
      viewActionIds: def.viewActionIds,
      cardActionIds: def.cardActionIds,
      childLinks,
      enabled: def.enabled,
      titleFieldKey: def.titleFieldKey,
    });
    setScreenModal({ screenKey });
  }, [getDefinitionByKey, dynamicDefinitions]);

  const closeScreenModal = useCallback(() => setScreenModal(null), []);

  // Telas que já têm um campo apontando para esta — só elas podem virar filhas.
  const childCandidates = useMemo<ChildCandidate[]>(() => {
    const current = screenModal?.screenKey;
    if (!current) return [];
    return dynamicDefinitions
      .filter((def) => def.id !== current)
      .map((def) => ({
        key: def.id,
        label: def.titlePlural,
        fieldOptions: def.fields
          .filter((field) => field.type === 'reference' && field.refEntity === current)
          .map((field) => ({ value: field.key, label: field.label })),
      }))
      .filter((candidate) => candidate.fieldOptions.length > 0);
  }, [dynamicDefinitions, screenModal]);

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
      label: option.label,
      icon: option.Icon,
    })),
    [],
  );

  const titleFieldOptions = useMemo<SearchSelectOption[]>(() => {
    if (!screenModal?.screenKey) return [];
    const def = getDefinitionByKey(screenModal.screenKey);
    if (!def) return [];
    return def.fields
      .filter((f) => f.type === 'text' && f.required)
      .map((f) => ({ value: f.key, label: f.label }));
  }, [screenModal, getDefinitionByKey]);

  const modalListActionOptions = useMemo(() => {
    if (!screenModalIsBuiltin) return LIST_ACTION_OPTIONS;
    const supported = supportedListActions(screenModal?.screenKey ?? '');
    return LIST_ACTION_OPTIONS.filter((option) => supported.includes(option.key));
  }, [screenModalIsBuiltin, screenModal]);

  // Nas telas do sistema não há "Geral" (título, ícone e abas são fixos), e "Registros filhos"
  // só existe quando alguma tela aponta para esta.
  const screenModalTabs = useMemo<{ key: ScreenModalTab; label: string }[]>(() => [
    ...(screenModalIsBuiltin ? [] : [{ key: 'general' as const, label: 'Geral' }]),
    { key: 'list' as const, label: 'Listagem' },
    { key: 'actions' as const, label: 'Ações' },
    ...(!!screenModal?.screenKey && childCandidates.length > 0
      ? [{ key: 'children' as const, label: 'Registros filhos' }]
      : []),
  ], [screenModalIsBuiltin, screenModal, childCandidates]);

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
      notify('Informe o título no singular e no plural.', 'error');
      return;
    }
    const childMissingField = Object.entries(screenForm.childLinks).find(([, field]) => !field);
    if (childMissingField) {
      const label = childCandidates.find((c) => c.key === childMissingField[0])?.label ?? 'registro filho';
      setScreenModalTab('children');
      notify(`Escolha o campo de vínculo de "${label}".`, 'error');
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
      if (screenModal?.screenKey) {
        const def = getDefinitionByKey(screenModal.screenKey);
        if (!def) return;
        const titleFieldKey = def.builtin ? '' : (screenForm.titleFieldKey || def.titleFieldKey);
        await saveDefinition(def.id, {
          ...toSaveInput(def),
          titleSingular: screenForm.titleSingular.trim(),
          titlePlural: screenForm.titlePlural.trim(),
          icon: screenForm.icon,
          hasNotes: screenForm.hasNotes,
          hasDocuments: screenForm.hasDocuments,
          hasTags: screenForm.hasTags,
          listActions: screenForm.listActions,
          viewActionIds: screenForm.viewActionIds,
          cardActionIds: screenForm.cardActionIds,
          enabled: screenForm.enabled,
          titleFieldKey,
        });

        await persistChildLinks(def.id);

        notify('Tela atualizada com sucesso!', 'success');
      } else {
        const existingKeys = new Set([
          ...definitions.map((def) => def.id),
          ...BUILTIN_SCREENS.map((b) => b.key),
        ]);
        const screenKey = ensureUniqueKey(slugifyFieldKey(screenForm.titlePlural), existingKeys);
        const maxOrder = dynamicDefinitions.reduce((max, def) => Math.max(max, def.sidebarOrder), -1);
        const nameField: FieldDefinition = {
          key: 'nome',
          label: 'Nome',
          type: 'text',
          required: true,
          order: 0,
          showInList: true,
          filterable: true,
        };
        await saveDefinition(screenKey, {
          builtin: false,
          titleSingular: screenForm.titleSingular.trim(),
          titlePlural: screenForm.titlePlural.trim(),
          icon: screenForm.icon,
          fields: [nameField],
          titleFieldKey: nameField.key,
          hasNotes: screenForm.hasNotes,
          hasDocuments: screenForm.hasDocuments,
          hasTags: screenForm.hasTags,
          listActions: screenForm.listActions,
          viewActionIds: screenForm.viewActionIds,
          cardActionIds: screenForm.cardActionIds,
          parentEntity: null,
          parentFieldKey: null,
          sidebarOrder: maxOrder + 1,
          enabled: true,
        });
        notify('Tela criada com sucesso! Um campo "Nome" foi adicionado como título.', 'success');
        setSelectedKeyState(screenKey);
      }
      setScreenModal(null);
    } catch (err) {
      console.error('[ScreenBuilder handleSaveScreen]', err);
      notify('Erro ao salvar a tela.', 'error');
    } finally {
      setSavingScreen(false);
    }
  }, [screenForm, screenModal, getDefinitionByKey, saveDefinition, definitions, dynamicDefinitions, childCandidates, persistChildLinks, notify]);

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
    const def = getDefinitionByKey(screenKey);
    if (def) setDeleteScreenTarget(def);
  }, [getDefinitionByKey]);

  const cancelDeleteScreen = useCallback(() => setDeleteScreenTarget(null), []);

  const confirmDeleteScreen = useCallback(async () => {
    if (!deleteScreenTarget) return;
    setDeletingScreen(true);
    try {
      await deleteDefinition(deleteScreenTarget.id);
      notify('Tela excluída com sucesso.', 'success');
      setDeleteScreenTarget(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao excluir a tela.', 'error');
    } finally {
      setDeletingScreen(false);
    }
  }, [deleteScreenTarget, deleteDefinition, notify]);

  const openCreateField = useCallback((screenKey: string) => {
    setFieldForm({ ...EMPTY_FIELD_FORM, optionColorInput: defaultTagColor });
    setFieldModalTab('general');
    setFieldModal({ screenKey, fieldKey: null });
  }, [defaultTagColor]);

  const openEditField = useCallback((screenKey: string, fieldKey: string) => {
    setFieldModalTab('general');
    const def = getDefinitionByKey(screenKey);
    const field = def?.fields.find((f) => f.key === fieldKey);
    if (!field) return;
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
  }, [getDefinitionByKey, defaultTagColor]);

  const closeFieldModal = useCallback(() => setFieldModal(null), []);

  const typeOptions = useMemo<SearchSelectOption[]>(
    () => (Object.keys(FIELD_TYPE_LABELS) as CustomFieldType[]).map((type) => ({
      value: type,
      label: FIELD_TYPE_LABELS[type],
    })),
    [],
  );

  const maskOptions = useMemo<SearchSelectOption[]>(
    () => (Object.keys(MASK_LABELS) as CustomFieldMask[]).map((mask) => ({
      value: mask,
      label: MASK_LABELS[mask],
    })),
    [],
  );

  const formatPresetOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: 'Nenhuma' },
      ...(Object.keys(FORMAT_PRESET_LABELS) as FormatPreset[]).map((preset) => ({
        value: preset,
        label: FORMAT_PRESET_LABELS[preset],
      })),
    ],
    [],
  );

  const validateCheckOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: 'Nenhuma' },
      ...(Object.keys(VALIDATE_CHECK_LABELS) as ValidateCheck[]).map((check) => ({
        value: check,
        label: VALIDATE_CHECK_LABELS[check],
      })),
    ],
    [],
  );

  const fieldSupportsRules = useMemo(
    () => RULES_SUPPORTED_FIELD_TYPES.includes(fieldForm.type),
    [fieldForm.type],
  );

  const refEntityOptions = useMemo<SearchSelectOption[]>(() => {
    const dynamicOptions = dynamicScreens
      .filter((def) => def.id !== fieldModal?.screenKey)
      .map((def) => ({ value: def.id, label: def.titlePlural }));
    return [
      ...BUILTIN_SCREENS.map((b) => ({ value: b.key, label: b.label })),
      ...dynamicOptions,
    ];
  }, [dynamicScreens, fieldModal]);

  // Só faz sentido agregar de uma tela que aponte de volta para esta: é o vínculo pai/filho que
  // define quais registros pertencem ao agregado.
  const aggregationChildScreens = useMemo(
    () =>
      dynamicScreens.filter(
        (def) =>
          def.id !== fieldModal?.screenKey &&
          def.fields.some((f) => f.type === 'reference' && f.refEntity === fieldModal?.screenKey),
      ),
    [dynamicScreens, fieldModal],
  );

  const aggregationFromOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: 'Nenhuma (campo comum)' },
      ...aggregationChildScreens.map((def) => ({ value: def.id, label: def.titlePlural })),
    ],
    [aggregationChildScreens],
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
    const vars: WorkflowVariable[] = [{ name: 'value', definedBy: 'Valor do próprio campo' }];
    seen.add('value');
    const push = (name: string, definedBy: string) => {
      if (seen.has(name)) return;
      seen.add(name);
      vars.push({ name, definedBy });
    };
    getEntityByCollection(fieldModal.screenKey)?.fields.forEach((f) => push(f.key, f.label));
    getDefinitionByKey(fieldModal.screenKey)?.fields.forEach((f) => push(f.key, f.label));
    return vars;
  }, [fieldModal, getDefinitionByKey]);

  const handleSaveField = useCallback(async () => {
    if (!fieldModal) return;
    // Abre a aba dona do campo recusado: com o formulário em abas, avisar sem trazer o
    // usuário até o campo deixaria o erro invisível.
    const reject = (tab: FieldModalTab, message: string) => {
      setFieldModalTab(tab);
      notify(message, 'error');
    };
    const label = fieldForm.label.trim();
    if (!label) {
      reject('general', 'Informe o nome do campo.');
      return;
    }

    // Validação do fieldKey (apenas em criação, não edição)
    if (!fieldModal.fieldKey) {
      const fieldKeyToValidate = fieldForm.fieldKey.trim() || slugifyFieldKey(label);
      const validationError = validateFieldKey(fieldKeyToValidate);
      if (validationError) {
        reject('general', validationError);
        return;
      }
    }

    if (fieldForm.type === 'select' && fieldForm.staticOptions.length === 0 && !fieldForm.optionsAllowUserAdd) {
      reject('general', 'Adicione ao menos uma opção ou permita que usuários criem opções.');
      return;
    }
    if (fieldForm.type === 'masked' && !fieldForm.mask) {
      reject('general', 'Escolha a máscara do campo.');
      return;
    }
    if (fieldForm.type === 'reference' && !fieldForm.refEntity) {
      reject('general', 'Escolha a tela vinculada ao campo.');
      return;
    }
    if (isInvalidRegex(fieldForm.ruleValidatePattern)) {
      reject('advanced', 'A expressão regular de validação é inválida.');
      return;
    }
    if (isInvalidRegex(fieldForm.ruleFormatPattern)) {
      reject('advanced', 'A expressão regular de formatação é inválida.');
      return;
    }
    if (fieldForm.logicCompute.trim()) {
      const computeKey = fieldModal.fieldKey ?? (fieldForm.fieldKey.trim() || slugifyFieldKey(label));
      const screenFields = getDefinitionByKey(fieldModal.screenKey)?.fields ?? [];
      if (findComputeCycle(screenFields, computeKey, fieldForm.logicCompute.trim())) {
        reject('advanced', 'O valor calculado depende de si mesmo — reveja as expressões dos campos calculados.');
        return;
      }
    }
    const aggregation = buildFieldAggregation(fieldForm);
    if (aggregation) {
      if (aggregation.op !== 'count' && !aggregation.field) {
        reject('advanced', 'Escolha o campo do filho a ser somado (só a contagem dispensa o campo).');
        return;
      }
      if (aggregationCreatesCycle(schemaContext, fieldModal.screenKey, aggregation.from)) {
        reject('advanced', 'Essa agregação fecha um ciclo entre telas — o valor nunca se estabilizaria.');
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
        nextFields = fields.map((f) => {
          if (f.key !== fieldModal.fieldKey) return f;
          return {
            ...f,
            label,
            required: fieldModalIsTitleField ? true : fieldForm.required,
            section: fieldForm.section.trim() || null,
            placeholder: fieldForm.placeholder.trim() || null,
            multi: fieldForm.multi,
            mask: fieldForm.type === 'masked' && fieldForm.mask !== '' ? fieldForm.mask : null,
            refEntity: fieldForm.type === 'reference' ? fieldForm.refEntity : null,
            optionsAllowUserAdd: fieldForm.optionsAllowUserAdd,
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
        const baseKey = fieldForm.fieldKey.trim() || slugifyFieldKey(label);
        const key = ensureUniqueKey(baseKey, existingKeys);
        const maxOrder = fields.reduce((max, f) => Math.max(max, f.order), -1);
        nextFields = [...fields, {
          key,
          label,
          type: fieldForm.type,
          required: fieldForm.required,
          order: maxOrder + 1,
          section: fieldForm.section.trim() || null,
          placeholder: fieldForm.placeholder.trim() || null,
          multi: fieldForm.multi,
          mask: fieldForm.type === 'masked' && fieldForm.mask !== '' ? fieldForm.mask : null,
          refEntity: fieldForm.type === 'reference' ? fieldForm.refEntity : null,
          optionsAllowUserAdd: fieldForm.optionsAllowUserAdd,
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
      await saveDefinition(fieldModal.screenKey, { ...baseInput, fields: nextFields });
      notify(fieldModal.fieldKey ? 'Campo atualizado com sucesso!' : 'Campo adicionado com sucesso!', 'success');
      setFieldModal(null);
    } catch {
      notify('Erro ao salvar o campo.', 'error');
    } finally {
      setSavingField(false);
    }
  }, [fieldModal, fieldForm, fieldModalIsTitleField, getDefinitionByKey, saveDefinition, notify, schemaContext]);

  const applyFieldOrder = useCallback(async (screenKey: string, fields: FieldDefinition[]) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    const reordered = fields.map((f, idx) => ({ ...f, order: idx }));
    try {
      await saveDefinition(screenKey, { ...toSaveInput(def), fields: reordered });
    } catch {
      notify('Erro ao reordenar os campos.', 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify]);

  const moveField = useCallback(async (screenKey: string, fieldKey: string, direction: -1 | 1) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    const fields = sortFieldsByOrder(def.fields);
    const index = fields.findIndex((f) => f.key === fieldKey);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) return;
    const [moved] = fields.splice(index, 1);
    fields.splice(targetIndex, 0, moved);
    await applyFieldOrder(screenKey, fields);
  }, [getDefinitionByKey, applyFieldOrder]);

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
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    const fields = sortFieldsByOrder(def.fields);
    const fromIndex = fields.findIndex((f) => f.key === sourceKey);
    const toIndex = fields.findIndex((f) => f.key === targetFieldKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = fields.splice(fromIndex, 1);
    fields.splice(toIndex, 0, moved);
    await applyFieldOrder(screenKey, fields);
  }, [draggedFieldKey, getDefinitionByKey, applyFieldOrder]);

  const requestDeleteField = useCallback((screenKey: string, fieldKey: string) => {
    const def = getDefinitionByKey(screenKey);
    const field = def?.fields.find((f) => f.key === fieldKey);
    if (field) setDeleteFieldTarget({ screenKey, field });
  }, [getDefinitionByKey]);

  const cancelDeleteField = useCallback(() => setDeleteFieldTarget(null), []);

  const confirmDeleteField = useCallback(async () => {
    if (!deleteFieldTarget) return;
    const def = getDefinitionByKey(deleteFieldTarget.screenKey);
    if (!def) return;
    setDeletingField(true);
    try {
      const nextFields = def.fields.filter((f) => f.key !== deleteFieldTarget.field.key);
      await saveDefinition(def.id, { ...toSaveInput(def), fields: nextFields });
      notify('Campo excluído com sucesso.', 'success');
      setDeleteFieldTarget(null);
    } catch {
      notify('Erro ao excluir o campo.', 'error');
    } finally {
      setDeletingField(false);
    }
  }, [deleteFieldTarget, getDefinitionByKey, saveDefinition, notify]);

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
      ? `Configurações de ${BUILTIN_SCREENS.find((b) => b.key === screenModal?.screenKey)?.label ?? 'Tela'}`
      : (screenModal?.screenKey ? 'Editar Tela' : 'Nova Tela'),
    screenForm,
    updateScreenForm,
    toggleListAction,
    titleFieldOptions,
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
    fieldForm,
    updateFieldForm,
    fieldExpressionVariables,
    typeOptions,
    maskOptions,
    formatPresetOptions,
    validateCheckOptions,
    fieldSupportsRules,
    refEntityOptions,
    aggregationFromOptions,
    aggregationViaOptions,
    aggregationFieldOptions,
    aggregationOpOptions,
    aggregationFilterVariables,
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
