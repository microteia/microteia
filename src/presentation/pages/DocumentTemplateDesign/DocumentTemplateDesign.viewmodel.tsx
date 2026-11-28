import { useCallback, useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useDocumentTemplates } from '../../../stores/useDocumentTemplates';
import { useLookups } from '../../../stores/useLookups';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE } from '../../../domain/schema/access';
import { presentedScreens, screenDataCollection } from '../../../domain/services/screenDataCollection';
import type {
  DocumentTemplateDataset,
  DocumentTemplateSource,
  DocumentTemplateSpec,
} from '../../../domain/schema/document/documentTemplate';
import {
  DOCUMENT_LINE_ENDINGS,
  DOCUMENT_TEMPLATE_FORMATS,
  DOCUMENT_TEMPLATE_MAX_BYTES,
  DOCUMENT_TEXT_ENCODINGS,
  datasetOrder,
  documentTemplateIssues,
  isGrammarIssue,
  isPayloadTemplate,
} from '../../../domain/schema/document/documentTemplate';
import { buildStarterTemplate } from '../../../domain/schema/document/starterTemplate';
import { buildPayloadStarterTemplate } from '../../../domain/schema/document/payloadStarter';
import type { QueryOrderBy } from '../../../domain/schema/querySpec';
import { withArtifactPrefix, withoutArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';
import {
  DOCUMENT_TEMPLATES_TAB,
  buildDocumentTemplateCloneTabKey,
  parseDocumentTemplateDesignTabKey,
} from '../../../shared/constants/documentTemplateKeys';
import type { DocumentTemplateRowState } from '../../shared/documents/useDocumentTemplateCatalog';
import { EMPTY_TEMPLATE, specOf, useDocumentTemplateCatalog } from '../../shared/documents/useDocumentTemplateCatalog';
import type { TemplatePayloadEditor } from '../../shared/documents/useTemplatePayloadEditor';
import { useTemplatePayloadEditor } from '../../shared/documents/useTemplatePayloadEditor';
import type { TemplateHelpGroup } from '../../shared/documents/templateHelp';
import { templateHelpFor } from '../../shared/documents/templateHelp';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import { useLabel, useT } from '../../shared/i18n/useT';
import type { DesignerMetaItem } from '../../components/layout/DesignerShell';
import { useArtifactPrefix } from '../../shared/settings/useArtifactPrefix';

/**
 * As abas da autoria. As três primeiras configuram; a de CONTEÚDO é a bancada — o editor e, ao lado,
 * a prévia, com a altura inteira. Embaixo das configurações eles ficavam numa faixa estreita (#22).
 */
export type TemplateDesignTab = 'general' | 'output' | 'data' | 'content';

/** O painel ao lado do editor: o resultado mesclado, ou a referência da gramática. */
export type TemplateSidePanel = 'preview' | 'reference';

export interface TemplateIssueLine {
  field: string;
  message: string;
  isGrammar: boolean;
}

export interface TemplateDesignTabItem {
  key: TemplateDesignTab;
  label: string;
  /** Quantos itens a aba declara — listas ou parâmetros. 0 = sem contador. */
  count: number;
  /** Quantos problemas moram nos campos da aba — para não sumirem na aba em que não se está. */
  issueCount: number;
  /** Algum deles impede salvar; senão, são só avisos da gramática. */
  hasBlockingIssue: boolean;
}

export interface DatasetRowOptions {
  via: SearchSelectOption[];
  orderBy: SearchSelectOption[];
  /** As chaves de ordem da lista, já como lista — a forma em texto vira uma chave. */
  order: QueryOrderBy[];
}

export interface DocumentTemplateDesignViewModel {
  canManage: boolean;
  /** A aba aponta para um modelo (ou um original de clone) que não existe mais. */
  notFound: boolean;
  /** O título do cabeçalho: o nome digitado, ou "Novo modelo". */
  heading: string;
  /**
   * O nome no campo: o modelo de extensão traz uma referência (`@pacote/chave`), que só se lê traduzida;
   * o que o escritório edita é o texto dele, como gravado.
   */
  titleText: string;
  /** Tela (ou "dados") do modelo, para o cabeçalho; `null` antes de escolhida. */
  screenLabel: string | null;
  /** A linha sob o nome no cabeçalho: chave • tela • formato. */
  headerMeta: DesignerMetaItem[];
  state: DocumentTemplateRowState | null;
  outdated: boolean;
  extension: string | null;
  isNew: boolean;
  /** O título do original de que o rascunho novo é cópia — `null` quando ele nasceu vazio. */
  clonedFrom: string | null;
  isEditable: boolean;
  isReadOnly: boolean;
  form: DocumentTemplateSpec;
  setForm: (patch: Partial<DocumentTemplateSpec>) => void;
  /** Trocar o formato tira a codificação e a quebra de linha, que só o arquivo de leiaute (`text`) tem. */
  setFormat: (format: string) => void;
  isLayoutText: boolean;
  encodingOptions: SearchSelectOption[];
  lineEndingOptions: SearchSelectOption[];
  /** O prefixo do escritório, fixo à frente da chave de um modelo novo; `null` sem prefixo. */
  artifactPrefix: string | null;
  /** A chave sem o prefixo — o pedaço que a pessoa digita num modelo novo. */
  keyRest: string;
  setKeyRest: (rest: string) => void;
  /** Os problemas de um campo — e, para uma lista (`datasets`), os de cada item dela. */
  issuesFor: (field: string) => TemplateIssueLine[];
  /** Os problemas do CONTEÚDO — e de qualquer campo que nenhuma aba desenhe —, mostrados sob o editor. */
  contentIssues: TemplateIssueLine[];
  screenOptions: SearchSelectOption[];
  childScreenOptions: SearchSelectOption[];
  formatOptions: SearchSelectOption[];
  documentTypeOptions: SearchSelectOption[];
  destinationOptions: SearchSelectOption[];
  orderDirectionOptions: SearchSelectOption[];
  /** A retenção como texto do campo: vazio = a do escritório. */
  retentionText: string;
  setRetentionText: (text: string) => void;
  datasetOptions: DatasetRowOptions[];
  /** O modelo lê dados entregues por quem gera, e não um registro de tela. */
  isPayload: boolean;
  sourceOptions: SearchSelectOption[];
  setSource: (source: string) => void;
  /** Os parâmetros e o exemplo de um modelo de dados. */
  payload: TemplatePayloadEditor;

  tabs: TemplateDesignTabItem[];
  activeTab: TemplateDesignTab;
  setActiveTab: (tab: TemplateDesignTab) => void;

  sidePanel: TemplateSidePanel;
  setSidePanel: (panel: TemplateSidePanel) => void;
  /** O modelo como estava no último pedido de prévia — `null` antes do primeiro. */
  previewTemplate: DocumentTemplateSpec | null;
  /** O texto mudou depois da última prévia: ela mostra outra versão. */
  previewStale: boolean;
  /** Há texto para mesclar e nenhum erro de forma: a pré-visualização tem o que mostrar. */
  canPreview: boolean;
  runPreview: () => void;
  helpGroups: TemplateHelpGroup[];
  openFunctionReference: () => void;

  canInsertStarter: boolean;
  insertStarter: () => void;
  isStarterConfirmOpen: boolean;
  confirmStarter: () => void;
  cancelStarter: () => void;
  handleDocxFile: (event: React.ChangeEvent<HTMLInputElement>) => void;

  addDataset: () => void;
  updateDataset: (index: number, patch: Partial<DocumentTemplateDataset>) => void;
  removeDataset: (index: number) => void;
  addOrderKey: (index: number) => void;
  updateOrderKey: (index: number, position: number, patch: Partial<QueryOrderBy>) => void;
  removeOrderKey: (index: number, position: number) => void;

  isSaving: boolean;
  canSave: boolean;
  save: () => Promise<void>;
  customize: () => Promise<void>;
  /** Abre o CLONE do modelo gravado numa aba própria — chave nova, nada substituído. */
  clone: () => void;
  toggleDisabled: () => Promise<void>;
  keepCopy: () => Promise<void>;
  isRemoveOpen: boolean;
  isRemoving: boolean;
  askRemove: () => void;
  cancelRemove: () => void;
  confirmRemove: () => Promise<void>;
}

type TemplateSettingsTab = Exclude<TemplateDesignTab, 'content'>;

/** Os campos que cada aba de configuração desenha. O que não está em nenhuma é da aba de conteúdo. */
const TAB_FIELDS: Record<TemplateSettingsTab, readonly string[]> = {
  general: ['title', 'key', 'source', 'collection', 'format'],
  output: ['encoding', 'lineEnding', 'fileName', 'documentType', 'destination', 'retentionDays'],
  data: ['datasets', 'parameters', 'sample'],
};

const isFieldOf = (field: string, owners: readonly string[]): boolean =>
  owners.some((owner) => field === owner || field.startsWith(`${owner}[`));

const SETTINGS_TABS: readonly TemplateSettingsTab[] = ['general', 'output', 'data'];

/**
 * O que muda o documento mesclado. A prévia compara por CONTEÚDO, e não pelo objeto: personalizar
 * troca o objeto (e resolve o título) sem mudar uma letra do que sai, e acusar "mudou" ali é falso.
 */
const mergedShape = (spec: DocumentTemplateSpec): string => JSON.stringify([
  spec.format, spec.body, spec.content, spec.collection, spec.source, spec.datasets,
  spec.parameters, spec.sample, spec.fileName, spec.outputs,
]);

/** O arquivo lido como base64, sem o prefixo `data:` que o `FileReader` acrescenta. */
const readAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? '').replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * A autoria de UM modelo, numa aba própria — irmã da autoria de relatório. A aba diz o que abrir: um
 * modelo novo, um que existe, ou o clone de um que existe (`parseDocumentTemplateDesignTabKey`).
 */
export const useDocumentTemplateDesignViewModel = (tabKey: string): DocumentTemplateDesignViewModel => {
  const t = useT('core.documents');
  const label = useLabel();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { definitions, getDefinition } = useScreenDefinitions();
  const { getOptions } = useLookups();
  const { isLoading, saveTemplate } = useDocumentTemplates();
  const { openTab, setTabTitle } = useWorkspace();
  const catalog = useDocumentTemplateCatalog();
  const artifactPrefix = useArtifactPrefix();

  const target = useMemo(() => parseDocumentTemplateDesignTabKey(tabKey), [tabKey]);

  /** A chave gravada por ESTA aba: um modelo novo, depois de salvo, segue editado aqui. */
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DocumentTemplateSpec | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isStarterConfirmOpen, setIsStarterConfirmOpen] = useState(false);
  /** O modelo que já existe abre no texto, que é o que se veio mudar; o novo, no nome e na origem. */
  const [activeTab, setActiveTab] = useState<TemplateDesignTab>(target.mode === 'edit' ? 'content' : 'general');
  const [sidePanel, setSidePanel] = useState<TemplateSidePanel>('preview');
  const [previewTemplate, setPreviewTemplate] = useState<DocumentTemplateSpec | null>(null);

  const openKey = savedKey ?? (target.mode === 'edit' ? target.key : null);
  const isNew = openKey === null;

  const cloneSource = useMemo(
    () => (isNew && target.mode === 'clone' ? catalog.cloneOf(target.key) : null),
    [isNew, target, catalog],
  );

  const row = openKey ? catalog.rowOf(openKey) : null;
  const state: DocumentTemplateRowState | null = isNew ? 'tenant' : row?.state ?? null;
  const isEditable = isNew || state === 'tenant' || state === 'override';
  const notFound = !isLoading && (isNew ? target.mode === 'clone' && cloneSource === null : row === null);

  /**
   * O formulário é o RASCUNHO quando há edição em curso; sem ela, é o que a chave diz agora —
   * inclusive depois de um save, quando o store devolve o documento gravado.
   */
  const form = useMemo<DocumentTemplateSpec>(() => {
    if (draft) return draft;
    if (isNew) return cloneSource?.spec ?? EMPTY_TEMPLATE;
    return catalog.specFor(openKey) ?? EMPTY_TEMPLATE;
  }, [draft, isNew, cloneSource, catalog, openKey]);

  useEffect(() => {
    if (row) setTabTitle(tabKey, row.title);
  }, [row, tabKey, setTabTitle]);

  /** Escolher a tela à mão desfaz o vínculo pelo `sourceId` — senão ele continuaria vencendo a escolha. */
  const setForm = useCallback(
    (patch: Partial<DocumentTemplateSpec>) => {
      const next = { ...form, ...patch };
      if ('collection' in patch) delete next.screenSourceId;
      setDraft(next);
    },
    [form],
  );

  const setFormat = useCallback(
    (value: string) => {
      const format = DOCUMENT_TEMPLATE_FORMATS.find((one) => one === value) ?? 'markdown';
      const next: DocumentTemplateSpec = { ...form, format };
      if (format !== 'text') {
        delete next.encoding;
        delete next.lineEnding;
      }
      setDraft(next);
    },
    [form],
  );

  const keyRest = withoutArtifactPrefix(artifactPrefix, 'artifact', form.key);
  const setKeyRest = useCallback(
    (rest: string) => setForm({ key: withArtifactPrefix(artifactPrefix, 'artifact', rest) }),
    [setForm, artifactPrefix],
  );

  const keyTaken = isNew && catalog.isKeyTaken(form.key);

  const issues = useMemo<TemplateIssueLine[]>(() => {
    if (!isEditable) return [];
    const found = documentTemplateIssues(form).map((one) => ({
      field: one.field,
      message: label(one.error, one.errorParams),
      isGrammar: isGrammarIssue(one),
    }));
    return keyTaken
      ? [...found, { field: 'key', message: t('template.key.taken', { key: form.key }), isGrammar: false }]
      : found;
  }, [form, isEditable, label, keyTaken, t]);

  const issuesFor = useCallback(
    (field: string) => issues.filter((one) => isFieldOf(one.field, [field])),
    [issues],
  );

  const contentIssues = useMemo(
    () => issues.filter((one) => !SETTINGS_TABS.some((tab) => isFieldOf(one.field, TAB_FIELDS[tab]))),
    [issues],
  );

  const blockingIssues = issues.some((one) => !one.isGrammar);

  const isPayload = isPayloadTemplate(form);
  const payload = useTemplatePayloadEditor(form, setForm);

  const tabs = useMemo<TemplateDesignTabItem[]>(
    () => [
      ...SETTINGS_TABS.map((tab) => {
        const own = issues.filter((one) => isFieldOf(one.field, TAB_FIELDS[tab]));
        const sampleBroken = tab === 'data' && payload.sampleInvalid;
        return {
          key: tab,
          label: t(`tab.${tab}`),
          count: tab === 'data'
            ? (isPayload ? payload.parameters.length : (form.datasets ?? []).length)
            : 0,
          issueCount: own.length + (sampleBroken ? 1 : 0),
          hasBlockingIssue: sampleBroken || own.some((one) => !one.isGrammar),
        };
      }),
      {
        key: 'content' as const,
        label: t('tab.content'),
        count: 0,
        issueCount: contentIssues.length,
        hasBlockingIssue: contentIssues.some((one) => !one.isGrammar),
      },
    ],
    [issues, contentIssues, payload.sampleInvalid, payload.parameters.length, isPayload, form.datasets, t],
  );

  const screenOptions = useMemo(
    () => definitions
      // Sem a aba Documentos a tela ainda gera — para Downloads. Ela só entra quando é esse o destino.
      .filter((definition) =>
        definition.hasDocuments || form.destination === 'downloads' || definition.id === form.collection)
      .map((definition) => ({ value: definition.id, label: label(definition.titlePlural), meta: definition.id })),
    [definitions, label, form.destination, form.collection],
  );

  const sourceOptions = useMemo(
    () => [
      { value: 'record', label: t('source.record') },
      { value: 'payload', label: t('source.payload') },
    ],
    [t],
  );

  /**
   * Trocar a origem leva junto o que só faz sentido na outra: o modelo de dados não tem tela, lista
   * filha nem anexo ao registro; o de registro não declara parâmetros nem exemplo.
   */
  const setSource = useCallback(
    (value: string) => {
      const source: DocumentTemplateSource = value === 'payload' ? 'payload' : 'record';
      if (source === 'payload') {
        setForm({ source, collection: '', datasets: undefined, destination: 'downloads' });
      } else {
        setForm({ source, parameters: undefined, sample: undefined });
      }
    },
    [setForm],
  );

  const destinationOptions = useMemo(
    () => [
      ...(isPayload ? [] : [{ value: 'record', label: t('destination.record') }]),
      { value: 'downloads', label: t('destination.downloads') },
    ],
    [t, isPayload],
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
      { value: 'text', label: t('format.text') },
    ],
    [t],
  );

  const encodingOptions = useMemo(
    () => DOCUMENT_TEXT_ENCODINGS.map((value) => ({ value, label: t(`encoding.${value}`) })),
    [t],
  );

  const lineEndingOptions = useMemo(
    () => DOCUMENT_LINE_ENDINGS.map((value) => ({ value, label: t(`line-ending.${value}`) })),
    [t],
  );

  const documentTypeOptions = useMemo(
    () => getOptions('documentTypes').map((option) => ({ value: option.key, label: option.label })),
    [getOptions],
  );

  const orderDirectionOptions = useMemo(
    () => [
      { value: 'asc', label: t('dataset.order.asc') },
      { value: 'desc', label: t('dataset.order.desc') },
    ],
    [t],
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
        order: datasetOrder(dataset),
      };
    }),
    [form.datasets, form.collection, getDefinition, label],
  );

  const save = useCallback(async () => {
    if (!isEditable || keyTaken) return;
    if (documentTemplateIssues(form).some((one) => !isGrammarIssue(one))) return;
    setIsSaving(true);
    try {
      // A cópia personalizada guarda de que original saiu; regravá-la sem isso apagaria o aviso.
      const basedOn = isNew ? undefined : catalog.basedOnOf(form.key);
      await saveTemplate({ ...specOf(form), enabled: true, ...(basedOn ? { basedOn } : {}) });
      notify(t('template.saved'), 'success');
      setSavedKey(form.key);
      setDraft(null);
    } catch {
      notify(t('template.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isEditable, keyTaken, form, isNew, catalog, saveTemplate, notify, t]);

  const customize = useCallback(async () => {
    if (!openKey) return;
    if (await catalog.customize(openKey)) setDraft(null);
  }, [openKey, catalog]);

  const clone = useCallback(() => {
    if (openKey) openTab(buildDocumentTemplateCloneTabKey(openKey));
  }, [openKey, openTab]);

  const toggleDisabled = useCallback(async () => {
    if (!openKey) return;
    await catalog.toggleDisabled(openKey);
    setDraft(null);
  }, [openKey, catalog]);

  const keepCopy = useCallback(async () => {
    if (openKey) await catalog.keepCopy(openKey);
  }, [openKey, catalog]);

  const askRemove = useCallback(() => setIsRemoveOpen(true), []);
  const cancelRemove = useCallback(() => setIsRemoveOpen(false), []);

  /** Restaurar devolve o original nesta mesma aba; excluir leva de volta à lista, como no relatório. */
  const confirmRemove = useCallback(async () => {
    if (!openKey) return;
    const restoring = state === 'override';
    setIsRemoving(true);
    try {
      const removed = await catalog.remove(openKey);
      if (removed) {
        setDraft(null);
        if (!restoring) openTab(DOCUMENT_TEMPLATES_TAB);
      }
    } finally {
      setIsRemoving(false);
      setIsRemoveOpen(false);
    }
  }, [openKey, state, catalog, openTab]);

  const handleDocxFile = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > DOCUMENT_TEMPLATE_MAX_BYTES) {
      notify(t('template.content.too-large', { maxKb: String(DOCUMENT_TEMPLATE_MAX_BYTES / 1024) }), 'error');
      return;
    }
    readAsBase64(file)
      .then((content) => setDraft({ ...form, format: 'docx', content, body: undefined }))
      .catch(() => notify(t('template.content.invalid'), 'error'));
  }, [form, notify, t]);

  const dateFormat = t('starter.date-format');
  const helpGroups = useMemo(() => templateHelpFor(form.format, dateFormat), [form.format, dateFormat]);
  const openFunctionReference = useCallback(() => openTab('function-reference'), [openTab]);

  const starterScreen = form.format === 'markdown' && !isPayload ? getDefinition(form.collection) : undefined;

  /** O campo-título da tela de uma coleção — o que o modelo inicial imprime de uma referência. */
  const titleFieldOf = useCallback(
    (collection: string) =>
      (definitions.find((one) => screenDataCollection(one) === collection) ?? getDefinition(collection))?.titleFieldKey,
    [definitions, getDefinition],
  );

  /**
   * Aplica o modelo inicial. As listas que o escritório já declarou ficam — o modelo inicial só
   * ACRESCENTA as que faltam —, e o nome do arquivo só é sugerido quando ainda está vazio.
   */
  const applyStarter = useCallback(() => {
    if (isPayload) {
      setForm({
        body: buildPayloadStarterTemplate({
          title: label(form.title),
          parameters: form.parameters ?? [],
          titleFieldOf,
          label,
          texts: {
            comment: t('starter.comment.payload'),
            dateFormat,
            yes: t('starter.yes'),
            no: t('starter.no'),
          },
        }),
      });
      setIsStarterConfirmOpen(false);
      return;
    }
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
  }, [isPayload, form.title, form.parameters, titleFieldOf, starterScreen, definitions, label, t, dateFormat, form.datasets, form.fileName, setForm]);

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

  /**
   * Grava a ordem de uma lista na forma mais simples que a diz: uma chave completa vira o texto de
   * sempre (`orderBy` + `direction`), e só duas ou mais — ou uma ainda sem campo — viram a lista.
   * Assim o modelo de uma chave continua igual ao que era, e não passa a exigir kernel novo.
   */
  const writeOrder = useCallback(
    (index: number, order: QueryOrderBy[]) =>
      setForm({
        datasets: (form.datasets ?? []).map((dataset, at) => {
          if (at !== index) return dataset;
          const rest = { ...dataset };
          delete rest.orderBy;
          delete rest.direction;
          if (order.length === 0) return rest;
          if (order.length === 1 && order[0].path) {
            return { ...rest, orderBy: order[0].path, ...(order[0].dir === 'desc' ? { direction: 'desc' as const } : {}) };
          }
          return { ...rest, orderBy: order };
        }),
      }),
    [form.datasets, setForm],
  );

  const addOrderKey = useCallback(
    (index: number) => {
      const current = datasetOrder(form.datasets?.[index] ?? {});
      writeOrder(index, [...current, { path: '', dir: current[current.length - 1]?.dir ?? 'asc' }]);
    },
    [form.datasets, writeOrder],
  );

  const updateOrderKey = useCallback(
    (index: number, position: number, patch: Partial<QueryOrderBy>) =>
      writeOrder(
        index,
        datasetOrder(form.datasets?.[index] ?? {}).map((order, at) => (at === position ? { ...order, ...patch } : order)),
      ),
    [form.datasets, writeOrder],
  );

  const removeOrderKey = useCallback(
    (index: number, position: number) =>
      writeOrder(index, datasetOrder(form.datasets?.[index] ?? {}).filter((_order, at) => at !== position)),
    [form.datasets, writeOrder],
  );

  const canPreview = !blockingIssues && !payload.sampleInvalid
    && (form.format === 'docx' ? !!form.content : !!form.body?.trim());

  /** A prévia mescla o modelo COMO ESTÁ no clique — e só no clique: digitar não chama o servidor. */
  const runPreview = useCallback(() => {
    setPreviewTemplate(form);
    setSidePanel('preview');
  }, [form]);

  const screenLabel = isPayload
    ? t('source.payload')
    : form.collection ? row?.screenLabel ?? label(getDefinition(form.collection)?.titlePlural ?? form.collection) : null;

  const headerMeta: DesignerMetaItem[] = [
    ...(form.key ? [{ text: form.key, code: true }] : []),
    ...(screenLabel ? [{ text: screenLabel }] : []),
    { text: t(`format.${form.format}`) },
  ];

  return {
    canManage: can(PERMISSION_DOCUMENT_TEMPLATES_MANAGE),
    headerMeta,
    notFound,
    heading: label(form.title).trim() || t('template.new'),
    titleText: isEditable ? form.title : label(form.title),
    screenLabel,
    state,
    outdated: row?.outdated ?? false,
    extension: row?.extension ?? null,
    isNew,
    clonedFrom: isNew ? cloneSource?.sourceTitle ?? null : null,
    isEditable,
    isReadOnly: !isEditable,
    form,
    setForm,
    artifactPrefix,
    keyRest,
    setKeyRest,
    issuesFor,
    contentIssues,
    screenOptions,
    childScreenOptions,
    formatOptions,
    setFormat,
    isLayoutText: form.format === 'text',
    encodingOptions,
    lineEndingOptions,
    documentTypeOptions,
    destinationOptions,
    orderDirectionOptions,
    retentionText: form.retentionDays === undefined ? '' : String(form.retentionDays),
    setRetentionText,
    datasetOptions,
    isPayload,
    sourceOptions,
    setSource,
    payload,
    tabs,
    activeTab,
    setActiveTab,
    sidePanel,
    setSidePanel,
    previewTemplate,
    previewStale: previewTemplate !== null && mergedShape(previewTemplate) !== mergedShape(form),
    canPreview,
    runPreview,
    helpGroups,
    openFunctionReference,
    canInsertStarter: isEditable && form.format === 'markdown'
      && (isPayload ? (form.parameters ?? []).length > 0 : !!starterScreen),
    insertStarter,
    isStarterConfirmOpen,
    confirmStarter: applyStarter,
    cancelStarter,
    handleDocxFile,
    addDataset,
    updateDataset,
    removeDataset,
    addOrderKey,
    updateOrderKey,
    removeOrderKey,
    isSaving,
    // Um modelo novo (clone incluído) pode ser salvo como nasceu; um que existe, só depois de mudar.
    canSave: isEditable && (isNew || draft !== null) && !blockingIssues && !keyTaken && !isSaving && !payload.sampleInvalid,
    save,
    customize,
    clone,
    toggleDisabled,
    keepCopy,
    isRemoveOpen,
    isRemoving,
    askRemove,
    cancelRemove,
    confirmRemove,
  };
};
