import { useCallback, useMemo, useRef, useState } from 'react';
import { useTheme } from 'styled-components';
import { useAuthorization } from '../../../stores/useAuthorization';
import {
  PERMISSION_PORTAL_MANAGE,
  PERMISSION_SCREENS_EDIT_WINDOW,
  PERMISSION_SCREENS_MEMBER_VISIBILITY,
} from '../../../domain/schema/access/kernelPermissions';
import {
  isMemberReferenceField,
  MEMBER_VISIBILITY_MAX_FIELDS,
  readAllPermissionId,
} from '../../../domain/schema/memberVisibility';
import {
  EMPTY_MEMBER_VISIBILITY_FORM,
  fromMemberVisibilityForm,
  memberVisibilityFormIssue,
  toMemberVisibilityForm,
} from './components/ScreenMemberVisibilityPanel/screenMemberVisibilityForm';
import type {
  MemberVisibilityFormIssue,
  MemberVisibilityFormState,
} from './components/ScreenMemberVisibilityPanel/screenMemberVisibilityForm';
import {
  EMPTY_EDIT_WINDOW_FORM,
  editWindowFormIsValid,
  fromEditWindowForm,
  toEditWindowForm,
} from './components/ScreenEditWindowPanel/screenEditWindowForm';
import type { EditWindowFormState } from './components/ScreenEditWindowPanel/screenEditWindowForm';
import { portalDeclarationIssues, type PortalScreenLike } from '../../../domain/schema/portal';
import {
  EMPTY_PORTAL_FORM,
  fromPortalForm,
  toPortalForm,
  type PortalFormState,
  type PortalSubjectKind,
} from './components/ScreenPortalPanel/screenPortalForm';
import { PERMISSION_SCREENS_MANAGE } from '../../../domain/schema/access';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';
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
import type { AggregationOp, FieldAggregation, FieldFileConfig, FieldLookupBinding, FieldLogic, FieldRules, FormatPreset, FormatRule, ValidateCheck, ValidateRule } from '../../../domain/schema/fieldRules';
import { AGGREGATION_OP_LABELS, DEFAULT_FILE_MAX_SIZE_MB } from '../../../domain/schema/fieldRules';
import {
  formatPresetOptions as buildFormatPresetOptions,
  maskPresetOptions as buildMaskPresetOptions,
  useFieldRulePresets,
  validatePresetOptions as buildValidatePresetOptions,
} from '../../shared/useFieldRulePresets';
import type { ExternalLookupProviderOption } from '../../shared/useExternalLookupProviders';
import { useExternalLookupOptions } from '../../shared/useExternalLookupProviders';
import { extractFieldExpressionDependencies } from '../../../domain/schema/fieldExpression';
import { FIELD_UI_RESERVED_VARIABLES } from '../../../domain/schema/fieldUiScope';
import { AGGREGATION_ORDER_SYSTEM_KEYS, aggregationCreatesCycle, aggregationTypesCompatible, fieldAggregationIssues } from '../../../domain/schema/aggregationSpec';
import type { AggregationFieldShape } from '../../../domain/schema/aggregationSpec';
import type { QueryOrderBy } from '../../../domain/schema/querySpec';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useLookups } from '../../../stores/useLookups';
import { useTags } from '../../../stores/useTags';
import { deriveFormFields } from '../../shared/deriveEntitySchema';
import { withArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';
import { useArtifactPrefix } from '../../shared/settings/useArtifactPrefix';
import { RESERVED_COLLECTIONS, builtinScreenBaseline, derivedLookupCollection, derivedTagCollection, lookupIdIssue, screenIdIssue, tagListIdIssue } from '../../../domain/schema/screenEntity';
import { isBoundScreen, screenDataCollection } from '../../../domain/services/screenDataCollection';
import type { EntityKey } from '../../../domain/schema/entityRegistry';
import { ENTITY_REGISTRY, ENTITY_REGISTRY_LIST, getEntityByCollection } from '../../../domain/schema/entityRegistry';
import type { WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { RecordSequenceIssueCode } from '../../../domain/schema/recordSequence';
import { isSequenceField } from '../../../domain/schema/recordSequence';
import type { FieldSequenceFormState } from './components/FieldSequencePanel/fieldSequenceForm';
import {
  EMPTY_FIELD_SEQUENCE_FORM,
  fieldSequenceFormIssue,
  fieldSequencePreview,
  fieldTypeSupportsSequence,
  fromFieldSequenceForm,
  toFieldSequenceForm,
} from './components/FieldSequencePanel/fieldSequenceForm';
import type { ColorSwatchOption } from '../../components/ui/ColorSwatchPicker';

import { useLabel, useT, type TranslateFn } from '../../shared/i18n/useT';
import { useExtensionName } from '../../shared/extensions/useExtensionName';

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
  /**
   * O IDENTIFICADOR da tela — que é o nome da coleção no Firestore e a raiz das permissões dela
   * (`pet1.read`, `pet1.create`). Só é escolhido na CRIAÇÃO: mudá-lo depois mudaria o lugar onde os
   * registros vivem.
   *
   * Ele era derivado do título no plural e nunca aparecia; quem precisava escrever
   * `hasPermission("pet1.delete")` numa expressão tinha de adivinhá-lo.
   */
  screenKey: string;
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
  imageFieldKey: string;
  /** O que a tela expõe no portal. Só é gravado quando a aba foi tocada — ver `handleSaveScreen`. */
  portal: PortalFormState;
  portalTouched: boolean;
  /** A janela de edição. Como o portal, só é gravada quando a aba foi tocada. */
  editWindow: EditWindowFormState;
  editWindowTouched: boolean;
  /** Quem lê cada registro. Como a janela, só é gravada quando a aba foi tocada. */
  memberVisibility: MemberVisibilityFormState;
  memberVisibilityTouched: boolean;
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

/**
 * Os gestos da plataforma como o escritório os vê na aba "Ações": os ligados primeiro, na ordem em
 * que o cartão os mostra, e depois os disponíveis. Eles ficavam numa aba "Listagem" feita só de
 * caixas, longe das ações do escritório e sem ordem — e quem configurava a tela não os achava.
 */
export interface GestureRow extends ListActionOption {
  enabled: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export const gestureRowsFrom = (options: ListActionOption[], listActions: ScreenListAction[]): GestureRow[] => {
  const enabled = listActions.flatMap((key) => options.filter((option) => option.key === key));
  const available = options.filter((option) => !listActions.includes(option.key));
  return [
    ...enabled.map((option, index) => ({
      ...option,
      enabled: true,
      canMoveUp: index > 0,
      canMoveDown: index < enabled.length - 1,
    })),
    ...available.map((option) => ({ ...option, enabled: false, canMoveUp: false, canMoveDown: false })),
  ];
};

/**
 * Troca o gesto de lugar com o vizinho VISÍVEL. Um slot gravado cuja ação não está mais instalada
 * fica onde está: some da tela, mas não da configuração, e volta ao lugar se a extensão voltar.
 */
export const moveListActionSlot = (
  listActions: ScreenListAction[],
  visible: ReadonlySet<string>,
  key: ScreenListAction,
  delta: -1 | 1,
): ScreenListAction[] => {
  const from = listActions.indexOf(key);
  if (from < 0) return listActions;
  let to = from + delta;
  while (to >= 0 && to < listActions.length && !visible.has(listActions[to])) to += delta;
  if (to < 0 || to >= listActions.length) return listActions;
  const next = [...listActions];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
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
  unique: boolean;
  ruleFormatPreset: FormatPreset | '';
  ruleFormatPattern: string;
  ruleFormatReplacement: string;
  ruleValidateCheck: ValidateCheck | '';
  ruleValidatePattern: string;
  ruleValidateMessage: string;
  ruleValidateMinLength: string;
  ruleValidateMaxLength: string;
  logicValidate: string;
  logicDisabledWhen: string;
  logicHiddenWhen: string;
  logicCompute: string;
  logicDerive: string;
  logicOnChange: string;
  lookupProvider: string;
  lookupTargetPrefix: string;
  aggregationFrom: string;
  aggregationVia: string;
  aggregationOp: AggregationOp | '';
  aggregationField: string;
  aggregationFilter: string;
  aggregationOrderBy: QueryOrderBy[];
  /** Extensões separadas por vírgula, como o usuário digita. Vazio = qualquer uma. */
  fileExtensions: string;
  /** Tamanho máximo em MB, como texto: vazio é "usa o limite", e `0` não é vazio. */
  fileMaxSizeMb: string;
  /** A numeração do campo (`autoValue.sequence`). */
  sequence: FieldSequenceFormState;
}

/**
 * Só o que o formulário consegue produzir tem frase própria; o resto (forma, tipo, campo aninhado) só
 * chega por pacote ou documento editado à mão, e cai na recusa genérica.
 */
const SEQUENCE_ISSUE_KEYS: Record<RecordSequenceIssueCode, string> = {
  shape: 'field.sequence.error.invalid',
  scope: 'field.sequence.error.invalid',
  reset: 'field.sequence.error.invalid',
  nested: 'field.sequence.error.invalid',
  'field-type': 'field.sequence.error.invalid',
  'pattern-slot': 'field.sequence.error.pattern-slot',
  'pattern-numeric': 'field.sequence.error.invalid',
  'pattern-year': 'field.sequence.error.pattern-year',
  'scope-needs-parent': 'field.sequence.error.scope-needs-parent',
};

/** O que a seção "Numeração" do campo precisa para se desenhar. */
export interface FieldSequencePanelState {
  /** O campo já numera: a configuração gravada não muda mais. */
  locked: boolean;
  numeric: boolean;
  hasParent: boolean;
  preview: string;
  scopeOptions: SearchSelectOption[];
  resetOptions: SearchSelectOption[];
}

const MEMBER_VISIBILITY_ISSUE_KEYS: Record<MemberVisibilityFormIssue, string> = {
  'fields-required': 'member-visibility.panel.fields-required',
  'fields-too-many': 'member-visibility.panel.fields-too-many',
};

export type ScreenModalTab = 'general' | 'actions' | 'children' | 'portal' | 'editWindow' | 'memberVisibility';
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
  /** O prefixo do escritório, fixo à frente da chave de uma tela nova; `null` sem prefixo. */
  artifactPrefix: string | null;
  /** Modal aberto para uma tela do sistema: só configura os registros filhos. */
  screenModalIsBuiltin: boolean;
  screenModalTitle: string;
  screenModalTabs: { key: ScreenModalTab; label: string }[];
  screenModalTab: ScreenModalTab;
  setScreenModalTab: (tab: ScreenModalTab) => void;
  gestureRows: GestureRow[];
  actionOptions: { value: string; label: string }[];
  setScreenViewActionIds: (ids: string[]) => void;
  setScreenCardActionIds: (ids: string[]) => void;
  screenForm: ScreenFormState;
  updateScreenForm: (patch: Partial<ScreenFormState>) => void;
  updateEditWindowForm: (patch: Partial<EditWindowFormState>) => void;
  /** A tela aberta veio de uma extensão — o prazo que ela declarar vence na atualização. */
  editWindowFromExtension: boolean;
  /** A aba "Visibilidade dos registros": opções já rotuladas e o defeito que impede gravar. */
  memberVisibilityPanel: {
    fieldOptions: Array<{ value: string; label: string }>;
    bypassOptions: Array<{ value: string; label: string; meta?: string }>;
    issue: string | null;
    maxFields: number;
  };
  updateMemberVisibilityForm: (patch: Partial<MemberVisibilityFormState>) => void;
  toggleListAction: (action: ScreenListAction) => void;
  moveListAction: (action: ScreenListAction, delta: -1 | 1) => void;
  titleFieldOptions: SearchSelectOption[];
  subtitleFieldOptions: SearchSelectOption[];
  childCandidates: ChildCandidate[];
  /** A aba "Portal": opções, problemas da declaração (já traduzidos) e os gestos. */
  portalPanel: {
    fieldOptions: Array<{ value: string; label: string }>;
    createFieldOptions: Array<{ value: string; label: string }>;
    documentTypeOptions: Array<{ value: string; label: string }>;
    referenceFieldOptions: Array<{ value: string; label: string }>;
    editFieldOptions: Array<{ value: string; label: string }>;
    hasParent: boolean;
    hasDocuments: boolean;
    readOnly: boolean;
    issues: string[];
    /** A coleção da tela — é por ela que a aba mostra o andamento da atualização do portal. */
    collection: string;
  };
  setPortalEnabled: (enabled: boolean) => void;
  setPortalSubjectKind: (kind: PortalSubjectKind) => void;
  setPortalSubjectField: (fieldKey: string) => void;
  togglePortalField: (fieldKey: string, exposed: boolean) => void;
  setPortalVisibleWhen: (expression: string) => void;
  setPortalDocuments: (documents: boolean) => void;
  setPortalAllowCreate: (allowCreate: boolean) => void;
  togglePortalCreateField: (fieldKey: string, fillable: boolean) => void;
  setPortalAllowUploads: (allowUploads: boolean) => void;
  togglePortalUploadType: (typeKey: string, allowed: boolean) => void;
  setPortalAllowEdit: (allowEdit: boolean) => void;
  togglePortalEditField: (fieldKey: string, editable: boolean) => void;
  setPortalEditWhen: (expression: string) => void;
  setPortalEditOnlyOwn: (onlyOwn: boolean) => void;
  setPortalNotifyOffice: (notify: boolean) => void;
  setPortalAutomationInvites: (allowed: boolean) => void;
  setPortalDocumentLinks: (enabled: boolean) => void;
  setPortalDocumentLinkMinutes: (minutes: string) => void;
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
  /**
   * O mesmo conjunto mais as variáveis de SITUAÇÃO (`isNew`), que só existem nos slots front-only.
   * Oferecê-las em `validate`/`compute` sugeriria um nome que o backend não resolve.
   */
  fieldUiExpressionVariables: WorkflowVariable[];
  typeOptions: SearchSelectOption[];
  maskOptions: SearchSelectOption[];
  formatPresetOptions: SearchSelectOption[];
  validateCheckOptions: SearchSelectOption[];
  fieldSupportsRules: boolean;
  /** Campo `file` não filtra: não há URL que alguém digite num filtro. */
  fieldSupportsFilter: boolean;
  /** O campo pode ser chave? Ver `fieldSupportsUnique` — derivado e arquivo não podem. */
  fieldSupportsUnique: boolean;
  /** O campo pode ser numerado pelo sistema? Só `text` e `number` gravados pela pessoa. */
  fieldSupportsSequence: boolean;
  sequencePanel: FieldSequencePanelState;
  updateFieldSequence: (patch: Partial<FieldSequenceFormState>) => void;
  /** Campos de arquivo oferecidos como imagem do registro. Só o vazio = a tela não tem nenhum. */
  imageFieldOptions: SearchSelectOption[];
  /** O teto de tamanho de arquivo, para o placeholder e a dica. */
  fileMaxSizeDefault: string;
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
  aggregationOrderOptions: SearchSelectOption[];
  aggregationDirOptions: SearchSelectOption[];
  addAggregationOrder: () => void;
  updateAggregationOrder: (index: number, patch: { path?: string; dir?: string }) => void;
  removeAggregationOrder: (index: number) => void;
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
  file: 'field.type.file',
};

const EMPTY_SCREEN_FORM: ScreenFormState = {
  screenKey: '',
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
  imageFieldKey: '',
  portal: EMPTY_PORTAL_FORM,
  portalTouched: false,
  editWindow: EMPTY_EDIT_WINDOW_FORM,
  editWindowTouched: false,
  memberVisibility: EMPTY_MEMBER_VISIBILITY_FORM,
  memberVisibilityTouched: false,
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
  unique: false,
  ruleFormatPreset: '',
  ruleFormatPattern: '',
  ruleFormatReplacement: '',
  ruleValidateCheck: '',
  ruleValidatePattern: '',
  ruleValidateMessage: '',
  ruleValidateMinLength: '',
  ruleValidateMaxLength: '',
  logicValidate: '',
  logicDisabledWhen: '',
  logicHiddenWhen: '',
  logicCompute: '',
  logicDerive: '',
  logicOnChange: '',
  lookupProvider: '',
  lookupTargetPrefix: '',
  aggregationFrom: '',
  aggregationVia: '',
  aggregationOp: '',
  aggregationField: '',
  aggregationFilter: '',
  aggregationOrderBy: [],
  fileExtensions: '',
  fileMaxSizeMb: '',
  sequence: EMPTY_FIELD_SEQUENCE_FORM,
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

const parseLengthLimit = (raw: string): number | undefined => {
  const text = raw.trim();
  if (!text) return undefined;
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : undefined;
};

const isInvalidLengthLimit = (raw: string): boolean =>
  raw.trim() !== '' && parseLengthLimit(raw) === undefined;

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
  const minLength = parseLengthLimit(form.ruleValidateMinLength);
  const maxLength = parseLengthLimit(form.ruleValidateMaxLength);
  if (minLength !== undefined) validate.minLength = minLength;
  if (maxLength !== undefined) validate.maxLength = maxLength;
  const hasValidation = Boolean(validate.check || validate.pattern)
    || minLength !== undefined || maxLength !== undefined;
  if (hasValidation && form.ruleValidateMessage.trim()) {
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
  | 'ruleValidateMinLength' | 'ruleValidateMaxLength'
> => ({
  ruleFormatPreset: rules?.format?.preset ?? '',
  ruleFormatPattern: rules?.format?.pattern ?? '',
  ruleFormatReplacement: rules?.format?.replacement ?? '',
  ruleValidateCheck: rules?.validate?.check ?? '',
  ruleValidatePattern: rules?.validate?.pattern ?? '',
  ruleValidateMessage: rules?.validate?.message ?? '',
  ruleValidateMinLength: rules?.validate?.minLength === undefined ? '' : String(rules.validate.minLength),
  ruleValidateMaxLength: rules?.validate?.maxLength === undefined ? '' : String(rules.validate.maxLength),
});

const buildFieldLogic = (form: FieldFormState): FieldLogic | null => {
  const logic: FieldLogic = {};
  if (form.logicValidate.trim()) logic.validate = form.logicValidate.trim();
  if (form.logicDisabledWhen.trim()) logic.disabledWhen = form.logicDisabledWhen.trim();
  if (form.logicHiddenWhen.trim()) logic.hiddenWhen = form.logicHiddenWhen.trim();
  if (form.logicCompute.trim()) logic.compute = form.logicCompute.trim();
  if (form.logicDerive.trim()) logic.derive = form.logicDerive.trim();
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
  const orderBy = form.aggregationOrderBy.filter((order) => order.path.trim() !== '');
  return {
    from,
    via,
    op: form.aggregationOp,
    ...(form.aggregationOp !== 'count' && field ? { field } : {}),
    ...(filter ? { filter } : {}),
    ...(form.aggregationOp === 'latest' ? { orderBy } : {}),
  };
};

const fieldAggregationToForm = (aggregation: FieldAggregation | null | undefined): Pick<
  FieldFormState,
  'aggregationFrom' | 'aggregationVia' | 'aggregationOp' | 'aggregationField' | 'aggregationFilter' | 'aggregationOrderBy'
> => ({
  aggregationFrom: aggregation?.from ?? '',
  aggregationVia: aggregation?.via ?? '',
  aggregationOp: aggregation?.op ?? '',
  aggregationField: aggregation?.field ?? '',
  aggregationFilter: aggregation?.filter ?? '',
  aggregationOrderBy: (aggregation?.orderBy ?? []).map((order) => ({ ...order })),
});

/** O campo que está sendo editado, na forma que a validação do agregado compara com o do filho. */
const formAggregationShape = (form: FieldFormState): AggregationFieldShape => ({
  key: form.fieldKey,
  type: form.type,
  multi: form.multi,
  lookupCollection: form.lookupCollection.trim() || null,
  refEntity: form.refEntity.trim() || null,
});

const buildFieldFileConfig = (form: FieldFormState): FieldFileConfig | null => {
  if (form.type !== 'file') return null;
  const extensions = form.fileExtensions
    .split(',')
    .map((extension) => extension.trim().toLowerCase().replace(/^\./, ''))
    .filter((extension) => extension !== '');
  const size = Number(form.fileMaxSizeMb.trim());
  const maxSizeMb = form.fileMaxSizeMb.trim() !== '' && Number.isFinite(size) ? size : undefined;
  if (extensions.length === 0 && maxSizeMb === undefined) return null;
  return {
    ...(extensions.length > 0 ? { extensions: [...new Set(extensions)] } : {}),
    ...(maxSizeMb !== undefined ? { maxSizeMb } : {}),
  };
};

const fieldFileToForm = (file: FieldFileConfig | null | undefined): Pick<
  FieldFormState,
  'fileExtensions' | 'fileMaxSizeMb'
> => ({
  fileExtensions: (file?.extensions ?? []).join(', '),
  fileMaxSizeMb: file?.maxSizeMb === undefined ? '' : String(file.maxSizeMb),
});

/**
 * Um campo calculado que dependa (direta ou indiretamente) de si mesmo nunca seria avaliado: o
 * motor descarta os campos em ciclo. Recusar na autoria evita a expressão que "não faz nada".
 *
 * O slot é parâmetro porque `compute` e `derive` formam grafos SEPARADOS: um roda na gravação e o
 * outro na leitura, e um ciclo só existe dentro de um deles.
 */
const findExpressionCycle = (
  fields: FieldDefinition[],
  editedKey: string,
  editedExpr: string,
  slot: 'compute' | 'derive',
): boolean => {
  const dependenciesOf = new Map<string, string[]>();
  for (const field of fields) {
    if (field.key === editedKey) continue;
    const expr = slot === 'compute' ? field.logic?.compute : field.logic?.derive;
    if (expr) dependenciesOf.set(field.key, extractFieldExpressionDependencies(expr));
  }
  dependenciesOf.set(editedKey, extractFieldExpressionDependencies(editedExpr));

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

/**
 * Um valor derivado é avaliado na LEITURA e não vai ao documento. Quem roda na GRAVAÇÃO — o campo
 * calculado e o agregado do pai — não pode depender dele: no primeiro caso a expressão estouraria e
 * o campo ficaria em silêncio; no segundo o total seria gravado, e voltaria a envelhecer exatamente
 * como o campo que o derivado veio substituir.
 */
const derivedKeyIn = (fields: FieldDefinition[], dependencies: string[]): string | null =>
  dependencies.find((dependency) =>
    fields.some((field) => field.key === dependency && Boolean(field.logic?.derive)),
  ) ?? null;

const fieldLogicToForm = (logic: FieldLogic | null | undefined): Pick<
  FieldFormState,
  'logicValidate' | 'logicDisabledWhen' | 'logicHiddenWhen' | 'logicCompute' | 'logicDerive' | 'logicOnChange' | 'lookupProvider' | 'lookupTargetPrefix'
> => ({
  logicValidate: logic?.validate ?? '',
  logicDisabledWhen: logic?.disabledWhen ?? '',
  logicHiddenWhen: logic?.hiddenWhen ?? '',
  logicCompute: logic?.compute ?? '',
  logicDerive: logic?.derive ?? '',
  logicOnChange: logic?.onChange ?? '',
  lookupProvider: logic?.onChangeLookup?.provider ?? '',
  lookupTargetPrefix: logic?.onChangeLookup?.targetPrefix ?? '',
});

/**
 * O que se GRAVA de uma tela: tudo o que ela carrega, menos identidade e carimbo de autoria.
 *
 * Derivado por SUBTRAÇÃO, e não enumerado à mão — enumerar ERA o defeito. `recordTabPrefix`,
 * `parentRelation`, `ownerPluginIds`, `sourceId` e `sourceRev` tinham ficado de fora da lista, então
 * salvar qualquer coisa numa tela de extensão apagava o prefixo de aba dela, a relação com o pai e a
 * identidade pela qual o upgrade a reconhece. Aqui uma propriedade nova entra sozinha, e retirar por
 * engano uma que é persistida não compila: `rest` é conferido contra `ScreenDefinitionSaveInput` sem
 * nenhum cast pelo caminho.
 */
const toSaveInput = (def: ScreenDefinition): ScreenDefinitionSaveInput => {
  const {
    id, tenantId, createdAt, createdBy, updatedAt, updatedBy, updatedByName, updatedByPhotoURL,
    deletedBy, deletedByName, deletedByPhotoURL,
    ...rest
  } = def;
  void id; void tenantId; void createdAt; void createdBy; void updatedAt; void updatedBy;
  void updatedByName; void updatedByPhotoURL; void deletedBy; void deletedByName;
  void deletedByPhotoURL;
  return rest;
};

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


/**
 * A chave de uma tela NOVA: a que a pessoa digitou, senão a derivada do título — as duas com o prefixo
 * do escritório. A derivada desempata com sufixo; a digitada não: colidir é recusa, porque quem escolheu
 * o nome precisa saber que ele já estava tomado.
 */
const newScreenKeyOf = (
  prefix: string | null,
  typed: string,
  titlePlural: string,
  existingKeys: ReadonlySet<string>,
): { key: string; typed: boolean } => {
  const chosen = slugifyFieldKey(typed.trim());
  if (chosen) return { key: withArtifactPrefix(prefix, 'collection', chosen), typed: true };
  return {
    key: ensureUniqueKey(withArtifactPrefix(prefix, 'collection', slugifyFieldKey(titlePlural)), new Set(existingKeys)),
    typed: false,
  };
};

export const useScreenBuilderViewModel = (): ScreenBuilderViewModel => {
  const { can, catalog } = useAuthorization();
  const { definitions, dynamicScreens, isLoading, saveDefinition, deleteDefinition } = useScreenDefinitions();
  const recordActions = useRecordActions();
  const label = useLabel();
  const extensionName = useExtensionName();
  const t = useT('core.records');

  /** Os slots cujas ações só fazem sentido numa tela com etiquetas — declarado, não presumido. */
  const tagDependentSlots = useMemo(
    () => new Set(recordActions.filter((action) => action.metadata.requiresTags).map((action) => action.slot)),
    [recordActions],
  );
  const schemaContext = useSchemaContext();
  const artifactPrefix = useArtifactPrefix();
  const fieldRulePresets = useFieldRulePresets();
  const { availableLookups, declareLookup, getOptions: getLookupOptions } = useLookups();
  // Os tipos de documento do escritório — o convidado do portal só escolhe entre eles.
  const documentTypes = getLookupOptions('documentTypes');
  const { availableTagLists, declareTagList } = useTags();
  const externalLookupProviders = useExternalLookupOptions();
  const { notify } = useNotification();
  const { actions } = useActions();
  const theme = useTheme();

  const isAdmin = can(PERMISSION_SCREENS_MANAGE);
  const canManagePortal = can(PERMISSION_PORTAL_MANAGE);
  const canManageEditWindow = can(PERMISSION_SCREENS_EDIT_WINDOW);
  const canManageMemberVisibility = can(PERMISSION_SCREENS_MEMBER_VISIBILITY);
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
  /** Se o usuário já editou o identificador à mão — a partir daí ele para de seguir o título. */
  const screenKeyTouchedRef = useRef(false);
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
    (screenKey: string) => extensionName(dynamicDefinitions.find((def) => def.id === screenKey)?.ownerPluginId),
    [dynamicDefinitions, extensionName],
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

  // O título de uma tela de EXTENSÃO é referência, igual ao de uma tela fixa (ver `builtinRows`). A
  // lista resolvia um e não o outro, e o resultado era `@com.microteia.news/screen.plural` no painel,
  // ao lado de "Contratos" e "Prazos".
  const dynamicListEntries = useMemo<ScreenListEntry[]>(
    () => dynamicDefinitions.map((def) => ({
      key: def.id,
      icon: def.icon,
      title: label(def.titlePlural),
      meta: buildDynamicMeta(t, def, fieldsByScreen[def.id]?.length ?? 0),
      disabled: !def.enabled,
    })),
    [dynamicDefinitions, fieldsByScreen, t, label],
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
    (fields: FieldDefinition[]) => fields.map((field) => ({
      ...field,
      label: label(field.label),
      // A SEÇÃO e o PLACEHOLDER seguem a mesma regra do rótulo, e ficaram de fora na primeira vez: a
      // linha de meta do campo mostrava `@com.microteia.news/section.content` embaixo de "Título".
      section: field.section ? label(field.section) : field.section,
      placeholder: field.placeholder ? label(field.placeholder) : field.placeholder,
    })),
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
        title: label(def.titlePlural),
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
  }, [selectedKey, dynamicDefinitions, builtinRows, fieldsByScreen, t, label, forDisplay, extraFieldCount]);

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
  const updateEditWindowForm = useCallback((patch: Partial<EditWindowFormState>) => {
    setScreenForm((prev) => ({ ...prev, editWindow: { ...prev.editWindow, ...patch }, editWindowTouched: true }));
  }, []);

  const updateMemberVisibilityForm = useCallback((patch: Partial<MemberVisibilityFormState>) => {
    setScreenForm((prev) => ({
      ...prev,
      memberVisibility: { ...prev.memberVisibility, ...patch },
      memberVisibilityTouched: true,
    }));
  }, []);

  const updateScreenForm = useCallback((patch: Partial<ScreenFormState>) => {
    setScreenForm((prev) => {
      const next = { ...prev, ...patch };
      // Numa tela NOVA o identificador acompanha o título no plural até alguém encostar nele. Depois
      // disso ele é do usuário: sobrescrevê-lo apagaria a escolha a cada letra digitada no título.
      if (patch.titlePlural !== undefined && patch.screenKey === undefined && !screenKeyTouchedRef.current) {
        next.screenKey = slugifyFieldKey(patch.titlePlural);
      }
      if (patch.screenKey !== undefined) screenKeyTouchedRef.current = true;
      if (screenModalIsBuiltin || next.hasTags) return next;
      return { ...next, listActions: next.listActions.filter((a) => !tagDependentSlots.has(a)) };
    });
  }, [screenModalIsBuiltin, tagDependentSlots]);

  // O valor é o id da Ação; o rótulo é o título DELA — não o desta tela. Por isso resolve, mesmo aqui:
  // a regra do rótulo cru no Form Design vale para o que a tela edita, e uma Ação não é isso.
  const actionOptions = useMemo(
    () => actions.filter((action) => action.enabled).map((action) => ({ value: action.id, label: label(action.title) })),
    [actions, label],
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
      if (tagDependentSlots.has(action) && !screenModalIsBuiltin && !prev.hasTags) return prev;
      return {
        ...prev,
        listActions: prev.listActions.includes(action)
          ? prev.listActions.filter((a) => a !== action)
          : [...prev.listActions, action],
      };
    });
  }, [screenModalIsBuiltin, tagDependentSlots]);

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
    screenKeyTouchedRef.current = false;
    setScreenForm(EMPTY_SCREEN_FORM);
    setScreenModalTab('general');
    setScreenModal({ screenKey: null });
  }, []);

  const openEditScreen = useCallback((screenKey: string) => {
    screenKeyTouchedRef.current = true;
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
        screenKey,
        childLinks,
        listActions: resolveListActions(screenKey, def?.listActions),
        viewActionIds: def?.viewActionIds ?? [],
        cardActionIds: def?.cardActionIds ?? [],
      });
      setScreenModal({ screenKey });
      return;
    }
    setScreenForm({
      screenKey: def.id,
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
      imageFieldKey: def.imageFieldKey ?? '',
      portal: toPortalForm(def.portal),
      portalTouched: false,
      editWindow: toEditWindowForm(def.editWindow),
      editWindowTouched: false,
      memberVisibility: toMemberVisibilityForm(def.memberVisibility),
      memberVisibilityTouched: false,
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
        label: label(def.titlePlural),
        fieldOptions: def.fields
          .filter((field) => field.type === 'reference' && field.refEntity === currentCollection)
          .map((field) => ({ value: field.key, label: label(field.label) })),
      }))
      .filter((candidate) => candidate.fieldOptions.length > 0);
  }, [dynamicDefinitions, screenModal, getDefinitionByKey, label]);

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

  /**
   * O VALOR da opção é a chave do campo; o rótulo é lido por gente, então resolve. Sem isto o seletor
   * de campo-título listava `@com.microteia.news/field.title` como se fosse o nome do campo.
   *
   * O filtro exigia `required`, e uma tela sem NENHUM campo de texto obrigatório ficava sem lista —
   * o que, pelo antigo `titleFieldOptions.length > 0`, apagava também o subtítulo e a imagem. Ser
   * obrigatório é uma boa ideia para o campo que dá nome ao registro, não um requisito: quem não
   * tiver valor cai em "Sem título", que é o que `resolveRecordTitle` já faz. O valor JÁ GRAVADO
   * entra na lista mesmo que não passe pelo filtro, pelo mesmo motivo do subtítulo.
   */
  const titleFieldOptions = useMemo<SearchSelectOption[]>(() => {
    const current = screenForm.titleFieldKey;
    return modalScreenFields
      .filter((f) => f.type === 'text' || f.key === current)
      .map((f) => ({ value: f.key, label: label(f.label) }));
  }, [modalScreenFields, screenForm.titleFieldKey, label]);

  /**
   * O subtítulo aceita qualquer campo que caiba numa LINHA ao lado do título — inclusive seleção e
   * relação, que o cartão e o cabeçalho resolvem para o rótulo, e não para o id ou a chave. Ficam de
   * fora só o texto longo e o markdown, que não cabem, e o Sim/Não, que nada informa ali.
   *
   * O valor JÁ GRAVADO entra na lista mesmo quando não passa por esse filtro. O filtro governa a
   * escolha NOVA; o que já está declarado existe, e o `SearchSelect` chama de "Registro não
   * encontrado" todo valor que não acha entre as opções — era o que a tela de Notícias mostrava, com
   * ícone de alerta, por declarar um `textarea` como subtítulo. Informar que um campo existente não
   * existe é pior do que oferecê-lo: convida a "consertar" o que não está quebrado.
   */
  const subtitleFieldOptions = useMemo<SearchSelectOption[]>(() => {
    const fits = (field: FieldDefinition) =>
      field.type !== 'textarea' && field.type !== 'markdown' && field.type !== 'checkbox'
      && field.type !== 'file';
    const current = screenForm.subtitleFieldKey;
    return [
      { value: '', label: t('screen.subtitle-field.placeholder') },
      ...modalScreenFields
        .filter((f) => fits(f) || f.key === current)
        .map((f) => ({ value: f.key, label: label(f.label) })),
    ];
  }, [modalScreenFields, screenForm.subtitleFieldKey, t, label]);

  /**
   * A imagem do registro só pode vir de um campo de ARQUIVO: é ele que guarda uma URL. O valor já
   * gravado entra na lista mesmo que o campo tenha sido retipado depois, pelo mesmo motivo do
   * subtítulo — dizer que um campo existente não existe convida a "consertar" o que não quebrou.
   */
  const imageFieldOptions = useMemo<SearchSelectOption[]>(() => {
    const current = screenForm.imageFieldKey;
    return [
      { value: '', label: t('screen.image-field.placeholder') },
      ...modalScreenFields
        .filter((f) => f.type === 'file' || f.key === current)
        .map((f) => ({ value: f.key, label: label(f.label) })),
    ];
  }, [modalScreenFields, screenForm.imageFieldKey, t, label]);

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

  const gestureRows = useMemo(
    () => gestureRowsFrom(modalListActionOptions, screenForm.listActions),
    [modalListActionOptions, screenForm.listActions],
  );

  const moveListAction = useCallback((action: ScreenListAction, delta: -1 | 1) => {
    const visible = new Set(modalListActionOptions.map((option) => option.key));
    setScreenForm((prev) => ({ ...prev, listActions: moveListActionSlot(prev.listActions, visible, action, delta) }));
  }, [modalListActionOptions]);

  // Nas telas do sistema não há "Geral" (título, ícone e abas são fixos), e "Registros filhos"
  // só existe quando alguma tela aponta para esta.
  const screenModalTabs = useMemo<{ key: ScreenModalTab; label: string }[]>(() => [
    ...(screenModalIsBuiltin ? [] : [{ key: 'general' as const, label: t('screen.tab.general') }]),
    { key: 'actions' as const, label: t('screen.tab.actions') },
    ...(!!screenModal?.screenKey && childCandidates.length > 0
      ? [{ key: 'children' as const, label: t('screen.tab.children') }]
      : []),
    // O portal é decisão de EXPOSIÇÃO, e a regra a cobra de quem tem `portal.manage`; a aba segue a
    // regra. Só em tela que já existe: numa tela nova não há ainda campo a escolher.
    ...(!screenModalIsBuiltin && !!screenModal?.screenKey && canManagePortal
      ? [{ key: 'portal' as const, label: t('portal.tab') }]
      : []),
    // A janela é garantia de prova, e a regra a cobra de quem tem `screens.edit-window`; a aba segue a
    // regra. Vale também na criação: o primeiro registro já nasce sob o prazo.
    ...(!screenModalIsBuiltin && canManageEditWindow
      ? [{ key: 'editWindow' as const, label: t('screen.tab.edit-window') }]
      : []),
    // Restringir quem lê é decisão de SIGILO, e a regra a cobra de quem tem
    // `screens.member-visibility`; a aba segue a regra. Só em tela que já existe: é preciso um campo de
    // referência a membro para escolher.
    ...(!screenModalIsBuiltin && !!screenModal?.screenKey && canManageMemberVisibility
      ? [{ key: 'memberVisibility' as const, label: t('screen.tab.member-visibility') }]
      : []),
  ], [screenModalIsBuiltin, screenModal, childCandidates, canManagePortal, canManageEditWindow, canManageMemberVisibility, t]);

  /**
   * As opções da aba "Visibilidade dos registros". Os campos são só os de referência a membro — é o uid
   * que a regra compara. A supervisão começa pela DERIVADA da coleção (`<coleção>.read-all`, que o
   * catálogo passa a oferecer em Perfis assim que a restrição é gravada) e segue pelas permissões do
   * catálogo, para quem prefere uma que já concede.
   */
  const memberVisibilityPanel = useMemo(() => {
    const def = screenModal?.screenKey ? getDefinitionByKey(screenModal.screenKey) : undefined;
    const collection = def ? (def.dataCollection || def.id) : '';
    const fieldOptions = (def?.fields ?? [])
      .filter(isMemberReferenceField)
      .map((field) => ({ value: field.key, label: label(field.label) || field.key }));
    const derived = readAllPermissionId(collection);
    const bypassOptions = [
      { value: '', label: t('member-visibility.panel.bypass.derived'), meta: derived },
      ...catalog.list
        .filter((permission) => permission.id !== derived)
        .map((permission) => ({
          value: permission.id,
          label: label(permission.name),
          meta: permission.id,
        })),
    ];
    const issue = memberVisibilityFormIssue(screenForm.memberVisibility);
    return {
      fieldOptions,
      bypassOptions,
      issue: issue ? t(MEMBER_VISIBILITY_ISSUE_KEYS[issue], { max: String(MEMBER_VISIBILITY_MAX_FIELDS) }) : null,
      maxFields: MEMBER_VISIBILITY_MAX_FIELDS,
    };
  }, [screenModal, getDefinitionByKey, catalog, screenForm.memberVisibility, label, t]);

  const portalPanel = useMemo(() => {
    const def = screenModal?.screenKey ? getDefinitionByKey(screenModal.screenKey) : undefined;
    const fields = def?.fields ?? [];
    const asPortalScreen = (one: ScreenDefinition, portal = one.portal): PortalScreenLike => ({
      id: one.id,
      collection: one.dataCollection || one.id,
      titleFieldKey: one.titleFieldKey,
      fields: one.fields,
      parentEntity: one.parentEntity,
      parentFieldKey: one.parentFieldKey,
      portal,
    });
    const declaration = fromPortalForm(screenForm.portal);
    const issues = def && declaration
      ? portalDeclarationIssues(
        asPortalScreen(def, declaration),
        definitions.map((one) => (one.id === def.id ? asPortalScreen(one, declaration) : asPortalScreen(one))),
      ).map((issue) => {
        const params = { ...issue.messageParams };
        const screenRef = params.screen ? definitions.find((one) => one.id === params.screen) : undefined;
        if (screenRef) params.screen = label(screenRef.titlePlural);
        if (params.field) params.field = label(fields.find((one) => one.key === params.field)?.label ?? params.field);
        return label(issue.message, params);
      })
      : [];
    const linkField = screenForm.portal.subjectKind === 'field'
      ? screenForm.portal.subjectField
      : screenForm.portal.subjectKind === 'parent' ? def?.parentFieldKey ?? '' : '';
    return {
      fieldOptions: fields.map((field) => ({ value: field.key, label: label(field.label) })),
      createFieldOptions: fields
        .filter((field) => field.key !== linkField)
        .map((field) => ({ value: field.key, label: label(field.label) })),
      documentTypeOptions: documentTypes.map((option) => ({ value: option.key, label: label(option.label) })),
      referenceFieldOptions: fields
        .filter((field) => field.type === 'reference' && !!field.refEntity)
        .map((field) => ({ value: field.key, label: label(field.label) })),
      editFieldOptions: fields
        .filter((field) => field.key !== linkField && screenForm.portal.fields.includes(field.key))
        .map((field) => ({ value: field.key, label: label(field.label) })),
      hasParent: !!def?.parentEntity && !!def.parentFieldKey,
      hasDocuments: !!def?.hasDocuments,
      readOnly: def?.managed === true,
      issues,
      collection: def ? def.dataCollection || def.id : '',
    };
  }, [screenModal, getDefinitionByKey, definitions, screenForm.portal, label, documentTypes]);

  const updatePortal = useCallback((patch: Partial<PortalFormState>) => {
    setScreenForm((prev) => ({ ...prev, portal: { ...prev.portal, ...patch }, portalTouched: true }));
  }, []);
  const setPortalEnabled = useCallback((enabled: boolean) => updatePortal({ enabled }), [updatePortal]);
  const setPortalSubjectKind = useCallback((subjectKind: PortalSubjectKind) => updatePortal({ subjectKind }), [updatePortal]);
  const setPortalSubjectField = useCallback((subjectField: string) => updatePortal({ subjectField }), [updatePortal]);
  const setPortalVisibleWhen = useCallback((visibleWhen: string) => updatePortal({ visibleWhen }), [updatePortal]);
  const setPortalDocuments = useCallback((documents: boolean) => updatePortal({ documents }), [updatePortal]);
  const setPortalAllowUploads = useCallback((allowUploads: boolean) => updatePortal({ allowUploads }), [updatePortal]);
  const togglePortalUploadType = useCallback((typeKey: string, allowed: boolean) => {
    setScreenForm((prev) => ({
      ...prev,
      portalTouched: true,
      portal: {
        ...prev.portal,
        uploadTypes: allowed
          ? [...new Set([...prev.portal.uploadTypes, typeKey])]
          : prev.portal.uploadTypes.filter((key) => key !== typeKey),
      },
    }));
  }, []);
  const setPortalAllowEdit = useCallback((allowEdit: boolean) => updatePortal({ allowEdit }), [updatePortal]);
  const setPortalEditWhen = useCallback((editWhen: string) => updatePortal({ editWhen }), [updatePortal]);
  const setPortalEditOnlyOwn = useCallback((editOnlyOwn: boolean) => updatePortal({ editOnlyOwn }), [updatePortal]);
  const setPortalNotifyOffice = useCallback((notifyOffice: boolean) => updatePortal({ notifyOffice }), [updatePortal]);
  const setPortalAutomationInvites = useCallback(
    (automationInvites: boolean) => updatePortal({ automationInvites }),
    [updatePortal],
  );
  const setPortalDocumentLinks = useCallback((documentLinks: boolean) => updatePortal({ documentLinks }), [updatePortal]);
  const setPortalDocumentLinkMinutes = useCallback(
    (documentLinkMinutes: string) => updatePortal({ documentLinkMinutes }),
    [updatePortal],
  );
  const togglePortalEditField = useCallback((fieldKey: string, editable: boolean) => {
    setScreenForm((prev) => ({
      ...prev,
      portalTouched: true,
      portal: {
        ...prev.portal,
        editFields: editable
          ? [...new Set([...prev.portal.editFields, fieldKey])]
          : prev.portal.editFields.filter((key) => key !== fieldKey),
      },
    }));
  }, []);
  const setPortalAllowCreate = useCallback((allowCreate: boolean) => updatePortal({ allowCreate }), [updatePortal]);
  const togglePortalCreateField = useCallback((fieldKey: string, fillable: boolean) => {
    setScreenForm((prev) => ({
      ...prev,
      portalTouched: true,
      portal: {
        ...prev.portal,
        createFields: fillable
          ? [...new Set([...prev.portal.createFields, fieldKey])]
          : prev.portal.createFields.filter((key) => key !== fieldKey),
      },
    }));
  }, []);
  const togglePortalField = useCallback((fieldKey: string, exposed: boolean) => {
    setScreenForm((prev) => ({
      ...prev,
      portalTouched: true,
      portal: {
        ...prev.portal,
        fields: exposed
          ? [...new Set([...prev.portal.fields, fieldKey])]
          : prev.portal.fields.filter((key) => key !== fieldKey),
      },
    }));
  }, []);

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
      const label = childCandidates.find((c) => c.key === childMissingField[0])?.label ?? t('screen.fallback');
      setScreenModalTab('children');
      notify(t('screen.error.link-field-required', { label }), 'error');
      return;
    }
    const editWindowChanged = canManageEditWindow && screenForm.editWindowTouched;
    if (editWindowChanged && !editWindowFormIsValid(screenForm.editWindow)) {
      setScreenModalTab('editWindow');
      notify(t('edit-window.panel.minutes-invalid'), 'error');
      return;
    }
    const editWindowValue = editWindowChanged ? fromEditWindowForm(screenForm.editWindow) : undefined;
    const memberVisibilityChanged = canManageMemberVisibility && screenForm.memberVisibilityTouched;
    if (memberVisibilityChanged && memberVisibilityPanel.issue) {
      setScreenModalTab('memberVisibility');
      notify(memberVisibilityPanel.issue, 'error');
      return;
    }
    const memberVisibilityValue = memberVisibilityChanged
      ? fromMemberVisibilityForm(screenForm.memberVisibility)
      : undefined;
    const portalChanged = canManagePortal && screenForm.portalTouched && !portalPanel.readOnly;
    if (portalChanged && screenForm.portal.enabled && portalPanel.issues.length > 0) {
      setScreenModalTab('portal');
      notify(portalPanel.issues[0], 'error');
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
        notify(t('screen.children-updated'), 'success');
        setScreenModal(null);
        return;
      }
      // Etiquetas ligadas EXIGEM coleção: é ela que sobrevive à exclusão da tela e o que duas telas
      // apontam em comum para compartilhá-las. Na criação, o nome sai da chave que a tela vai
      // receber — a mesma derivação do ramo de baixo.
      const screenKeyForTags = screenModal?.screenKey
        ?? newScreenKeyOf(artifactPrefix, screenForm.screenKey, screenForm.titlePlural, new Set([
          ...definitions.map((def) => def.id),
          ...BUILTIN_SCREENS.map((b) => b.key),
          ...RESERVED_COLLECTIONS,
        ])).key;
      const requestedTagCollection = screenForm.hasTags
        ? (screenForm.tagCollection.trim() || derivedTagCollection(screenKeyForTags))
        : (screenForm.tagCollection.trim() || null);
      // Um conjunto que já existe é escolha de compartilhar, e vai como está; um NOVO nasce com o prefixo.
      const tagCollection = requestedTagCollection && !schemaContext.tagLists.has(requestedTagCollection)
        ? withArtifactPrefix(artifactPrefix, 'collection', requestedTagCollection)
        : requestedTagCollection;
      const isNewTagList = !!tagCollection && !schemaContext.tagLists.has(tagCollection);
      if (isNewTagList) {
        const issue = tagListIdIssue(tagCollection as string, schemaContext);
        if (issue) {
          notify(label(issue.message, issue.messageParams), 'error');
          return;
        }
      }

      if (isNewTagList) {
        // Só o que o escritório digitou: a palavra "Etiquetas" viria de nós e ficaria presa em
        // português dentro de um dado do tenant. Quem a compõe é o rótulo DERIVADO
        // (`screenTagCollections` → `@core.records/tag-list.of`), que traduz e acompanha o nome da tela.
        await declareTagList(tagCollection as string, screenForm.titlePlural.trim());
      }

      if (screenModal?.screenKey) {
        const def = getDefinitionByKey(screenModal.screenKey);
        if (!def) return;
        const titleFieldKey = def.origin === 'builtin' ? '' : (screenForm.titleFieldKey || def.titleFieldKey);
        const subtitleFieldKey = def.origin === 'builtin' ? null : (screenForm.subtitleFieldKey || null);
        const imageFieldKey = def.origin === 'builtin' ? null : (screenForm.imageFieldKey || null);
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
          imageFieldKey,
          // Só quando a aba foi tocada: regravar o que foi lido mudaria a forma do valor, e a regra
          // cobraria `portal.manage` de quem só mexeu no título.
          ...(portalChanged ? { portal: fromPortalForm(screenForm.portal) } : {}),
          ...(editWindowValue !== undefined ? { editWindow: editWindowValue } : {}),
          ...(memberVisibilityValue !== undefined ? { memberVisibility: memberVisibilityValue } : {}),
        });

        // A regra lê a janela e a visibilidade do documento da COLEÇÃO. Numa tela que descreve outra
        // (`dataCollection`), gravar só nela deixaria a declaração no formulário e fora da regra.
        const ruleDeclarations = {
          ...(editWindowValue !== undefined ? { editWindow: editWindowValue } : {}),
          ...(memberVisibilityValue !== undefined ? { memberVisibility: memberVisibilityValue } : {}),
        };
        const ruleDocument = Object.keys(ruleDeclarations).length > 0 && def.dataCollection && def.dataCollection !== def.id
          ? getDefinitionByKey(def.dataCollection)
          : undefined;
        if (ruleDocument) {
          await saveDefinition(ruleDocument.id, { ...toSaveInput(ruleDocument), ...ruleDeclarations });
        }

        await persistChildLinks(def.id);

        notify(t('screen.updated'), 'success');
      } else {
        // A chave da tela É o nome da coleção no Firestore: não pode colidir com outra tela nem
        // com uma coleção de sistema.
        const existingKeys = new Set([
          ...definitions.map((def) => def.id),
          ...BUILTIN_SCREENS.map((b) => b.key),
          ...RESERVED_COLLECTIONS,
        ]);
        // O identificador é do USUÁRIO quando ele o informa: colidir com uma tela existente é
        // recusado em vez de silenciosamente virar `pet1_2` — quem escolheu o nome precisa saber
        // que ele já estava tomado.
        const { key: screenKey, typed } = newScreenKeyOf(artifactPrefix, screenForm.screenKey, screenForm.titlePlural, existingKeys);
        if (typed && existingKeys.has(screenKey)) {
          setScreenModalTab('general');
          notify(t('screen.error.key-taken', { key: screenKey }), 'error');
          return;
        }
        const keyIssue = screenIdIssue(screenKey, schemaContext);
        if (keyIssue) {
          setScreenModalTab('general');
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
          ...(editWindowValue ? { editWindow: editWindowValue } : {}),
        });
        notify(t('screen.created'), 'success');
        setSelectedKeyState(screenKey);
      }
      setScreenModal(null);
    } catch (err) {
      console.error('[ScreenBuilder handleSaveScreen]', err);
      notify(t('screen.save-failed'), 'error');
    } finally {
      setSavingScreen(false);
    }
  }, [artifactPrefix, screenForm, screenModal, getDefinitionByKey, saveDefinition, definitions, dynamicDefinitions, childCandidates, persistChildLinks, notify, schemaContext, declareTagList, t, label, canManagePortal, portalPanel, canManageEditWindow, canManageMemberVisibility, memberVisibilityPanel]);

  const toggleScreenEnabled = useCallback(async (screenKey: string) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    try {
      await saveDefinition(def.id, { ...toSaveInput(def), enabled: !def.enabled });
      notify(t(def.enabled ? 'screen.deactivated' : 'screen.activated'), 'success');
    } catch {
      notify(t('screen.toggle-failed'), 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify, t]);

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
      notify(t('screen.reorder-failed'), 'error');
    }
  }, [dynamicDefinitions, saveDefinition, notify, t]);

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
      notify(label(err instanceof Error ? err.message : t('screen.delete-failed'), errorParamsOf(err)), 'error');
    } finally {
      setDeletingScreen(false);
    }
  }, [deleteScreenTarget, deleteDefinition, notify, t, label]);

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
      unique: field.unique === true,
      ...fieldRulesToForm(field.rules),
      ...fieldLogicToForm(field.logic),
      ...fieldAggregationToForm(field.aggregation),
      ...fieldFileToForm(field.file),
      sequence: toFieldSequenceForm(field.autoValue),
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

  const fieldSupportsFilter = fieldForm.type !== 'file';

  /**
   * Chave sobre um campo cujo valor NÃO fica gravado é reserva órfã: `logic.derive` é avaliado na
   * leitura e removido de todo caminho de escrita, e a agregação é recalculada pelo servidor a cada
   * gravação de filho — uma unicidade sobre ela recusaria a gravação de um filho, num campo que a
   * pessoa nem edita. Arquivo fica de fora porque o valor gravado é uma URL, diferente a cada upload
   * do mesmo arquivo: a chave nunca acusaria a repetição que alguém espera dela.
   */
  const fieldSupportsUnique = fieldForm.type !== 'file'
    && !fieldForm.logicDerive.trim()
    && !(fieldForm.aggregationFrom.trim() && fieldForm.aggregationVia.trim());

  /**
   * O número é do sistema, e um campo cujo valor vem de outro lugar — calculado, derivado, agregado —
   * não pode ser numerado ao mesmo tempo: as duas origens disputariam o mesmo valor.
   */
  const fieldSupportsSequence = fieldTypeSupportsSequence(fieldForm.type)
    && !fieldForm.logicCompute.trim()
    && !fieldForm.logicDerive.trim()
    && !(fieldForm.aggregationFrom.trim() && fieldForm.aggregationVia.trim());

  /**
   * A numeração GRAVADA não muda pelo Form Design. Mudar o formato, o recomeço ou o escopo depois de
   * números emitidos poderia emitir de novo um valor que já existe (`2026/000001` contado por ano e
   * depois contado para sempre recomeça do 1). Numerar de outro jeito é outro campo.
   */
  const sequenceLocked = useMemo(() => {
    if (!fieldModal?.fieldKey) return false;
    const saved = resolvedField(fieldModal.screenKey, fieldModal.fieldKey);
    return saved !== undefined && isSequenceField(saved);
  }, [fieldModal, resolvedField]);

  const sequenceHasParent = useMemo(
    () => !!(fieldModal && getDefinitionByKey(fieldModal.screenKey)?.parentFieldKey),
    [fieldModal, getDefinitionByKey],
  );

  const [sequenceExampleYear] = useState(() => new Date().getFullYear());

  const sequencePanel = useMemo<FieldSequencePanelState>(() => ({
    locked: sequenceLocked,
    numeric: fieldForm.type === 'number',
    hasParent: sequenceHasParent,
    preview: fieldSequencePreview(fieldForm.sequence, fieldForm.type, sequenceExampleYear),
    scopeOptions: [
      { value: 'tenant', label: t('field.sequence.scope.tenant') },
      { value: 'parent', label: t('field.sequence.scope.parent') },
    ],
    resetOptions: [
      { value: 'year', label: t('field.sequence.reset.year') },
      { value: 'never', label: t('field.sequence.reset.never') },
    ],
  }), [sequenceLocked, sequenceHasParent, fieldForm.sequence, fieldForm.type, sequenceExampleYear, t]);

  const updateFieldSequence = useCallback((patch: Partial<FieldSequenceFormState>) => {
    setFieldForm((prev) => ({ ...prev, sequence: { ...prev.sequence, ...patch } }));
  }, []);

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
    () => availableLookups.map((lookup) => ({
      value: lookup.collection,
      label: `${label(lookup.label, lookup.labelParams)} (${lookup.collection})`,
    })),
    [availableLookups, label],
  );

  const tagListOptions = useMemo<SearchSelectOption[]>(
    () => availableTagLists.map((tagList) => ({
      value: tagList.collection,
      // O rótulo da lista é uma REFERÊNCIA, e ela resolve ANTES de entrar na composição, com os
      // próprios parâmetros. Passá-la crua como parâmetro faria os irmãos descerem para dentro de uma
      // mensagem de OUTRO namespace, cujos nomes de token não são nossos: `tag-list.of` também
      // interpola `{name}`, e a resolução voltava à mesma chave até estourar a pilha.
      label: t('tag-list.option', {
        name: label(tagList.label, tagList.labelParams),
        collection: tagList.collection,
      }),
    })),
    [availableTagLists, t, label],
  );

  const suggestedTagCollection = useMemo(
    () => withArtifactPrefix(
      artifactPrefix,
      'collection',
      derivedTagCollection(screenModal?.screenKey || slugifyFieldKey(screenForm.titlePlural.trim())),
    ),
    [screenModal, screenForm.titlePlural, artifactPrefix],
  );

  const suggestedLookupCollection = useMemo(() => {
    if (!fieldModal) return '';
    const key = fieldModal.fieldKey || fieldForm.fieldKey.trim() || slugifyFieldKey(fieldForm.label.trim());
    return key ? withArtifactPrefix(artifactPrefix, 'collection', derivedLookupCollection(fieldModal.screenKey, key)) : '';
  }, [fieldModal, fieldForm.fieldKey, fieldForm.label, artifactPrefix]);

  // Os agregados falam de COLEÇÕES: o `from` é a coleção dos filhos e o vínculo deles aponta para a
  // coleção desta tela. Numa tela ligada (`processos` sobre `cases`), comparar com a chave da tela
  // não acharia vínculo nenhum.
  const aggregationParentCollection = useMemo(() => {
    const key = fieldModal?.screenKey;
    if (!key) return null;
    const owner = getDefinitionByKey(key);
    return owner ? screenDataCollection(owner) : key;
  }, [fieldModal, getDefinitionByKey]);

  // Só faz sentido agregar de uma tela que aponte de volta para esta: é o vínculo pai/filho que
  // define quais registros pertencem ao agregado.
  const aggregationChildScreens = useMemo(
    () => {
      const key = fieldModal?.screenKey;
      if (!key || !aggregationParentCollection) return [];
      return dynamicScreens.filter(
        (def) => def.id !== key
          && def.fields.some((f) => f.type === 'reference' && f.refEntity === aggregationParentCollection),
      );
    },
    [dynamicScreens, fieldModal, aggregationParentCollection],
  );

  const aggregationChildScreen = useMemo(
    () => aggregationChildScreens.find((def) => screenDataCollection(def) === fieldForm.aggregationFrom) ?? null,
    [aggregationChildScreens, fieldForm.aggregationFrom],
  );

  const aggregationFromOptions = useMemo<SearchSelectOption[]>(() => {
    const byCollection = new Map<string, SearchSelectOption>();
    for (const def of aggregationChildScreens) {
      const collection = screenDataCollection(def);
      if (!byCollection.has(collection)) byCollection.set(collection, { value: collection, label: def.titlePlural });
    }
    return [{ value: '', label: t('field.aggregation.none') }, ...byCollection.values()];
  }, [aggregationChildScreens, t]);

  const aggregationViaOptions = useMemo<SearchSelectOption[]>(
    () => (aggregationChildScreen?.fields ?? [])
      .filter((f) => f.type === 'reference' && f.refEntity === aggregationParentCollection)
      .map((f) => ({ value: f.key, label: f.label })),
    [aggregationChildScreen, aggregationParentCollection],
  );

  // `latest` copia o valor: o filho oferecido é o que grava a mesma forma que este campo. As demais
  // operações calculam, e só um número entra nelas.
  const aggregationFieldOptions = useMemo<SearchSelectOption[]>(() => {
    const parent = formAggregationShape(fieldForm);
    return (aggregationChildScreen?.fields ?? [])
      .filter((f) => fieldForm.aggregationOp === 'latest'
        ? !f.logic?.derive && aggregationTypesCompatible(parent, f)
        : f.type === 'number' || f.type === 'currency')
      .map((f) => ({ value: f.key, label: f.label }));
  }, [aggregationChildScreen, fieldForm]);

  const aggregationOrderOptions = useMemo<SearchSelectOption[]>(() => {
    const systemLabels: Record<string, string> = {
      createdAt: t('field.aggregation.order.created-at'),
      updatedAt: t('field.aggregation.order.updated-at'),
    };
    return [
      ...(aggregationChildScreen?.fields ?? [])
        .filter((f) => !f.logic?.derive)
        .map((f) => ({ value: f.key, label: f.label })),
      ...AGGREGATION_ORDER_SYSTEM_KEYS.map((key) => ({ value: key, label: systemLabels[key] ?? key })),
    ];
  }, [aggregationChildScreen, t]);

  const aggregationDirOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: 'desc', label: t('field.aggregation.order.desc') },
      { value: 'asc', label: t('field.aggregation.order.asc') },
    ],
    [t],
  );

  const addAggregationOrder = useCallback(() => {
    setFieldForm((prev) => ({
      ...prev,
      aggregationOrderBy: [...prev.aggregationOrderBy, { path: '', dir: 'desc' }],
    }));
  }, []);

  const updateAggregationOrder = useCallback((index: number, patch: { path?: string; dir?: string }) => {
    setFieldForm((prev) => ({
      ...prev,
      aggregationOrderBy: prev.aggregationOrderBy.map((order, position) =>
        position === index
          ? {
              path: patch.path ?? order.path,
              dir: patch.dir === undefined ? order.dir : patch.dir === 'asc' ? 'asc' : 'desc',
            }
          : order),
    }));
  }, []);

  const removeAggregationOrder = useCallback((index: number) => {
    setFieldForm((prev) => ({
      ...prev,
      aggregationOrderBy: prev.aggregationOrderBy.filter((_, position) => position !== index),
    }));
  }, []);

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
    () => Object.entries(AGGREGATION_OP_LABELS).map(([value, text]) => ({ value, label: label(text) })),
    [label],
  );

  // O filtro é avaliado sobre o FILHO: as sugestões são os campos da tela filha, não desta.
  const aggregationFilterVariables = useMemo<WorkflowVariable[]>(
    () => (aggregationChildScreen?.fields ?? []).map((f) => ({ name: f.key, definedBy: f.label })),
    [aggregationChildScreen],
  );

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

  // O nome reservado VENCE um campo de mesma chave no escopo, então ele também substitui a entrada
  // do campo aqui — duas sugestões `isNew` diriam que existem duas coisas com esse nome.
  const fieldUiExpressionVariables = useMemo<WorkflowVariable[]>(() => {
    if (fieldExpressionVariables.length === 0) return [];
    const definedBy: Record<(typeof FIELD_UI_RESERVED_VARIABLES)[number], string> = {
      isNew: t('field.expression.is-new'),
      isDirty: t('field.expression.is-dirty'),
    };
    const reserved = new Set<string>(FIELD_UI_RESERVED_VARIABLES);
    return [
      ...fieldExpressionVariables.filter((variable) => !reserved.has(variable.name)),
      ...FIELD_UI_RESERVED_VARIABLES.map((name) => ({ name, definedBy: definedBy[name] })),
    ];
  }, [fieldExpressionVariables, t]);

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
      reject('general', t('field.error.label-required'));
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
    const requestedLookupCollection = fieldForm.type === 'select' && fieldForm.optionsAllowUserAdd
      ? (fieldForm.lookupCollection.trim() || derivedLookupCollection(fieldModal.screenKey, fieldKeyForLookup))
      : (fieldForm.lookupCollection.trim() || null);
    // Uma lista que já existe é escolha de compartilhar, e vai como está; uma NOVA nasce com o prefixo.
    const lookupCollection = requestedLookupCollection && !schemaContext.lookups.has(requestedLookupCollection)
      ? withArtifactPrefix(artifactPrefix, 'collection', requestedLookupCollection)
      : requestedLookupCollection;
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
      reject('general', t('field.error.linked-screen-required'));
      return;
    }
    if (fieldForm.type === 'file') {
      const extensions = fieldForm.fileExtensions.trim();
      if (extensions && !/^[A-Za-z0-9]+(\s*,\s*[A-Za-z0-9]+)*$/.test(extensions)) {
        reject('general', t('field.error.file-extensions'));
        return;
      }
      const size = fieldForm.fileMaxSizeMb.trim();
      const parsed = Number(size);
      if (size && (!Number.isFinite(parsed) || parsed <= 0 || parsed > DEFAULT_FILE_MAX_SIZE_MB)) {
        reject('general', t('field.error.file-max-size', { max: String(DEFAULT_FILE_MAX_SIZE_MB) }));
        return;
      }
    }
    if (isInvalidRegex(fieldForm.ruleValidatePattern)) {
      reject('advanced', t('field.error.validate-regex'));
      return;
    }
    const minLength = parseLengthLimit(fieldForm.ruleValidateMinLength);
    const maxLength = parseLengthLimit(fieldForm.ruleValidateMaxLength);
    if (
      isInvalidLengthLimit(fieldForm.ruleValidateMinLength)
      || isInvalidLengthLimit(fieldForm.ruleValidateMaxLength)
      || (minLength !== undefined && maxLength !== undefined && minLength > maxLength)
    ) {
      reject('advanced', t('field.error.length-limit'));
      return;
    }
    if (isInvalidRegex(fieldForm.ruleFormatPattern)) {
      reject('advanced', t('field.error.format-regex'));
      return;
    }
    const editedKey = fieldModal.fieldKey ?? (fieldForm.fieldKey.trim() || slugifyFieldKey(fieldLabel));
    const screenFields = getDefinitionByKey(fieldModal.screenKey)?.fields ?? [];
    if (fieldForm.logicCompute.trim() && fieldForm.logicDerive.trim()) {
      reject('advanced', t('field.error.derive-and-compute'));
      return;
    }
    if (fieldForm.logicCompute.trim()) {
      if (findExpressionCycle(screenFields, editedKey, fieldForm.logicCompute.trim(), 'compute')) {
        reject('advanced', t('field.error.compute-cycle'));
        return;
      }
      const derivedDependency = derivedKeyIn(
        screenFields,
        extractFieldExpressionDependencies(fieldForm.logicCompute.trim()),
      );
      if (derivedDependency) {
        reject('advanced', t('field.error.compute-needs-stored', { field: derivedDependency }));
        return;
      }
    }
    if (
      fieldForm.logicDerive.trim() &&
      findExpressionCycle(screenFields, editedKey, fieldForm.logicDerive.trim(), 'derive')
    ) {
      reject('advanced', t('field.error.derive-cycle'));
      return;
    }
    const aggregation = buildFieldAggregation(fieldForm);
    if (aggregation) {
      if (aggregation.op !== 'count' && !aggregation.field) {
        reject('advanced', t('field.error.aggregation-field'));
        return;
      }
      if (aggregationCreatesCycle(schemaContext, aggregationParentCollection ?? fieldModal.screenKey, aggregation.from)) {
        reject('advanced', t('field.error.aggregation-cycle'));
        return;
      }
      const childFields = (aggregationChildScreen ?? getDefinitionByKey(aggregation.from))?.fields ?? [];
      const orderKeys = (aggregation.orderBy ?? []).map((order) => order.path);
      const derivedKey = derivedKeyIn(childFields, [aggregation.field ?? '', ...orderKeys].filter(Boolean));
      if (derivedKey) {
        reject('advanced', t('field.error.aggregation-needs-stored', { field: derivedKey }));
        return;
      }
      const [shapeIssue] = fieldAggregationIssues(aggregation, formAggregationShape(fieldForm), childFields);
      if (shapeIssue) {
        reject('advanced', label(shapeIssue.message, shapeIssue.messageParams));
        return;
      }
    }
    const rules = buildFieldRules(fieldForm);
    const logic = buildFieldLogic(fieldForm);
    const file = buildFieldFileConfig(fieldForm);
    // Um campo de arquivo não filtra, e o `filterable` é zerado no dado e não só escondido na tela:
    // um pacote — ou um documento editado à mão — ainda pode trazê-lo verdadeiro.
    const filterable = fieldForm.type === 'file' ? false : fieldForm.filterable;
    // Uma chave sobre um campo DERIVADO reservaria um valor que o registro não carrega — o derivado
    // é avaliado na leitura e nunca gravado —, e a reserva ficaria órfã na leitura seguinte. O valor
    // é zerado no dado, e não só escondido: o campo pode ter virado derivado depois de marcado.
    const unique = fieldSupportsUnique ? fieldForm.unique : false;
    // A numeração só é escrita quando a pessoa a liga agora. A já gravada viaja como está (o campo é
    // espalhado), e o `autoValue` de sorteio que uma extensão declarou não é tocado.
    let sequenceChange: { autoValue?: ReturnType<typeof fromFieldSequenceForm> } = {};
    if (!sequenceLocked && fieldSupportsSequence && fieldForm.sequence.enabled) {
      const issue = fieldSequenceFormIssue(fieldForm.sequence, fieldForm.type, sequenceHasParent);
      if (issue) {
        reject('general', t(SEQUENCE_ISSUE_KEYS[issue]));
        return;
      }
      sequenceChange = { autoValue: fromFieldSequenceForm(fieldForm.sequence, fieldForm.type) };
    }
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
            filterable,
            unique,
            rules,
            logic,
            aggregation,
            file,
            ...sequenceChange,
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
          filterable,
          unique,
          rules,
          aggregation,
          logic,
          file,
          ...sequenceChange,
        }];
      }
      // A declaração vem ANTES do campo: é ela que as Security Rules consultam para autorizar a
      // primeira opção que o usuário cadastrar na coleção.
      if (isNewLookup) {
        await declareLookup(lookupCollection as string, fieldLabel);
      }
      await saveDefinition(fieldModal.screenKey, { ...baseInput, fields: nextFields });
      notify(t(fieldModal.fieldKey ? 'field.updated' : 'field.created'), 'success');
      setFieldModal(null);
    } catch {
      notify(t('field.save-failed'), 'error');
    } finally {
      setSavingField(false);
    }
  }, [artifactPrefix, fieldModal, fieldForm, fieldModalIsTitleField, fieldSupportsUnique, fieldSupportsSequence, sequenceLocked, sequenceHasParent, getDefinitionByKey, saveDefinition, notify, schemaContext, resolvedField, resolvedFieldsByScreen, declareLookup, t, label, aggregationParentCollection, aggregationChildScreen]);

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
      notify(t('field.reorder-failed'), 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify, t]);

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
      notify(t('field.restore-failed'), 'error');
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
      notify(t('field.delete-failed'), 'error');
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
    artifactPrefix,
    screenModalIsBuiltin,
    gestureRows,
    actionOptions,
    setScreenViewActionIds,
    setScreenCardActionIds,
    screenModalTabs,
    updateEditWindowForm,
    editWindowFromExtension: !!screenModal?.screenKey && getDefinitionByKey(screenModal.screenKey)?.managed === true,
    memberVisibilityPanel,
    updateMemberVisibilityForm,
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
    moveListAction,
    titleFieldOptions,
    subtitleFieldOptions,
    imageFieldOptions,
    childCandidates,
    portalPanel,
    setPortalEnabled,
    setPortalSubjectKind,
    setPortalSubjectField,
    togglePortalField,
    setPortalVisibleWhen,
    setPortalDocuments,
    setPortalAllowCreate,
    togglePortalCreateField,
    setPortalAllowUploads,
    togglePortalUploadType,
    setPortalAllowEdit,
    togglePortalEditField,
    setPortalEditWhen,
    setPortalEditOnlyOwn,
    setPortalNotifyOffice,
    setPortalAutomationInvites,
    setPortalDocumentLinks,
    setPortalDocumentLinkMinutes,
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
    fieldUiExpressionVariables,
    typeOptions,
    maskOptions,
    formatPresetOptions,
    validateCheckOptions,
    fieldSupportsRules,
    fieldSupportsFilter,
    fieldSupportsUnique,
    fieldSupportsSequence,
    sequencePanel,
    updateFieldSequence,
    fileMaxSizeDefault: String(DEFAULT_FILE_MAX_SIZE_MB),
    refEntityOptions,
    lookupOptions,
    tagListOptions,
    suggestedTagCollection,
    suggestedLookupCollection,
    aggregationFromOptions,
    aggregationViaOptions,
    aggregationOrderOptions,
    aggregationDirOptions,
    addAggregationOrder,
    updateAggregationOrder,
    removeAggregationOrder,
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
