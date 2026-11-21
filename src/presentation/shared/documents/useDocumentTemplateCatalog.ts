import { useCallback, useMemo } from 'react';
import { useContributions } from '../../../stores/useKernel';
import { useDocumentTemplates } from '../../../stores/useDocumentTemplates';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import type {
  DocumentTemplate,
  DocumentTemplateFormat,
  DocumentTemplateSpec,
} from '../../../domain/schema/document/documentTemplate';
import {
  DOCUMENT_TEMPLATE_KEY_MAX_LENGTH,
  DOCUMENT_TEMPLATE_KEY_PATTERN,
  DOCUMENT_TEMPLATE_POINT,
  documentTemplateFingerprint,
  documentTemplateOf,
  isPayloadTemplate,
  isTemplateCopyOutdated,
  templateCollection,
} from '../../../domain/schema/document/documentTemplate';
import { withArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';
import { useScreenKeyOfSource } from './useResolvedDocumentTemplates';
import { useExtensionName } from '../extensions/useExtensionName';
import { useArtifactPrefix } from '../settings/useArtifactPrefix';
import { useLabel, useT } from '../i18n/useT';

/**
 * O estado de uma chave, do ponto de vista de quem administra:
 * - `plugin`: só a extensão declara — somente leitura, personalizável;
 * - `override`: o escritório substitui o da extensão na mesma chave;
 * - `disabled`: o escritório desligou a chave;
 * - `tenant`: o modelo é do escritório, sem extensão por trás.
 */
export type DocumentTemplateRowState = 'plugin' | 'override' | 'disabled' | 'tenant';

export const DOCUMENT_TEMPLATE_ROW_STATES: readonly DocumentTemplateRowState[] = ['plugin', 'override', 'disabled', 'tenant'];

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

export const EMPTY_TEMPLATE: DocumentTemplateSpec = {
  key: '',
  title: '',
  collection: '',
  format: 'markdown',
  body: '',
};

/** O spec sem o que o documento gravado acrescenta (`enabled`, `basedOn`, ids) — o que se edita e se grava. */
export const specOf = (template: DocumentTemplateSpec): DocumentTemplateSpec => ({
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
  ...(template.source ? { source: template.source } : {}),
  ...(template.parameters ? { parameters: template.parameters } : {}),
  ...(template.sample ? { sample: template.sample } : {}),
  ...(template.destination ? { destination: template.destination } : {}),
  ...(template.retentionDays !== undefined ? { retentionDays: template.retentionDays } : {}),
});

/** A primeira chave livre a partir de `<chave>-copy`, dentro do teto e do padrão de chave. */
const freeCopyKey = (key: string, taken: (candidate: string) => boolean): string => {
  const base = `${key.slice(0, DOCUMENT_TEMPLATE_KEY_MAX_LENGTH - '-copy-99'.length)}-copy`;
  if (!taken(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken(candidate)) return candidate;
  }
};

export interface DocumentTemplateClone {
  spec: DocumentTemplateSpec;
  /** O título do original, para o aviso de que o rascunho é cópia dele. */
  sourceTitle: string;
}

export interface DocumentTemplateCatalog {
  rows: DocumentTemplateRow[];
  rowOf: (key: string) => DocumentTemplateRow | null;
  /** O que a chave vale AGORA, com a tela pela chave instalada — `null` quando ela não existe. */
  specFor: (key: string) => DocumentTemplateSpec | null;
  /** A chave já é de um modelo, do escritório ou de extensão. */
  isKeyTaken: (key: string) => boolean;
  /** A cópia gravada pelo escritório, para regravar sem perder de que original ela saiu. */
  basedOnOf: (key: string) => string | undefined;
  /** O rascunho de um modelo NOVO do escritório com o conteúdo de `key` — chave própria, nada substituído. */
  cloneOf: (key: string) => DocumentTemplateClone | null;
  /** Personalizar é COPIAR o da extensão para a mesma chave — a cópia vence, e apagá-la devolve o original. */
  customize: (key: string) => Promise<boolean>;
  /** Dá a cópia personalizada por conferida diante do original atual da extensão, sem mudar o conteúdo. */
  keepCopy: (key: string) => Promise<void>;
  toggleDisabled: (key: string) => Promise<void>;
  /** Apaga a versão do escritório: o modelo dele some; a cópia de um da extensão devolve o original. */
  remove: (key: string) => Promise<boolean>;
}

/**
 * O catálogo de modelos como quem administra o vê — os das extensões e os do escritório, numa linha por
 * chave — e os gestos que mudam o ESTADO de uma chave. A lista e a autoria usam os mesmos: são duas
 * telas sobre o mesmo catálogo, e um gesto que só uma delas soubesse fazer daria dois resultados.
 */
export const useDocumentTemplateCatalog = (): DocumentTemplateCatalog => {
  const t = useT('core.documents');
  const label = useLabel();
  const { notify } = useNotification();
  const { getDefinition } = useScreenDefinitions();
  const { templates, saveTemplate, deleteTemplate } = useDocumentTemplates();
  const contributions = useContributions(DOCUMENT_TEMPLATE_POINT);
  const screenKeyOf = useScreenKeyOfSource();
  const extensionOf = useExtensionName();
  const artifactPrefix = useArtifactPrefix();

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
          screenLabel: isPayloadTemplate(shown) ? t('source.payload') : screenLabelOf(shown.collection),
          format: shown.format,
          state,
          pluginId: fromPackage?.pluginId ?? null,
          extension: extensionOf(fromPackage?.pluginId),
        };
      })
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [packaged, tenantByKey, label, screenLabelOf, installedSpec, extensionOf, t]);

  const rowOf = useCallback((key: string) => rows.find((row) => row.key === key) ?? null, [rows]);

  const specFor = useCallback(
    (key: string): DocumentTemplateSpec | null => {
      const own = tenantByKey.get(key);
      if (own && own.enabled !== false) return installedSpec(own);
      const spec = packaged.get(key)?.spec ?? own;
      return spec ? installedSpec(spec) : null;
    },
    [tenantByKey, packaged, installedSpec],
  );

  const isKeyTaken = useCallback(
    (key: string) => tenantByKey.has(key) || packaged.has(key),
    [tenantByKey, packaged],
  );

  const basedOnOf = useCallback((key: string) => tenantByKey.get(key)?.basedOn, [tenantByKey]);

  const cloneOf = useCallback(
    (key: string): DocumentTemplateClone | null => {
      const source = specFor(key);
      if (!source) return null;
      const sourceTitle = label(source.title);
      // A cópia é um modelo NOVO do escritório: nasce com o prefixo dele, venha o original de onde vier.
      const copyKey = freeCopyKey(
        withArtifactPrefix(artifactPrefix, 'artifact', DOCUMENT_TEMPLATE_KEY_PATTERN.test(source.key) ? source.key : 'template'),
        isKeyTaken,
      );
      return {
        spec: { ...specOf(source), key: copyKey, title: t('template.clone.title', { title: sourceTitle }) },
        sourceTitle,
      };
    },
    [specFor, label, artifactPrefix, isKeyTaken, t],
  );

  const customize = useCallback(
    async (key: string): Promise<boolean> => {
      const fromPackage = packaged.get(key);
      if (!fromPackage) return false;
      const copy = { ...installedSpec(fromPackage.spec), title: label(fromPackage.spec.title) };
      try {
        await saveTemplate({ ...copy, enabled: true, basedOn: documentTemplateFingerprint(fromPackage.spec) });
        notify(t('template.customized'), 'success');
        return true;
      } catch {
        notify(t('template.save-failed'), 'error');
        return false;
      }
    },
    [packaged, installedSpec, label, saveTemplate, notify, t],
  );

  const keepCopy = useCallback(
    async (key: string) => {
      const own = tenantByKey.get(key);
      const fromPackage = packaged.get(key);
      if (!own || !fromPackage) return;
      try {
        await saveTemplate({ ...specOf(own), enabled: true, basedOn: documentTemplateFingerprint(fromPackage.spec) });
        notify(t('template.outdated.kept'), 'success');
      } catch {
        notify(t('template.save-failed'), 'error');
      }
    },
    [tenantByKey, packaged, saveTemplate, notify, t],
  );

  /**
   * Desligar grava a chave com `enabled: false` — a cópia do escritório COM o conteúdo dela. Religar
   * apaga só a marca de um modelo de extensão; uma cópia personalizada ou um modelo do escritório
   * volta a valer como estava, em vez de ser apagado.
   */
  const toggleDisabled = useCallback(
    async (key: string) => {
      const own = tenantByKey.get(key);
      try {
        if (own?.enabled === false) {
          if (packaged.has(key) && !own.basedOn) await deleteTemplate(key);
          else await saveTemplate({ ...specOf(own), enabled: true, ...(own.basedOn ? { basedOn: own.basedOn } : {}) });
          notify(t('template.enabled'), 'success');
        } else {
          const spec = own ?? packaged.get(key)?.spec;
          if (!spec) return;
          await saveTemplate({ ...specOf(spec), enabled: false, ...(own?.basedOn ? { basedOn: own.basedOn } : {}) });
          notify(t('template.disabled'), 'success');
        }
      } catch {
        notify(t('template.save-failed'), 'error');
      }
    },
    [packaged, tenantByKey, deleteTemplate, saveTemplate, notify, t],
  );

  const remove = useCallback(
    async (key: string): Promise<boolean> => {
      const restoring = packaged.has(key);
      try {
        await deleteTemplate(key);
        notify(t(restoring ? 'template.restored' : 'template.deleted'), 'success');
        return true;
      } catch {
        notify(t('template.delete-failed'), 'error');
        return false;
      }
    },
    [packaged, deleteTemplate, notify, t],
  );

  // Estável entre renders: a autoria deriva o formulário dele, e um objeto novo a cada render faria a
  // prévia parecer sempre desatualizada.
  return useMemo(
    () => ({ rows, rowOf, specFor, isKeyTaken, basedOnOf, cloneOf, customize, keepCopy, toggleDisabled, remove }),
    [rows, rowOf, specFor, isKeyTaken, basedOnOf, cloneOf, customize, keepCopy, toggleDisabled, remove],
  );
};
