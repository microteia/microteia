import { FieldValue } from 'firebase-admin/firestore';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import { resolveLabel } from '../../domain/schema/i18n/messageRef';
import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import type { SchemaContext, SchemaScreen } from '../../domain/schema/screenEntity';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import { grants } from '../../domain/schema/access/memberPermissions';
import { PERMISSION_DOCUMENT_TEMPLATES_MANAGE, PERMISSION_DOCUMENTS_GENERATE } from '../../domain/schema/access/kernelPermissions';
import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../domain/schema/fieldExpression';
import type {
  DocumentTemplate,
  DocumentTemplateDataset,
  DocumentTemplateFormat,
  DocumentTemplateSpec,
  TemplateScreenIndex,
} from '../../domain/schema/document/documentTemplate';
import {
  DOCUMENT_OUTPUTS_BY_FORMAT,
  DOCUMENT_TEMPLATES_COLLECTION,
  DOCUMENT_TEMPLATE_KEY_MAX_LENGTH,
  DOCUMENT_TEMPLATE_KEY_PATTERN,
  DOCUMENT_TEMPLATE_MAX_BYTES,
  documentTemplateFingerprint,
  documentTemplateIssues,
  documentTemplateOf,
  isGrammarIssue,
  isPayloadTemplate,
  isTemplateCopyOutdated,
  resolveDocumentTemplates,
  templateCollection,
  templateOutputs,
  templateScreenIndex,
} from '../../domain/schema/document/documentTemplate';
import { collectTemplatePaths, parseTemplate } from '../../domain/schema/document/templateGrammar';
import { templatePathIssues } from '../../domain/schema/document/templatePaths';
import type { StarterTexts } from '../../domain/schema/document/starterTemplate';
import { buildStarterTemplate, starterFieldExpression } from '../../domain/schema/document/starterTemplate';
import { resolveAgentDocumentType } from '../../domain/schema/agent/agentDocument';
import type { AgentTemplateChange, AgentTemplateState } from '../../domain/schema/agent/agentOps';
import { AGENT_TEMPLATE_STATES, DOCUMENT_TEMPLATE_GRAMMAR } from '../../domain/schema/agent/agentOps';
import { DocumentRenderError } from '../../domain/repositories/IDocumentRenderer';
import { TemplateDocumentRenderer } from '../../data/services/document/TemplateDocumentRenderer';
import { loadedExpressionFunctions } from '../../domain/engine/expression/ExpressionEngine';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { identifyActor } from '../workflow/identifyActor';
import { documentTypeOptions } from './agentDocuments';
import { agentText } from './agentMessages';
import type { AgentSession } from './authenticateAgent';

/**
 * Os modelos de documento pelo caminho do agente de IA.
 *
 * A tela de modelos e o agente fazem os MESMOS gestos sobre os MESMOS documentos: personalizar é
 * copiar o da extensão para a mesma chave com a impressão digital do original (`basedOn`), restaurar
 * é apagar a cópia, desligar é gravar a chave com `enabled: false`. Nada aqui inventa um estado que a
 * tela não saiba mostrar.
 *
 * O agente fala de COLEÇÃO (é o que `list_screens` lhe dá); o modelo gravado fala de TELA (a chave). A
 * tradução acontece nas duas pontas deste arquivo e em nenhum outro lugar.
 */

export type TemplateOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: string; params?: Record<string, string>; details?: Record<string, unknown> };

const refuse = (
  error: string,
  params?: Record<string, string>,
  details?: Record<string, unknown>,
): TemplateOutcome => ({ ok: false, error, ...(params ? { params } : {}), ...(details ? { details } : {}) });

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asRecord = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value)) ? (value as Record<string, unknown>) : {};

const withoutUndefined = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));

const templatesPath = (tenantId: string): string => `tenants/${tenantId}/${DOCUMENT_TEMPLATES_COLLECTION}`;

/** Tudo o que os gestos precisam ler, numa ida só. */
interface TemplateWorld {
  packaged: Map<string, { spec: DocumentTemplateSpec; pluginId: string }>;
  office: Map<string, DocumentTemplate>;
  contributions: QualifiedContribution[];
  screens: SchemaScreen[];
  index: TemplateScreenIndex;
}

const loadWorld = async (tenantId: string): Promise<TemplateWorld> => {
  const di = getDI();
  const [contributions, snapshot, screens] = await Promise.all([
    di.getInstalledExtensionCache().documentTemplates(tenantId),
    getDb().collection(templatesPath(tenantId)).get(),
    di.getScreenDefinitionCache().getScreens(tenantId),
  ]);
  const packaged = new Map<string, { spec: DocumentTemplateSpec; pluginId: string }>();
  for (const contribution of contributions) {
    const spec = documentTemplateOf(contribution);
    if (spec && !packaged.has(spec.key)) packaged.set(spec.key, { spec, pluginId: contribution.pluginId });
  }
  const office = new Map<string, DocumentTemplate>(snapshot.docs.map((doc) => {
    const data = doc.data();
    const key = typeof data.key === 'string' ? data.key : doc.id;
    return [key, { ...(data as Omit<DocumentTemplate, 'id'>), key, id: doc.id, updatedAt: null }];
  }));
  const index = templateScreenIndex(
    screens.map((screen) => ({ key: screen.id, sourceId: screen.sourceId, collection: screen.collection })),
  );
  return { packaged, office, contributions, screens, index };
};

const stateOf = (world: TemplateWorld, key: string): AgentTemplateState | null => {
  const own = world.office.get(key);
  if (own) return own.enabled === false ? 'disabled' : world.packaged.has(key) ? 'customized' : 'office';
  return world.packaged.has(key) ? 'extension' : null;
};

/** O spec que a chave MOSTRA: a cópia ligada do escritório, senão o da extensão, senão o desligado. */
const shownSpec = (world: TemplateWorld, key: string): DocumentTemplateSpec | null => {
  const own = world.office.get(key);
  if (own && own.enabled !== false) return own;
  return world.packaged.get(key)?.spec ?? own ?? null;
};

/** A coleção física da tela do modelo, ou `null` quando a tela não está instalada — ou não há tela. */
const physicalCollectionOf = (world: TemplateWorld, spec: DocumentTemplateSpec): string | null => {
  if (isPayloadTemplate(spec)) return null;
  const key = templateCollection(spec, world.index.keyOfSource);
  return key === null ? null : world.index.collectionOf(key);
};

const physicalDatasets = (world: TemplateWorld, datasets: readonly DocumentTemplateDataset[] | undefined) =>
  (datasets ?? []).map((dataset) => {
    const from = dataset.fromSourceId ? world.index.keyOfSource(dataset.fromSourceId) : dataset.from;
    return { ...dataset, from: from ? world.index.collectionOf(from) : '' };
  });

/**
 * A TELA de uma coleção como o agente a nomeia. Várias telas podem servir a mesma coleção; vale a que
 * leva o nome dela, depois a que tem a aba Documentos. A chave de uma tela também é aceita.
 */
const screenKeyOfCollection = (screens: readonly SchemaScreen[], collection: string): string | null => {
  const byKey = screens.find((screen) => screen.id === collection);
  if (byKey) return byKey.id;
  const serving = screens.filter((screen) => (screen.collection || screen.id) === collection);
  return (serving.find((screen) => screen.hasDocuments === true) ?? serving[0])?.id ?? null;
};

/** O spec como o agente o lê: coleções FÍSICAS, sem o endereçamento interno por `sourceId`. */
const agentSpec = (world: TemplateWorld, spec: DocumentTemplateSpec, catalog: MessageCatalog) => ({
  key: spec.key,
  title: resolveLabel(catalog, spec.title),
  ...(spec.description ? { description: resolveLabel(catalog, spec.description) } : {}),
  source: spec.source ?? 'record',
  ...(isPayloadTemplate(spec) ? {} : { collection: physicalCollectionOf(world, spec) }),
  ...(spec.parameters ? { parameters: spec.parameters } : {}),
  ...(spec.sample ? { sample: spec.sample } : {}),
  ...(spec.destination ? { destination: spec.destination } : {}),
  ...(spec.retentionDays !== undefined ? { retentionDays: spec.retentionDays } : {}),
  format: spec.format,
  outputs: templateOutputs(spec),
  ...(spec.fileName ? { fileName: spec.fileName } : {}),
  ...(spec.documentType ? { documentType: spec.documentType } : {}),
  ...(spec.datasets && spec.datasets.length > 0
    ? {
      datasets: physicalDatasets(world, spec.datasets).map((dataset) => withoutUndefined({
        name: dataset.name,
        from: dataset.from,
        via: dataset.via,
        orderBy: dataset.orderBy,
        direction: dataset.direction,
        limit: dataset.limit,
      })),
    }
    : {}),
});

/** Pode gerar pelo caminho mais comum: anexar ao registro, ou — no modelo de dados — gerar em Downloads. */
const canRender = (session: AgentSession, spec: DocumentTemplateSpec, collection: string | null): boolean =>
  isPayloadTemplate(spec)
    ? grants(session.permissions, PERMISSION_DOCUMENTS_GENERATE)
    : collection !== null && grants(session.permissions, collectionPermissionId(collection, 'update'));

const canManage = (session: AgentSession): boolean => grants(session.permissions, PERMISSION_DOCUMENT_TEMPLATES_MANAGE);

const translatedIssues = (catalog: MessageCatalog, issues: { field: string; error: string; errorParams?: Record<string, string> }[]) =>
  issues.map((issue) => ({ field: issue.field, ...agentText(catalog, issue.error, issue.errorParams) }));

export const listAgentDocumentTemplates = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<TemplateOutcome> => {
  const world = await loadWorld(session.tenantId);
  const wantedCollection = asText(input.collection);
  const wantedState = (AGENT_TEMPLATE_STATES as readonly string[]).includes(asText(input.state))
    ? asText(input.state)
    : 'all';
  const resolvable = new Set(
    resolveDocumentTemplates(world.contributions, [...world.office.values()], world.index).map((one) => one.key),
  );

  const templates = [...new Set([...world.packaged.keys(), ...world.office.keys()])]
    .flatMap((key) => {
      const spec = shownSpec(world, key);
      const state = stateOf(world, key);
      if (!spec || !state) return [];
      const view = agentSpec(world, spec, catalog);
      const collection = physicalCollectionOf(world, spec);
      if (wantedCollection && collection !== wantedCollection) return [];
      if (wantedState !== 'all' && state !== wantedState) return [];
      const own = world.office.get(key);
      const original = world.packaged.get(key);
      return [{
        ...view,
        state,
        ...(original ? { extension: original.pluginId } : {}),
        ...(state === 'customized' && own && original && isTemplateCopyOutdated(own, original.spec) ? { outdated: true } : {}),
        // Fora de circulação sem ter sido desligado: a tela (ou uma lista) é de uma extensão que este
        // escritório não tem. O modelo existe, mas não é oferecido em registro nenhum.
        ...(state !== 'disabled' && !resolvable.has(key) ? { screenMissing: true } : {}),
        canRender: state !== 'disabled' && resolvable.has(key) && canRender(session, spec, collection),
      }];
    })
    .sort((left, right) => left.title.localeCompare(right.title));

  return { ok: true, value: { canManage: canManage(session), templates } };
};

const renderer = new TemplateDocumentRenderer();

/** O texto que o kernel LÊ do modelo — no Word, o remontado. `null` com o motivo quando não lê. */
const readableText = (spec: DocumentTemplateSpec): { ok: true; text: string } | { ok: false; error: string; params: Record<string, string> } => {
  try {
    return { ok: true, text: renderer.templateText(spec) };
  } catch (cause) {
    if (cause instanceof DocumentRenderError) return { ok: false, error: cause.reference, params: cause.params };
    throw cause;
  }
};

/**
 * O caminho de um modelo `payload` que não começa num parâmetro declarado sai vazio. Sem parâmetros
 * declarados não há contra o que conferir — qualquer objeto é aceito —, e nada é dito.
 */
const payloadPathWarnings = (spec: DocumentTemplateSpec, rootPaths: readonly string[], catalog: MessageCatalog) => {
  const declared = new Set((spec.parameters ?? []).map((parameter) => parameter.key));
  if (declared.size === 0) return [];
  return rootPaths
    .filter((path) => !declared.has(path.split('.')[0]))
    .map((path) => ({ path, scope: 'payload', ...agentText(catalog, '@core.documents/template.payload.path-unknown', { path }) }));
};

/** O que um agente precisa saber de um texto de modelo antes de confiar nele. */
const inspect = (
  world: TemplateWorld,
  schema: SchemaContext,
  spec: DocumentTemplateSpec,
  text: string,
  catalog: MessageCatalog,
) => {
  const collection = physicalCollectionOf(world, spec);
  const paths = collectTemplatePaths(parseTemplate(text).nodes);
  const pathWarnings = isPayloadTemplate(spec)
    ? payloadPathWarnings(spec, paths.root, catalog)
    : collection === null
    ? []
    : templatePathIssues(schema, collection, physicalDatasets(world, spec.datasets), [text, spec.fileName ?? ''])
      .map((issue) => ({ path: issue.path, scope: issue.scope, ...agentText(catalog, issue.error, issue.errorParams) }));
  return {
    fieldsRead: paths.root,
    issues: translatedIssues(catalog, documentTemplateIssues(spec)),
    ...(pathWarnings.length > 0 ? { pathWarnings } : {}),
  };
};

export const getAgentDocumentTemplate = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
  schema: SchemaContext,
): Promise<TemplateOutcome> => {
  const world = await loadWorld(session.tenantId);
  const key = asText(input.key);
  const state = stateOf(world, key);
  if (state === null) return refuse('@core.documents/render.template-not-found', { key });

  const version = asText(input.version) || 'effective';
  const spec = version === 'extension'
    ? world.packaged.get(key)?.spec
    : version === 'office'
      ? world.office.get(key)
      : shownSpec(world, key);
  if (!spec) {
    return refuse(
      version === 'extension' ? '@core.documents/agent.template.not-extension' : '@core.documents/agent.template.not-office',
      { key },
    );
  }

  const read = readableText(spec);
  const original = world.packaged.get(key);
  const own = world.office.get(key);
  return {
    ok: true,
    value: {
      ...agentSpec(world, spec, catalog),
      state,
      version,
      ...(original ? { extension: original.pluginId } : {}),
      ...(state === 'customized' && own && original && isTemplateCopyOutdated(own, original.spec) ? { outdated: true } : {}),
      ...(spec.format === 'markdown' ? { body: spec.body ?? '' } : {}),
      ...(spec.format === 'docx' && read.ok ? { text: read.text } : {}),
      ...(spec.format === 'docx' && input.includeContent === true ? { content: spec.content ?? '' } : {}),
      ...(read.ok
        ? inspect(world, schema, spec, read.text, catalog)
        : { issues: [{ field: 'content', ...agentText(catalog, read.error, read.params) }] }),
    },
  };
};

const starterTexts = (catalog: MessageCatalog): StarterTexts => ({
  fieldsComment: resolveLabel(catalog, '@core.documents/starter.comment.fields'),
  listComment: resolveLabel(catalog, '@core.documents/starter.comment.list'),
  dateFormat: resolveLabel(catalog, '@core.documents/starter.date-format'),
  yes: resolveLabel(catalog, '@core.documents/starter.yes'),
  no: resolveLabel(catalog, '@core.documents/starter.no'),
  generatedOn: resolveLabel(catalog, '@core.documents/starter.generated-on'),
});

/** As funções usáveis DENTRO das marcas: as da expressão de campo, com a descrição do catálogo. */
const templateFunctions = (catalog: MessageCatalog) => {
  const names = new Set(FIELD_EXPRESSION_FUNCTION_NAMES);
  return loadedExpressionFunctions().getAllDefinitions()
    .filter((definition) => names.has(definition.name))
    .map((definition) => ({
      name: definition.name,
      signature: definition.signature,
      description: resolveLabel(catalog, definition.description),
      ...(definition.example ? { example: definition.example } : {}),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
};

export const agentDocumentTemplateGuide = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<TemplateOutcome> => {
  const format = asText(input.format) as DocumentTemplateFormat;
  const collection = asText(input.collection);
  const guide = {
    format,
    produces: DOCUMENT_OUTPUTS_BY_FORMAT[format],
    maxDocxKb: DOCUMENT_TEMPLATE_MAX_BYTES / 1024,
    grammar: {
      summary: DOCUMENT_TEMPLATE_GRAMMAR.summary,
      tags: DOCUMENT_TEMPLATE_GRAMMAR.tags,
      blocks: DOCUMENT_TEMPLATE_GRAMMAR.blocks,
      rules: DOCUMENT_TEMPLATE_GRAMMAR.rules,
      key: DOCUMENT_TEMPLATE_GRAMMAR.key,
      payload: DOCUMENT_TEMPLATE_GRAMMAR.payload,
      ...(format === 'markdown' ? { markdown: DOCUMENT_TEMPLATE_GRAMMAR.markdown } : { docx: DOCUMENT_TEMPLATE_GRAMMAR.docx }),
    },
    functions: templateFunctions(catalog),
  };
  if (!collection) return { ok: true, value: guide };

  // Os campos de uma tela são esquema dela: a mesma cobrança de `describe_screen`.
  const permission = collectionPermissionId(collection, 'read');
  if (!grants(session.permissions, permission)) return refuse('@core.access/permission.denied', { permission });

  const screens = await getDI().getScreenDefinitionCache().getScreens(session.tenantId);
  const screenKey = screenKeyOfCollection(screens, collection);
  const screen = screens.find((one) => one.id === screenKey);
  if (!screen) return refuse('@core.automation/mutation.table.unknown', { table: collection });

  const label = (value: string): string => resolveLabel(catalog, value);
  const texts = starterTexts(catalog);
  const starter = buildStarterTemplate({ screen, screens, label, texts });
  const index = templateScreenIndex(
    screens.map((one) => ({ key: one.id, sourceId: one.sourceId, collection: one.collection })),
  );

  return {
    ok: true,
    value: {
      ...guide,
      screen: {
        collection,
        label: label(screen.titlePlural ?? screen.titleSingular),
        hasDocuments: screen.hasDocuments === true,
        fields: [...screen.fields]
          .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
          .map((field) => {
            const tag = starterFieldExpression(field, screens, texts, label);
            return {
              key: field.key,
              label: label(field.label),
              type: field.type,
              ...(tag !== null ? { tag } : { tag: null }),
            };
          }),
        lists: starter.datasets.map((dataset) => withoutUndefined({
          name: dataset.name,
          from: index.collectionOf(dataset.from),
          via: dataset.via,
          orderBy: dataset.orderBy,
        })),
        starter: {
          body: starter.body,
          ...(starter.fileName ? { fileName: starter.fileName } : {}),
          datasets: starter.datasets.map((dataset) => ({ ...dataset, from: index.collectionOf(dataset.from) })),
        },
      },
    },
  };
};

/** O `content` como base64 puro: sem o prefixo `data:` e sem as quebras que um codificador põe. */
const normalizedContent = (value: unknown): string | undefined =>
  (typeof value === 'string' ? value.replace(/^data:[^,]*,/, '').replace(/\s+/g, '') : undefined);

const SPEC_FIELDS = [
  'title', 'description', 'format', 'body', 'outputs', 'fileName', 'documentType',
  'source', 'parameters', 'sample', 'destination', 'retentionDays',
] as const;

type DatasetResolution = { ok: true; datasets: DocumentTemplateDataset[] } | { ok: false; collection: string };

const datasetsFromAgent = (screens: readonly SchemaScreen[], value: unknown): DatasetResolution => {
  const datasets: DocumentTemplateDataset[] = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const item = asRecord(raw);
    const from = screenKeyOfCollection(screens, asText(item.from));
    if (from === null) return { ok: false, collection: asText(item.from) };
    datasets.push(withoutUndefined({
      name: asText(item.name),
      from,
      via: asText(item.via),
      orderBy: asText(item.orderBy) || undefined,
      direction: item.direction === 'desc' || item.direction === 'asc' ? item.direction : undefined,
      limit: typeof item.limit === 'number' ? item.limit : undefined,
    }) as unknown as DocumentTemplateDataset);
  }
  return { ok: true, datasets };
};

const writeTemplate = async (
  session: AgentSession,
  spec: DocumentTemplateSpec,
  extra: { enabled: boolean; basedOn?: string },
): Promise<void> => {
  const actor = await identifyActor(session.userId, 'agent', session.permissions);
  await getDb().doc(`${templatesPath(session.tenantId)}/${spec.key}`).set({
    ...withoutUndefined({ ...spec, id: undefined, updatedAt: undefined, updatedBy: undefined, enabled: undefined, basedOn: undefined }),
    enabled: extra.enabled,
    ...(extra.basedOn ? { basedOn: extra.basedOn } : {}),
    updatedBy: actor.userId,
    updatedAt: FieldValue.serverTimestamp(),
  });
};

/** O que é só do escritório (o interruptor, a origem, o carimbo) não faz parte do conteúdo. */
const contentOf = (template: DocumentTemplateSpec): DocumentTemplateSpec => {
  const spec: Partial<DocumentTemplate> = { ...template };
  delete spec.id;
  delete spec.enabled;
  delete spec.basedOn;
  delete spec.updatedAt;
  delete spec.updatedBy;
  return spec as DocumentTemplateSpec;
};

export const saveAgentDocumentTemplate = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
  schema: SchemaContext,
): Promise<TemplateOutcome> => {
  const world = await loadWorld(session.tenantId);
  const key = asText(input.key);
  const own = world.office.get(key);

  if (own?.enabled === false) return refuse('@core.documents/agent.template.disabled', { key });
  // A chave de uma extensão só muda pelo caminho que guarda de que original a cópia saiu. Gravá-la
  // direto produziria uma cópia sem `basedOn`, que nunca avisaria de uma versão nova da extensão.
  if (!own && world.packaged.has(key)) return refuse('@core.documents/agent.template.extension-key', { key });

  const patch: Partial<DocumentTemplateSpec> = {};
  for (const field of SPEC_FIELDS) {
    if (input[field] !== undefined) (patch as Record<string, unknown>)[field] = input[field];
  }
  if (input.content !== undefined) patch.content = normalizedContent(input.content);

  const merged: DocumentTemplateSpec = { ...(own ? contentOf(own) : {}), ...patch, key } as DocumentTemplateSpec;

  // O modelo de dados não tem tela nem lista filha: o que sobrou de quando ele era de registro sai.
  if (isPayloadTemplate(merged)) {
    merged.collection = '';
    delete merged.screenSourceId;
    delete merged.datasets;
  } else if (input.collection !== undefined) {
    const screenKey = screenKeyOfCollection(world.screens, asText(input.collection));
    if (screenKey === null) return refuse('@core.automation/mutation.table.unknown', { table: asText(input.collection) });
    merged.collection = screenKey;
    delete merged.screenSourceId;
  }
  if (input.datasets !== undefined && !isPayloadTemplate(merged)) {
    const datasets = datasetsFromAgent(world.screens, input.datasets);
    if (!datasets.ok) return refuse('@core.automation/mutation.table.unknown', { table: datasets.collection });
    merged.datasets = datasets.datasets;
  }
  // Trocar o formato troca o conteúdo: um Markdown que carregasse o `.docx` antigo seria o dobro do
  // documento, e o editor da tela mostraria o arquivo de um formato que o modelo não tem mais.
  if (merged.format === 'markdown') delete merged.content;
  if (merged.format === 'docx') delete merged.body;

  if (input.documentType !== undefined && asText(input.documentType) !== '') {
    const options = await documentTypeOptions(session.tenantId, catalog);
    const resolved = resolveAgentDocumentType(options, asText(input.documentType));
    if (resolved === null) {
      return refuse('@core.access/agent.document.type-unknown', {
        type: asText(input.documentType),
        accepted: options.map((option) => option.key).join(', '),
      });
    }
    merged.documentType = resolved;
  }

  const shapeIssues = documentTemplateIssues(merged).filter((issue) => !isGrammarIssue(issue));
  const collection = physicalCollectionOf(world, merged);
  const screen = collection === null ? undefined : schema.screens.get(collection);
  // A aba só é exigida de quem, por padrão, anexa: um modelo que vai para Downloads serve a qualquer tela.
  const attaches = (merged.destination ?? 'record') === 'record';
  if (shapeIssues.length === 0 && attaches && collection !== null && screen?.hasDocuments !== true) {
    shapeIssues.push({ field: 'collection', error: '@core.documents/render.documents-disabled', errorParams: { collection } });
  }
  const read = shapeIssues.length === 0 ? readableText(merged) : null;
  if (read && !read.ok) shapeIssues.push({ field: 'content', error: read.error, errorParams: read.params });

  const report = read?.ok ? inspect(world, schema, merged, read.text, catalog) : { issues: translatedIssues(catalog, shapeIssues) };
  const created = !own;

  if (input.dry_run === true) {
    return { ok: true, value: { dryRun: true, valid: shapeIssues.length === 0, created, key, collection, ...report } };
  }
  if (shapeIssues.length > 0) {
    const [first] = shapeIssues;
    return refuse(first.error, first.errorParams, { issues: translatedIssues(catalog, shapeIssues) });
  }

  // A cópia personalizada guarda de que original saiu; regravá-la sem isso apagaria o aviso.
  await writeTemplate(session, merged, { enabled: true, ...(own?.basedOn ? { basedOn: own.basedOn } : {}) });
  return {
    ok: true,
    value: { saved: true, created, key, collection, state: world.packaged.has(key) ? 'customized' : 'office', ...report },
  };
};

/** A primeira chave livre a partir de `<chave>-copy`, dentro do teto e do padrão — a mesma da tela. */
const freeCopyKey = (key: string, taken: (candidate: string) => boolean): string => {
  const base = `${key.slice(0, DOCUMENT_TEMPLATE_KEY_MAX_LENGTH - '-copy-99'.length)}-copy`;
  if (!taken(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken(candidate)) return candidate;
  }
};

/** A cópia do original da extensão como a tela a grava ao Personalizar: título já no idioma do escritório. */
const customizedCopy = (
  world: TemplateWorld,
  spec: DocumentTemplateSpec,
  catalog: MessageCatalog,
): DocumentTemplateSpec => ({
  ...spec,
  title: resolveLabel(catalog, spec.title),
  collection: templateCollection(spec, world.index.keyOfSource) ?? spec.collection,
  ...(spec.datasets
    ? {
      datasets: spec.datasets.map((dataset) => ({
        ...dataset,
        from: (dataset.fromSourceId ? world.index.keyOfSource(dataset.fromSourceId) : dataset.from) ?? dataset.from,
      })),
    }
    : {}),
});

export const changeAgentDocumentTemplate = async (
  input: Record<string, unknown>,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<TemplateOutcome> => {
  const world = await loadWorld(session.tenantId);
  const key = asText(input.key);
  const action = asText(input.action) as AgentTemplateChange;
  const state = stateOf(world, key);
  if (state === null) return refuse('@core.documents/render.template-not-found', { key });

  const own = world.office.get(key);
  const original = world.packaged.get(key);
  const done = (value: Record<string, unknown>): TemplateOutcome => ({ ok: true, value: { key, action, ...value } });
  const remove = () => getDb().doc(`${templatesPath(session.tenantId)}/${own?.id ?? key}`).delete();

  switch (action) {
    case 'customize': {
      if (!original) return refuse('@core.documents/agent.template.not-extension', { key });
      if (state === 'disabled') return refuse('@core.documents/agent.template.disabled', { key });
      if (state === 'customized') return refuse('@core.documents/agent.template.already-customized', { key });
      await writeTemplate(session, customizedCopy(world, original.spec, catalog), {
        enabled: true,
        basedOn: documentTemplateFingerprint(original.spec),
      });
      return done({ state: 'customized' });
    }

    case 'keep-customization': {
      if (state !== 'customized' || !own || !original) return refuse('@core.documents/agent.template.not-customized', { key });
      await writeTemplate(session, contentOf(own), { enabled: true, basedOn: documentTemplateFingerprint(original.spec) });
      return done({ state: 'customized', outdated: false });
    }

    case 'restore': {
      if (state !== 'customized') return refuse('@core.documents/agent.template.not-customized', { key });
      await remove();
      return done({ state: 'extension' });
    }

    case 'disable': {
      if (state === 'disabled') return refuse('@core.documents/agent.template.already-disabled', { key });
      // A cópia do escritório é desligada COM o conteúdo dela — religar a devolve, não a apaga.
      const spec = own ?? original?.spec;
      if (!spec) return refuse('@core.documents/render.template-not-found', { key });
      await writeTemplate(session, contentOf(spec), { enabled: false, ...(own?.basedOn ? { basedOn: own.basedOn } : {}) });
      return done({ state: 'disabled' });
    }

    case 'enable': {
      if (state !== 'disabled' || !own) return refuse('@core.documents/agent.template.not-disabled', { key });
      // Desligar o modelo de uma extensão grava só a marca; religá-lo é apagá-la. Uma cópia
      // personalizada, ou um modelo do escritório, volta a valer como estava.
      if (original && !own.basedOn) {
        await remove();
        return done({ state: 'extension' });
      }
      await writeTemplate(session, contentOf(own), { enabled: true, ...(own.basedOn ? { basedOn: own.basedOn } : {}) });
      return done({ state: original ? 'customized' : 'office' });
    }

    case 'clone': {
      const source = shownSpec(world, key);
      if (!source) return refuse('@core.documents/render.template-not-found', { key });
      const taken = (candidate: string): boolean => world.office.has(candidate) || world.packaged.has(candidate);
      const newKey = asText(input.newKey) || freeCopyKey(DOCUMENT_TEMPLATE_KEY_PATTERN.test(key) ? key : 'template', taken);
      if (!DOCUMENT_TEMPLATE_KEY_PATTERN.test(newKey) || newKey.length > DOCUMENT_TEMPLATE_KEY_MAX_LENGTH) {
        return refuse('@core.documents/template.key.invalid', { key: newKey });
      }
      if (taken(newKey)) return refuse('@core.documents/template.key.taken', { key: newKey });
      const base = original && source === original.spec ? customizedCopy(world, source, catalog) : contentOf(source);
      const title = asText(input.title)
        || resolveLabel(catalog, '@core.documents/template.clone.title', { title: resolveLabel(catalog, source.title) });
      await writeTemplate(session, { ...base, key: newKey, title }, { enabled: true });
      return done({ state: 'office', newKey, title });
    }

    case 'delete': {
      if (original) return refuse('@core.documents/agent.template.extension-delete', { key });
      await remove();
      return done({ deleted: true });
    }

    default:
      return refuse('@core.automation/handler.action.not-found');
  }
};

/** O autor do documento gerado pelo agente: a pessoa dona do acesso, com `via: 'agent'`. */
export const agentDocumentAuthor = async (session: AgentSession) => {
  const actor = await identifyActor(session.userId, 'agent', session.permissions);
  return { uid: session.userId, name: actor.name, photoUrl: actor.photoURL, via: 'agent' as const };
};
