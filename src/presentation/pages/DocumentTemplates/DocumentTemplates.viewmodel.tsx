import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useContributions } from '../../../stores/useKernel';
import { useDocumentTemplates } from '../../../stores/useDocumentTemplates';
import { useLookups } from '../../../stores/useLookups';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE } from '../../../domain/schema/access';
import { presentedScreens } from '../../../domain/services/screenDataCollection';
import type {
  DocumentTemplate,
  DocumentTemplateDataset,
  DocumentTemplateFormat,
  DocumentTemplateSpec,
} from '../../../domain/schema/document/documentTemplate';
import {
  DOCUMENT_TEMPLATE_KEY_MAX_LENGTH,
  DOCUMENT_TEMPLATE_KEY_PATTERN,
  DOCUMENT_TEMPLATE_MAX_BYTES,
  DOCUMENT_TEMPLATE_POINT,
  documentTemplateFingerprint,
  documentTemplateIssues,
  documentTemplateOf,
  isGrammarIssue,
  isTemplateCopyOutdated,
  templateCollection,
} from '../../../domain/schema/document/documentTemplate';
import { useScreenKeyOfSource } from '../../shared/documents/useResolvedDocumentTemplates';
import { buildStarterTemplate } from '../../../domain/schema/document/starterTemplate';
import type { TemplateHelpGroup } from '../../shared/documents/templateHelp';
import { templateHelpFor } from '../../shared/documents/templateHelp';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { useLabel, useT } from '../../shared/i18n/useT';
import { useExtensionName } from '../../shared/extensions/useExtensionName';

/**
 * O estado de uma chave, do ponto de vista de quem administra:
 * - `plugin`: só a extensão declara — somente leitura, personalizável;
 * - `override`: o escritório substitui o da extensão na mesma chave;
 * - `disabled`: o escritório desligou a chave;
 * - `tenant`: o modelo é do escritório, sem extensão por trás.
 */
export type DocumentTemplateRowState = 'plugin' | 'override' | 'disabled' | 'tenant';

export interface DocumentTemplateRow {
  key: string;
  title: string;
  screenLabel: string;
  format: DocumentTemplateFormat;
  state: DocumentTemplateRowState;
  pluginId: string | null;
  /** O nome da extensão que declara a chave, para quem pergunta de onde o modelo veio. */
  extension: string | null;
  /** A cópia do escritório saiu de um original que a extensão já trocou. */
  outdated: boolean;
}

export interface TemplateIssueLine {
  field: string;
  message: string;
  isGrammar: boolean;
}

export interface DatasetRowOptions {
  via: SearchSelectOption[];
  orderBy: SearchSelectOption[];
}

export interface DocumentTemplatesViewModel {
  canManage: boolean;
  rows: DocumentTemplateRow[];
  /** As linhas que passam pelo filtro. */
  visibleRows: DocumentTemplateRow[];
  filterDefs: FilterDef[];
  filterTokens: FilterToken[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  savedFiltersScreenKey: string;
  selectedKey: string | null;
  selectedRow: DocumentTemplateRow | null;
  isNew: boolean;
  /** O título do modelo de que o rascunho novo é cópia — `null` quando o rascunho nasceu vazio. */
  clonedFrom: string | null;
  selectedState: DocumentTemplateRowState | null;
  isEditable: boolean;
  form: DocumentTemplateSpec;
  setForm: (patch: Partial<DocumentTemplateSpec>) => void;
  issues: TemplateIssueLine[];
  /** Os problemas de um campo — e, para uma lista (`datasets`), os de cada item dela. */
  issuesFor: (field: string) => TemplateIssueLine[];
  isReadOnly: boolean;
  screenOptions: SearchSelectOption[];
  childScreenOptions: SearchSelectOption[];
  formatOptions: SearchSelectOption[];
  documentTypeOptions: SearchSelectOption[];
  destinationOptions: SearchSelectOption[];
  /** A retenção como texto do campo: vazio = a do escritório. */
  retentionText: string;
  setRetentionText: (text: string) => void;
  datasetOptions: DatasetRowOptions[];
  isSaving: boolean;
  canSave: boolean;
  isDeleteOpen: boolean;
  selectRow: (key: string) => void;
  startNew: () => void;
  handleSave: () => Promise<void>;
  handleCustomize: () => void;
  /** Abre um modelo NOVO do escritório com o conteúdo do selecionado — chave própria, nada substituído. */
  handleClone: () => void;
  /** Dá a cópia personalizada por conferida diante do original atual da extensão, sem mudar o conteúdo. */
  handleKeepCopy: () => Promise<void>;
  handleToggleDisabled: () => Promise<void>;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  handleDocxFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** A ajuda da gramática para o formato do modelo, ao lado do texto. */
  helpGroups: TemplateHelpGroup[];
  openFunctionReference: () => void;
  /** O modelo inicial escrito a partir dos campos da tela escolhida. */
  canInsertStarter: boolean;
  insertStarter: () => void;
  isStarterConfirmOpen: boolean;
  confirmStarter: () => void;
  cancelStarter: () => void;
  addDataset: () => void;
  updateDataset: (index: number, patch: Partial<DocumentTemplateDataset>) => void;
  removeDataset: (index: number) => void;
}

const ROW_STATES: readonly DocumentTemplateRowState[] = ['plugin', 'override', 'disabled', 'tenant'];

const OUTDATED_FILTER = 'outdated';

const EMPTY_FORM: DocumentTemplateSpec = {
  key: '',
  title: '',
  collection: '',
  format: 'markdown',
  body: '',
};

/** A primeira chave livre a partir de `<chave>-copy`, dentro do teto e do padrão de chave. */
const freeCopyKey = (key: string, taken: (candidate: string) => boolean): string => {
  const base = `${key.slice(0, DOCUMENT_TEMPLATE_KEY_MAX_LENGTH - '-copy-99'.length)}-copy`;
  if (!taken(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken(candidate)) return candidate;
  }
};

const specOf = (template: DocumentTemplateSpec): DocumentTemplateSpec => ({
  key: template.key,
  title: template.title,
  ...(template.description ? { description: template.description } : {}),
  collection: template.collection,
  ...(template.screenSourceId ? { screenSourceId: template.screenSourceId } : {}),
  format: template.format,
  ...(template.body !== undefined ? { body: template.body } : {}),
  ...(template.content !== undefined ? { content: template.content } : {}),
  ...(template.outputs ? { outputs: template.outputs } : {}),
  ...(template.fileName ? { fileName: template.fileName } : {}),
  ...(template.documentType ? { documentType: template.documentType } : {}),
  ...(template.datasets ? { datasets: template.datasets } : {}),
  ...(template.destination ? { destination: template.destination } : {}),
  ...(template.retentionDays !== undefined ? { retentionDays: template.retentionDays } : {}),
});

/** O arquivo lido como base64, sem o prefixo `data:` que o `FileReader` acrescenta. */
const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? '').replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const useDocumentTemplatesViewModel = (): DocumentTemplatesViewModel => {
  const t = useT('core.documents');
  const label = useLabel();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { definitions, getDefinition } = useScreenDefinitions();
  const { getOptions } = useLookups();
  const { templates, saveTemplate, deleteTemplate } = useDocumentTemplates();
  const { openTab } = useWorkspace();
  const contributions = useContributions(DOCUMENT_TEMPLATE_POINT);
  const screenKeyOf = useScreenKeyOfSource();
  const extensionOf = useExtensionName();

  const packaged = useMemo(() => {
    const byKey = new Map<string, { spec: DocumentTemplateSpec; pluginId: string }>();
    for (const contribution of contributions) {
      const spec = documentTemplateOf(contribution);
      if (spec && !byKey.has(spec.key)) byKey.set(spec.key, { spec, pluginId: contribution.pluginId });
    }
    return byKey;
  }, [contributions]);

  const tenantByKey = useMemo(
    () => new Map<string, DocumentTemplate>(templates.map((template) => [template.key, template])),
    [templates],
  );

  /** A tela do modelo pela chave INSTALADA — a de pacote vem pelo `sourceId`, que não muda. */
  const installedSpec = useCallback(
    (spec: DocumentTemplateSpec): DocumentTemplateSpec => ({
      ...specOf(spec),
      collection: templateCollection(spec, screenKeyOf) ?? '',
      ...(spec.datasets
        ? {
          datasets: spec.datasets.map((dataset) => ({
            ...dataset,
            from: (dataset.fromSourceId ? screenKeyOf(dataset.fromSourceId) : dataset.from) ?? '',
          })),
        }
        : {}),
    }),
    [screenKeyOf],
  );

  const screenLabelOf = useCallback(
    (collection: string) => {
      if (!collection) return t('template.screen-missing');
      const definition = getDefinition(collection);
      return definition ? label(definition.titlePlural) : collection;
    },
    [getDefinition, label, t],
  );

  const rows = useMemo<DocumentTemplateRow[]>(() => {
    const keys = new Set([...packaged.keys(), ...tenantByKey.keys()]);
    return [...keys]
      .map((key): DocumentTemplateRow => {
        const own = tenantByKey.get(key);
        const fromPackage = packaged.get(key);
        const state: DocumentTemplateRowState = own
          ? own.enabled === false ? 'disabled' : fromPackage ? 'override' : 'tenant'
          : 'plugin';
        const shown = installedSpec(own && own.enabled !== false ? own : fromPackage?.spec ?? (own as DocumentTemplateSpec));
        return {
          outdated: state === 'override' && !!own && !!fromPackage && isTemplateCopyOutdated(own, fromPackage.spec),
          key,
          title: label(shown.title),
          screenLabel: screenLabelOf(shown.collection),
          format: shown.format,
          state,
          pluginId: fromPackage?.pluginId ?? null,
          extension: extensionOf(fromPackage?.pluginId),
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [packaged, tenantByKey, label, screenLabelOf, installedSpec, extensionOf]);

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draft, setDraft] = useState<DocumentTemplateSpec | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isStarterConfirmOpen, setIsStarterConfirmOpen] = useState(false);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [clonedFrom, setClonedFrom] = useState<string | null>(null);

  const filterDefs = useMemo<FilterDef[]>(() => {
    const screens = [...new Set(rows.map((row) => row.screenLabel))].sort((left, right) => left.localeCompare(right));
    return [
      { key: 'search', label: t('core.ui/filter.search'), type: 'text', placeholder: t('template.search') },
      {
        key: 'state',
        label: t('filter.state'),
        type: 'multiselect',
        options: [
          ...ROW_STATES.map((state) => ({ value: state, label: t(`state.${state}`) })),
          { value: OUTDATED_FILTER, label: t('state.outdated') },
        ],
      },
      { key: 'screen', label: t('field.collection'), type: 'multiselect', options: screens.map((screen) => ({ value: screen, label: screen })) },
    ];
  }, [rows, t]);

  const visibleRows = useMemo(() => {
    const valuesOf = (key: string) => filterTokens.find((token) => token.key === key)?.values ?? [];
    const needle = (valuesOf('search')[0] ?? '').trim().toLocaleLowerCase();
    const states = valuesOf('state');
    const screens = valuesOf('screen');
    return rows.filter((row) =>
      (!needle || [row.title, row.screenLabel, row.key, row.extension ?? '']
        .some((text) => text.toLocaleLowerCase().includes(needle)))
      && (states.length === 0 || states.includes(row.state) || (row.outdated && states.includes(OUTDATED_FILTER)))
      && (screens.length === 0 || screens.includes(row.screenLabel)));
  }, [rows, filterTokens]);

  const selectedRow = rows.find((row) => row.key === selectedKey) ?? null;
  const selectedState = isNew ? 'tenant' : selectedRow?.state ?? null;
  const isEditable = isNew || selectedState === 'tenant' || selectedState === 'override';

  /**
   * O formulário é o RASCUNHO quando há edição em curso; sem ela, é o que a chave selecionada diz
   * agora — inclusive depois de um save, quando o store devolve o documento gravado.
   */
  const form = useMemo<DocumentTemplateSpec>(() => {
    if (draft) return draft;
    if (!selectedKey) return EMPTY_FORM;
    const own = tenantByKey.get(selectedKey);
    if (own && own.enabled !== false) return installedSpec(own);
    return installedSpec(packaged.get(selectedKey)?.spec ?? own ?? EMPTY_FORM);
  }, [draft, selectedKey, tenantByKey, packaged, installedSpec]);

  /** Escolher a tela à mão desfaz o vínculo pelo `sourceId` — senão ele continuaria vencendo a escolha. */
  const setForm = useCallback(
    (patch: Partial<DocumentTemplateSpec>) => {
      const next = { ...form, ...patch };
      if ('collection' in patch) delete next.screenSourceId;
      setDraft(next);
    },
    [form],
  );

  const issues = useMemo(
    () => (isEditable
      ? documentTemplateIssues(form).map((one) => ({
        field: one.field,
        message: label(one.error, one.errorParams),
        isGrammar: isGrammarIssue(one),
      }))
      : []),
    [form, isEditable, label],
  );

  const keyTaken = isNew && (tenantByKey.has(form.key) || packaged.has(form.key));

  const screenOptions = useMemo(
    () => definitions
      // Sem a aba Documentos a tela ainda gera — para Downloads. Ela só entra quando é esse o destino.
      .filter((definition) =>
        definition.hasDocuments || form.destination === 'downloads' || definition.id === form.collection)
      .map((definition) => ({ value: definition.id, label: label(definition.titlePlural), meta: definition.id })),
    [definitions, label, form.destination, form.collection],
  );

  const destinationOptions = useMemo(
    () => [
      { value: 'record', label: t('destination.record') },
      { value: 'downloads', label: t('destination.downloads') },
    ],
    [t],
  );

  const setRetentionText = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      setForm({ retentionDays: trimmed === '' ? undefined : Number(trimmed) });
    },
    [setForm],
  );

  const childScreenOptions = useMemo(() => {
    const chosen = new Set((form.datasets ?? []).map((dataset) => dataset.from));
    const presented = new Set(presentedScreens(definitions).map((definition) => definition.id));
    return definitions
      .filter((definition) => presented.has(definition.id) || chosen.has(definition.id))
      .map((definition) => ({ value: definition.id, label: label(definition.titlePlural), meta: definition.id }));
  }, [definitions, form.datasets, label]);

  const formatOptions = useMemo(
    () => [
      { value: 'markdown', label: t('format.markdown') },
      { value: 'docx', label: t('format.docx') },
    ],
    [t],
  );

  const documentTypeOptions = useMemo(
    () => getOptions('documentTypes').map((option) => ({ value: option.key, label: option.label })),
    [getOptions],
  );

  /**
   * Para cada lista declarada: os vínculos da tela dos filhos que apontam para a tela do modelo — o
   * `via` só faz sentido entre eles — e os campos pelos quais ordenar.
   */
  const datasetOptions = useMemo(
    () => (form.datasets ?? []).map((dataset): DatasetRowOptions => {
      const fields = getDefinition(dataset.from)?.fields ?? [];
      return {
        via: fields
          .filter((field) => field.type === 'reference' && field.refEntity === form.collection)
          .map((field) => ({ value: field.key, label: label(field.label), meta: field.key })),
        orderBy: fields.map((field) => ({ value: field.key, label: label(field.label), meta: field.key })),
      };
    }),
    [form.datasets, form.collection, getDefinition, label],
  );

  const selectRow = useCallback((key: string) => {
    setSelectedKey(key);
    setIsNew(false);
    setClonedFrom(null);
    setDraft(null);
  }, []);

  const startNew = useCallback(() => {
    setSelectedKey(null);
    setIsNew(true);
    setClonedFrom(null);
    setDraft({ ...EMPTY_FORM });
  }, []);

  const handleSave = useCallback(async () => {
    if (!isEditable || keyTaken) return;
    if (documentTemplateIssues(form).some((one) => !isGrammarIssue(one))) return;
    setIsSaving(true);
    try {
      // A cópia personalizada guarda de que original saiu; regravá-la sem isso apagaria o aviso.
      const basedOn = isNew ? undefined : tenantByKey.get(form.key)?.basedOn;
      await saveTemplate({ ...specOf(form), enabled: true, ...(basedOn ? { basedOn } : {}) });
      notify(t('template.saved'), 'success');
      setSelectedKey(form.key);
      setIsNew(false);
      setClonedFrom(null);
      setDraft(null);
    } catch {
      notify(t('template.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isEditable, keyTaken, form, isNew, tenantByKey, saveTemplate, notify, t]);

  /** Personalizar é COPIAR o da extensão para a mesma chave — a cópia vence, e apagá-la devolve o original. */
  const handleCustomize = useCallback(() => {
    if (!selectedKey) return;
    const fromPackage = packaged.get(selectedKey);
    if (!fromPackage) return;
    const copy = { ...installedSpec(fromPackage.spec), title: label(fromPackage.spec.title) };
    setDraft(copy);
    setIsNew(false);
    void saveTemplate({ ...copy, enabled: true, basedOn: documentTemplateFingerprint(fromPackage.spec) })
      .then(() => notify(t('template.customized'), 'success'))
      .catch(() => notify(t('template.save-failed'), 'error'));
  }, [selectedKey, packaged, installedSpec, saveTemplate, notify, t, label]);

  const handleClone = useCallback(() => {
    const source = label(form.title);
    const key = freeCopyKey(
      DOCUMENT_TEMPLATE_KEY_PATTERN.test(form.key) ? form.key : 'template',
      (candidate) => tenantByKey.has(candidate) || packaged.has(candidate),
    );
    setDraft({ ...specOf(form), key, title: t('template.clone.title', { title: source }) });
    setSelectedKey(null);
    setIsNew(true);
    setClonedFrom(source);
  }, [form, label, tenantByKey, packaged, t]);

  const handleKeepCopy = useCallback(async () => {
    if (!selectedKey) return;
    const own = tenantByKey.get(selectedKey);
    const fromPackage = packaged.get(selectedKey);
    if (!own || !fromPackage) return;
    try {
      await saveTemplate({ ...specOf(own), enabled: true, basedOn: documentTemplateFingerprint(fromPackage.spec) });
      notify(t('template.outdated.kept'), 'success');
    } catch {
      notify(t('template.save-failed'), 'error');
    }
  }, [selectedKey, tenantByKey, packaged, saveTemplate, notify, t]);

  /**
   * Desligar grava a chave com `enabled: false` — a cópia do escritório COM o conteúdo dela. Religar
   * apaga só a marca de um modelo de extensão; uma cópia personalizada ou um modelo do escritório
   * volta a valer como estava, em vez de ser apagado.
   */
  const handleToggleDisabled = useCallback(async () => {
    if (!selectedKey) return;
    const own = tenantByKey.get(selectedKey);
    try {
      if (selectedState === 'disabled') {
        if (packaged.has(selectedKey) && !own?.basedOn) await deleteTemplate(selectedKey);
        else if (own) await saveTemplate({ ...specOf(own), enabled: true, ...(own.basedOn ? { basedOn: own.basedOn } : {}) });
        notify(t('template.enabled'), 'success');
      } else {
        const spec = own ?? packaged.get(selectedKey)?.spec;
        if (!spec) return;
        await saveTemplate({ ...specOf(spec), enabled: false, ...(own?.basedOn ? { basedOn: own.basedOn } : {}) });
        notify(t('template.disabled'), 'success');
      }
      setDraft(null);
    } catch {
      notify(t('template.save-failed'), 'error');
    }
  }, [selectedKey, selectedState, packaged, tenantByKey, deleteTemplate, saveTemplate, notify, t]);

  const requestDelete = useCallback(() => setIsDeleteOpen(true), []);
  const cancelDelete = useCallback(() => setIsDeleteOpen(false), []);

  const confirmDelete = useCallback(async () => {
    if (!selectedKey) return;
    try {
      await deleteTemplate(selectedKey);
      notify(t(selectedState === 'override' ? 'template.restored' : 'template.deleted'), 'success');
      setDraft(null);
      if (selectedState !== 'override') setSelectedKey(null);
    } catch {
      notify(t('template.delete-failed'), 'error');
    } finally {
      setIsDeleteOpen(false);
    }
  }, [selectedKey, selectedState, deleteTemplate, notify, t]);

  const handleDocxFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > DOCUMENT_TEMPLATE_MAX_BYTES) {
      notify(t('template.content.too-large', { maxKb: String(DOCUMENT_TEMPLATE_MAX_BYTES / 1024) }), 'error');
      return;
    }
    readAsBase64(file)
      .then((content) => {
        setDraft({ ...form, format: 'docx', content, body: undefined });
      })
      .catch(() => notify(t('template.content.invalid'), 'error'));
  }, [form, notify, t]);

  const dateFormat = t('starter.date-format');

  const helpGroups = useMemo(() => templateHelpFor(form.format, dateFormat), [form.format, dateFormat]);

  const openFunctionReference = useCallback(() => openTab('function-reference'), [openTab]);

  const starterScreen = form.format === 'markdown' ? getDefinition(form.collection) : undefined;

  /**
   * Aplica o modelo inicial. As listas que o escritório já declarou ficam — o modelo inicial só
   * ACRESCENTA as que faltam —, e o nome do arquivo só é sugerido quando ainda está vazio.
   */
  const applyStarter = useCallback(() => {
    if (!starterScreen) return;
    const starter = buildStarterTemplate({
      screen: starterScreen,
      screens: definitions,
      label,
      texts: {
        fieldsComment: t('starter.comment.fields'),
        listComment: t('starter.comment.list'),
        dateFormat,
        yes: t('starter.yes'),
        no: t('starter.no'),
        generatedOn: t('starter.generated-on'),
      },
    });
    const declared = form.datasets ?? [];
    const names = new Set(declared.map((dataset) => dataset.name));
    setForm({
      body: starter.body,
      fileName: form.fileName?.trim() ? form.fileName : starter.fileName,
      datasets: [...declared, ...starter.datasets.filter((dataset) => !names.has(dataset.name))],
    });
    setIsStarterConfirmOpen(false);
  }, [starterScreen, definitions, label, t, dateFormat, form.datasets, form.fileName, setForm]);

  const insertStarter = useCallback(() => {
    if (form.body?.trim()) setIsStarterConfirmOpen(true);
    else applyStarter();
  }, [form.body, applyStarter]);

  const cancelStarter = useCallback(() => setIsStarterConfirmOpen(false), []);

  const addDataset = useCallback(
    () => setForm({ datasets: [...(form.datasets ?? []), { name: '', from: '', via: '' }] }),
    [form.datasets, setForm],
  );

  const updateDataset = useCallback(
    (index: number, patch: Partial<DocumentTemplateDataset>) =>
      setForm({
        datasets: (form.datasets ?? []).map((dataset, at) => {
          if (at !== index) return dataset;
          const next = { ...dataset, ...patch };
          if ('from' in patch) delete next.fromSourceId;
          return next;
        }),
      }),
    [form.datasets, setForm],
  );

  const removeDataset = useCallback(
    (index: number) => setForm({ datasets: (form.datasets ?? []).filter((_dataset, at) => at !== index) }),
    [form.datasets, setForm],
  );

  const blockingIssues = issues.some((one) => !one.isGrammar);
  const allIssues = useMemo<TemplateIssueLine[]>(
    () => (keyTaken
      ? [...issues, { field: 'key', message: t('template.key.taken', { key: form.key }), isGrammar: false }]
      : issues),
    [issues, keyTaken, form.key, t],
  );
  const issuesFor = useCallback(
    (field: string) => allIssues.filter((one) => one.field === field || one.field.startsWith(`${field}[`)),
    [allIssues],
  );

  return {
    canManage: can(PERMISSION_DOCUMENT_TEMPLATES_MANAGE),
    rows,
    visibleRows,
    filterDefs,
    filterTokens,
    setFilterTokens,
    savedFiltersScreenKey: 'document-templates',
    selectedKey,
    selectedRow: isNew ? null : selectedRow,
    isNew,
    clonedFrom,
    selectedState,
    isEditable,
    form,
    setForm,
    issues: allIssues,
    issuesFor,
    isReadOnly: !isEditable,
    screenOptions,
    childScreenOptions,
    formatOptions,
    documentTypeOptions,
    destinationOptions,
    retentionText: form.retentionDays === undefined ? '' : String(form.retentionDays),
    setRetentionText,
    datasetOptions,
    isSaving,
    canSave: isEditable && draft !== null && !blockingIssues && !keyTaken && !isSaving,
    isDeleteOpen,
    selectRow,
    startNew,
    handleSave,
    handleCustomize,
    handleClone,
    handleKeepCopy,
    handleToggleDisabled,
    requestDelete,
    cancelDelete,
    confirmDelete,
    handleDocxFile,
    helpGroups,
    openFunctionReference,
    canInsertStarter: isEditable && !!starterScreen,
    insertStarter,
    isStarterConfirmOpen,
    confirmStarter: applyStarter,
    cancelStarter,
    addDataset,
    updateDataset,
    removeDataset,
  };
};
