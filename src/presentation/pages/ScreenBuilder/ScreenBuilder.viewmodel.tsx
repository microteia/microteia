import { useCallback, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { useTenant } from '../../../stores/useTenant';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import type { ScreenDefinitionSaveInput } from '../../../stores/useScreenDefinitions';
import { useNotification } from '../../../stores/useNotification';
import { ensureUniqueKey, slugifyFieldKey, sortFieldsByOrder, validateFieldKey } from '../../../domain/services/customFieldValues';
import { getDefaultTagColor } from '../../../shared/styles/colorUtils';
import { getScreenIconOptions } from '../../shared/screenIcons';
import type { CustomFieldMask, CustomFieldType, FieldDefinition, ScreenDefinition } from '../../../domain/entities';
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

export interface ScreenFormState {
  titleSingular: string;
  titlePlural: string;
  icon: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  hasTags: boolean;
  enabled: boolean;
  titleFieldKey: string;
}

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
}

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
  screenForm: ScreenFormState;
  updateScreenForm: (patch: Partial<ScreenFormState>) => void;
  titleFieldOptions: SearchSelectOption[];
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
  fieldModalIsEdit: boolean;
  fieldModalIsTitleField: boolean;
  fieldForm: FieldFormState;
  updateFieldForm: (patch: Partial<FieldFormState>) => void;
  typeOptions: SearchSelectOption[];
  maskOptions: SearchSelectOption[];
  refEntityOptions: SearchSelectOption[];
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
};

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
    sidebarOrder: 0,
    enabled: true,
  };
};

export const useScreenBuilderViewModel = (): ScreenBuilderViewModel => {
  const { tenantRole } = useTenant();
  const { definitions, dynamicScreens, isLoading, saveDefinition, deleteDefinition } = useScreenDefinitions();
  const { notify } = useNotification();
  const theme = useTheme();

  const isAdmin = tenantRole === 'admin';
  const tagColors = theme.tagColors;
  const defaultTagColor = useMemo(() => getDefaultTagColor(theme), [theme]);

  const [screenModal, setScreenModal] = useState<{ screenKey: string | null } | null>(null);
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

  const updateScreenForm = useCallback((patch: Partial<ScreenFormState>) => {
    setScreenForm((prev) => ({ ...prev, ...patch }));
  }, []);

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
    setScreenModal({ screenKey: null });
  }, []);

  const openEditScreen = useCallback((screenKey: string) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    setScreenForm({
      titleSingular: def.titleSingular,
      titlePlural: def.titlePlural,
      icon: def.icon,
      hasNotes: def.hasNotes,
      hasDocuments: def.hasDocuments,
      hasTags: def.hasTags,
      enabled: def.enabled,
      titleFieldKey: def.titleFieldKey,
    });
    setScreenModal({ screenKey });
  }, [getDefinitionByKey]);

  const closeScreenModal = useCallback(() => setScreenModal(null), []);

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

  const handleSaveScreen = useCallback(async () => {
    if (!screenForm.titleSingular.trim() || !screenForm.titlePlural.trim()) {
      notify('Informe o título no singular e no plural.', 'error');
      return;
    }
    setSavingScreen(true);
    try {
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
          enabled: screenForm.enabled,
          titleFieldKey,
        });
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
          sidebarOrder: maxOrder + 1,
          enabled: true,
        });
        notify('Tela criada com sucesso! Um campo "Nome" foi adicionado como título.', 'success');
        setSelectedKeyState(screenKey);
      }
      setScreenModal(null);
    } catch {
      notify('Erro ao salvar a tela.', 'error');
    } finally {
      setSavingScreen(false);
    }
  }, [screenForm, screenModal, getDefinitionByKey, saveDefinition, definitions, dynamicDefinitions, notify]);

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
    setFieldModal({ screenKey, fieldKey: null });
  }, [defaultTagColor]);

  const openEditField = useCallback((screenKey: string, fieldKey: string) => {
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

  const refEntityOptions = useMemo<SearchSelectOption[]>(() => {
    const dynamicOptions = dynamicScreens
      .filter((def) => def.id !== fieldModal?.screenKey)
      .map((def) => ({ value: def.id, label: def.titlePlural }));
    return [
      ...BUILTIN_SCREENS.map((b) => ({ value: b.key, label: b.label })),
      ...dynamicOptions,
    ];
  }, [dynamicScreens, fieldModal]);

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

  const handleSaveField = useCallback(async () => {
    if (!fieldModal) return;
    const label = fieldForm.label.trim();
    if (!label) {
      notify('Informe o nome do campo.', 'error');
      return;
    }
    
    // Validação do fieldKey (apenas em criação, não edição)
    if (!fieldModal.fieldKey) {
      const fieldKeyToValidate = fieldForm.fieldKey.trim() || slugifyFieldKey(label);
      const validationError = validateFieldKey(fieldKeyToValidate);
      if (validationError) {
        notify(validationError, 'error');
        return;
      }
    }
    
    if (fieldForm.type === 'select' && fieldForm.staticOptions.length === 0 && !fieldForm.optionsAllowUserAdd) {
      notify('Adicione ao menos uma opção ou permita que usuários criem opções.', 'error');
      return;
    }
    if (fieldForm.type === 'masked' && !fieldForm.mask) {
      notify('Escolha a máscara do campo.', 'error');
      return;
    }
    if (fieldForm.type === 'reference' && !fieldForm.refEntity) {
      notify('Escolha a tela vinculada ao campo.', 'error');
      return;
    }
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
  }, [fieldModal, fieldForm, fieldModalIsTitleField, getDefinitionByKey, saveDefinition, notify]);

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
    screenForm,
    updateScreenForm,
    titleFieldOptions,
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
    fieldModalIsEdit: !!fieldModal?.fieldKey,
    fieldModalIsTitleField,
    fieldForm,
    updateFieldForm,
    typeOptions,
    maskOptions,
    refEntityOptions,
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
