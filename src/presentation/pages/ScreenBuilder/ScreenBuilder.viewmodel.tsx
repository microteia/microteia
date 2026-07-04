import { useCallback, useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { useTenant } from '../../../stores/useTenant';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import type { ScreenDefinitionSaveInput } from '../../../stores/useScreenDefinitions';
import { useNotification } from '../../../stores/useNotification';
import { ensureUniqueKey, slugifyFieldKey, sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import { getDefaultTagColor } from '../../../shared/styles/colorUtils';
import { SCREEN_ICON_KEYS } from '../../shared/screenIcons';
import type { CustomFieldMask, CustomFieldType, FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { ColorSwatchOption } from '../../components/ui/ColorSwatchPicker';

export interface BuiltinScreenRow {
  key: string;
  label: string;
  fields: FieldDefinition[];
}

export interface ScreenFormState {
  titleSingular: string;
  titlePlural: string;
  icon: string;
  hasNotes: boolean;
  hasDocuments: boolean;
  enabled: boolean;
  titleFieldKey: string;
}

export interface FieldOptionFormItem {
  label: string;
  color?: string;
}

export interface FieldFormState {
  label: string;
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
  filterable: boolean;
}

export interface ScreenBuilderViewModel {
  isAdmin: boolean;
  isLoading: boolean;
  dynamicDefinitions: ScreenDefinition[];
  fieldsByScreen: Record<string, FieldDefinition[]>;
  builtinRows: BuiltinScreenRow[];
  fieldTypeLabel: (type: CustomFieldType) => string;
  isTitleField: (screenKey: string, fieldKey: string) => boolean;
  screenModalOpen: boolean;
  screenModalIsEdit: boolean;
  screenForm: ScreenFormState;
  updateScreenForm: (patch: Partial<ScreenFormState>) => void;
  titleFieldOptions: SearchSelectOption[];
  iconKeys: string[];
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
  enabled: true,
  titleFieldKey: '',
};

const EMPTY_FIELD_FORM: FieldFormState = {
  label: '',
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
  sidebarOrder: def.sidebarOrder,
  enabled: def.enabled,
});

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
    setFieldForm((prev) => ({ ...prev, ...patch }));
  }, []);

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
      enabled: def.enabled,
      titleFieldKey: def.titleFieldKey,
    });
    setScreenModal({ screenKey });
  }, [getDefinitionByKey]);

  const closeScreenModal = useCallback(() => setScreenModal(null), []);

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
          sidebarOrder: maxOrder + 1,
          enabled: true,
        });
        notify('Tela criada com sucesso! Um campo "Nome" foi adicionado como título.', 'success');
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
            filterable: fieldForm.filterable,
          };
        });
      } else {
        const existingKeys = new Set(fields.map((f) => f.key));
        const key = ensureUniqueKey(slugifyFieldKey(label), existingKeys);
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

  const moveField = useCallback(async (screenKey: string, fieldKey: string, direction: -1 | 1) => {
    const def = getDefinitionByKey(screenKey);
    if (!def) return;
    const fields = sortFieldsByOrder(def.fields);
    const index = fields.findIndex((f) => f.key === fieldKey);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= fields.length) return;
    const [moved] = fields.splice(index, 1);
    fields.splice(targetIndex, 0, moved);
    const reordered = fields.map((f, idx) => ({ ...f, order: idx }));
    try {
      await saveDefinition(screenKey, { ...toSaveInput(def), fields: reordered });
    } catch {
      notify('Erro ao reordenar os campos.', 'error');
    }
  }, [getDefinitionByKey, saveDefinition, notify]);

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
    fieldTypeLabel,
    isTitleField,
    screenModalOpen: screenModal !== null,
    screenModalIsEdit: !!screenModal?.screenKey,
    screenForm,
    updateScreenForm,
    titleFieldOptions,
    iconKeys: SCREEN_ICON_KEYS,
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
    requestDeleteField,
    deleteFieldTarget,
    cancelDeleteField,
    confirmDeleteField,
    deletingField,
  };
};
