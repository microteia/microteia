import { mentionsBusinessDays, type BusinessCalendarSet } from '../schema/time/businessDays';
import { tableMentionsBusinessDays } from '../schema/recordRules';
import { evaluateFieldExpression } from '../schema/fieldExpression';
import { configuredLocale, setAmbientLocale } from '../schema/i18n/localeGate';
import type { SchemaContext } from '../schema/pathResolver';
import { resolveQueryTable } from '../schema/querySpec';
import { agentDocumentName, AGENT_DOCUMENT_MAX_BYTES } from '../schema/agent/agentDocument';
import type { DocumentOutputFormat, DocumentTemplateSpec, ResolvedDocumentTemplate } from '../schema/document/documentTemplate';
import { DOCUMENT_PAYLOAD_MAX_BYTES, isPayloadTemplate, templateOutputs } from '../schema/document/documentTemplate';
import type { TemplatePaths } from '../schema/document/templateGrammar';
import { collectRequiredIssues, formatAndValidateParameters } from '../schema/parameterRules';
import { PERMISSION_DOCUMENTS_GENERATE } from '../schema/access';
import type { DocumentDestination, DownloadPolicy, DownloadVisibility } from '../schema/document/documentDownloads';
import { downloadExpiresAt, resolveRetentionDays } from '../schema/document/documentDownloads';
import { grants } from '../schema/access';
import { collectionPermissionId } from '../schema/access/permission';
import type { RenderIssue, TemplateEvaluator } from '../schema/document/templateGrammar';
import { collectTemplatePaths, escapeMarkdownValue, parseTemplate, renderTemplate } from '../schema/document/templateGrammar';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IDocumentRenderer } from '../repositories/IDocumentRenderer';
import { DocumentRenderError } from '../repositories/IDocumentRenderer';
import type { IRecordDocumentWriter, RecordDocumentAuthor } from '../repositories/IRecordDocumentWriter';
import type { IDocumentRecordReader, IDocumentTemplateSource } from '../repositories/IDocumentGenerationPorts';
import type { IDownloadWriter } from '../repositories/IDownloadWriter';

export interface RenderDocumentRequest {
  tenantId: string;
  templateKey: string;
  /** O registro do modelo `record`. Ausente no modelo `payload`. */
  recordId?: string;
  /** Os dados do modelo `payload`, conferidos contra os `parameters` dele. */
  payload?: Record<string, unknown>;
  /**
   * Só na pré-visualização: o modelo como está no EDITOR, ainda não gravado. Vence `templateKey` — é o
   * que deixa conferir o texto antes de salvar.
   */
  draft?: DocumentTemplateSpec;
  /** Quando quem chama já sabe a tela, ela tem de ser a do modelo. */
  collection?: string;
  /** Ausente = o primeiro formato que o modelo produz. */
  output?: DocumentOutputFormat;
  fileName?: string;
  documentType?: string;
  author: RecordDocumentAuthor;
  /** As permissões de quem gera — o que `hasPermission` responde dentro do modelo. */
  permissions?: readonly string[];
  /** Ausente = o destino que o modelo declara, e `record` quando nem ele diz. */
  destination?: DocumentDestination;
  /** Dias em Downloads (`0` = não expira). Ausente = o do modelo, depois o do escritório. */
  expiresInDays?: number;
  /**
   * Cobrar de `permissions` a permissão que o DESTINO exige: `<coleção>.update` para anexar ao
   * registro, `<coleção>.read` para Downloads, que não altera o registro. É o caso de uso que cobra,
   * e não a porta, porque só ele sabe o destino quando quem chama não o diz — o padrão é do modelo.
   * A automação sem pessoa não cobra: ela age como o motor, como em toda gravação de registro.
   */
  chargePermissions?: boolean;
}

/** O arquivo gerado, onde quer que tenha ido parar. */
export interface GeneratedDocument {
  id: string;
  name: string;
  url: string;
  /** Só em Downloads: quando o item vence; `null` = não expira. */
  expiresAt?: Date | null;
}

export type RenderDocumentResult =
  | {
    ok: true;
    destination: DocumentDestination;
    document: GeneratedDocument;
    output: DocumentOutputFormat;
    issues: RenderIssue[];
  }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface RenderDocumentDeps {
  templates: IDocumentTemplateSource;
  screens: IScreenDefinitionProvider;
  records: IDocumentRecordReader;
  renderer: IDocumentRenderer;
  writer: IRecordDocumentWriter;
  downloads: IDownloadWriter;
  /** A retenção e a visibilidade que o escritório configurou para Downloads. */
  downloadPolicyOf(tenantId: string): Promise<DownloadPolicy>;
  now?: () => Date;
  /** O idioma e o fuso do ESCRITÓRIO: o documento é dele, e `formatMoney(valor)` fala a língua dele. */
  localeOf(tenantId: string): Promise<string>;
  timeZoneOf(tenantId: string): Promise<string>;
  /** Os calendários de dias úteis, lidos só quando o modelo ou um campo derivado conta dias úteis. */
  businessCalendarsOf?(tenantId: string): Promise<BusinessCalendarSet | null>;
}

/**
 * O documento MESCLADO como texto, sem gerar arquivo nem anexar. No Markdown é o próprio Markdown com
 * os valores no lugar das marcas; no Word, o texto do documento remontado. É o que deixa quem escreve
 * o modelo — uma pessoa ou um agente de IA — conferir o resultado contra um registro de verdade antes
 * de deixar uma cópia na aba Documentos.
 */
export type PreviewDocumentResult =
  | { ok: true; text: string; fileName: string; output: DocumentOutputFormat; issues: RenderIssue[] }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface RenderDocumentUseCase {
  execute(request: RenderDocumentRequest): Promise<RenderDocumentResult>;
  preview(request: Omit<RenderDocumentRequest, 'author'>): Promise<PreviewDocumentResult>;
}

type Failure = { ok: false; error: string; errorParams?: Record<string, string> };

const failure = (error: string, errorParams?: Record<string, string>): Failure =>
  errorParams ? { ok: false, error, errorParams } : { ok: false, error };
const documentsScreen = (schema: SchemaContext, collection: string) => schema.screens.get(collection);

/**
 * O avaliador do documento: a expressão de CAMPO, com o idioma do escritório empurrado só durante a
 * avaliação. A avaliação é síncrona, então nada se intercala entre empurrar e devolver — é o mesmo
 * cuidado de `evaluateFieldExpression` com as permissões e o instante.
 */
const evaluatorFor = (
  collection: string,
  locale: string,
  timeZone: string,
  permissions: readonly string[] | undefined,
  businessCalendars: BusinessCalendarSet | null | undefined,
): TemplateEvaluator => (expr, scope) => {
  const previous = configuredLocale();
  setAmbientLocale(locale);
  try {
    return evaluateFieldExpression(expr, {
      value: null,
      data: scope,
      entity: collection,
      timeZone,
      ...(businessCalendars !== undefined ? { businessCalendars } : {}),
      ...(permissions ? { permissions } : {}),
    });
  } finally {
    setAmbientLocale(previous);
  }
};

/**
 * Gerar um documento a partir de um modelo — sobre um REGISTRO ou sobre um PAYLOAD — e entregá-lo
 * no DESTINO: a aba Documentos do registro ou a tela Downloads.
 *
 * É UM caminho para as três portas — o passo "Gerar documento", o gesto do registro e o agente —, e
 * por isso o documento que a pessoa gera na tela é o mesmo que a automação gera de madrugada.
 *
 * A ordem das recusas é a da pergunta que se faria a mão: o modelo existe, ele produz o formato
 * pedido, quem pede pode entregar ali, a tela tem a aba Documentos (só quando o destino é ela), o
 * registro existe — ou, no payload, ele cumpre o contrato e as referências existem. Só então o
 * arquivo é montado — nada é gravado antes de tudo ter dado certo.
 */
interface PreparedDocument {
  template: ResolvedDocumentTemplate;
  destination: DocumentDestination;
  output: DocumentOutputFormat;
  /** A coleção do registro de origem; `null` no modelo `payload`, que não tem registro. */
  physicalCollection: string | null;
  templateText: string;
  fileNameTemplate: string;
  scope: Record<string, unknown>;
  evaluate: TemplateEvaluator;
}

type PrepareMode = 'render' | 'preview';

type Prepared = { ok: true; value: PreparedDocument } | Failure;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** O texto do modelo e o do nome do arquivo, e os caminhos que os dois leem. */
const readTemplateText = (
  deps: RenderDocumentDeps,
  template: ResolvedDocumentTemplate,
  request: Omit<RenderDocumentRequest, 'author'>,
): { ok: true; templateText: string; fileNameTemplate: string; paths: TemplatePaths } | Failure => {
  let templateText: string;
  try {
    templateText = deps.renderer.templateText(template);
  } catch (cause) {
    if (cause instanceof DocumentRenderError) return failure(cause.reference, cause.params);
    throw cause;
  }
  const fileNameTemplate = (request.fileName ?? template.fileName ?? '').trim();
  const paths = collectTemplatePaths([
    ...parseTemplate(templateText).nodes,
    ...parseTemplate(fileNameTemplate).nodes,
  ]);
  return { ok: true, templateText, fileNameTemplate, paths };
};

const charge = (request: Omit<RenderDocumentRequest, 'author'>, permission: string): Failure | null =>
  request.chargePermissions && !grants(request.permissions ?? [], permission)
    ? failure('@core.access/permission.denied', { permission })
    : null;

/**
 * Tudo o que vem antes de montar o arquivo: as recusas, na ordem da pergunta que se faria à mão, e a
 * leitura dos dados. A geração e a pré-visualização partem DAQUI, e por isso o texto pré-visualizado
 * é o texto que o documento terá.
 *
 * Os dois caminhos — registro e payload — só diferem em COMO o escopo é montado. O que vem depois
 * (gramática, avaliador, renderizador, destino) não sabe de qual deles o escopo veio.
 */
const prepare = async (
  deps: RenderDocumentDeps,
  request: Omit<RenderDocumentRequest, 'author'>,
  mode: PrepareMode,
): Promise<Prepared> => {
  // O rascunho do editor só vale na pré-visualização: gerar um arquivo é sempre de um modelo gravado.
  const draft = mode === 'preview' ? request.draft : undefined;
  const template = draft
    ? await deps.templates.resolveDraft(request.tenantId, draft)
    : (await deps.templates.resolve(request.tenantId)).find((one) => one.key === request.templateKey);
  if (!template) return failure('@core.documents/render.template-not-found', { key: draft?.key ?? request.templateKey });

  const outputs = templateOutputs(template);
  const output = request.output ?? outputs[0];
  if (!output || !outputs.includes(output)) {
    return failure('@core.documents/render.output-unsupported', { format: template.format, output: String(output ?? '') });
  }

  return isPayloadTemplate(template)
    ? preparePayload(deps, request, template, output, mode)
    : prepareRecord(deps, request, template, output, mode);
};

const prepareRecord = async (
  deps: RenderDocumentDeps,
  request: Omit<RenderDocumentRequest, 'author'>,
  template: ResolvedDocumentTemplate,
  output: DocumentOutputFormat,
  mode: PrepareMode,
): Promise<Prepared> => {
    const collection = template.collection;
    if (request.collection && request.collection !== collection) {
      return failure('@core.documents/render.collection-mismatch', { key: template.key, collection: request.collection });
    }
    if (!request.recordId) return failure('@core.documents/render.record-missing', { key: template.key });

    const schema = await deps.screens.getSchemaContext(request.tenantId);
    const table = resolveQueryTable(collection, schema);
    if (!table || !documentsScreen(schema, collection)) {
      return failure('@core.automation/mutation.table.unknown', { table: collection });
    }

    const destination = request.destination ?? template.destination ?? 'record';
    // A pré-visualização não entrega nada: cobra só a leitura, qualquer que seja o destino.
    const attaches = mode === 'render' && destination === 'record';
    const denied = charge(request, collectionPermissionId(collection, attaches ? 'update' : 'read'));
    if (denied) return denied;
    if (attaches && documentsScreen(schema, collection)?.hasDocuments !== true) {
      return failure('@core.documents/render.documents-disabled', { collection });
    }

    const text = readTemplateText(deps, template, request);
    if (!text.ok) return text;
    const { templateText, fileNameTemplate, paths } = text;

    const countsBusinessDays =
      mentionsBusinessDays(templateText) ||
      mentionsBusinessDays(fileNameTemplate) ||
      tableMentionsBusinessDays(schema, collection) ||
      (template.datasets ?? []).some((dataset) => tableMentionsBusinessDays(schema, dataset.from));
    const [locale, timeZone, businessCalendars] = await Promise.all([
      deps.localeOf(request.tenantId),
      deps.timeZoneOf(request.tenantId),
      countsBusinessDays
        ? (deps.businessCalendarsOf?.(request.tenantId) ?? Promise.resolve(null))
        : Promise.resolve(undefined),
    ]);

    const datasetNames = new Set((template.datasets ?? []).map((dataset) => dataset.name));
    const recordPaths = paths.root.filter((path) => !datasetNames.has(path.split('.')[0]));
    const read = await deps.records.record(
      request.tenantId,
      collection,
      request.recordId,
      recordPaths,
      timeZone,
      businessCalendars,
    );
    if (!read.ok) return failure(read.error, read.errorParams);
    if (!read.value) return failure('@core.records/record.not-found');

    const scope: Record<string, unknown> = { ...read.value };
    for (const dataset of template.datasets ?? []) {
      const loopPaths = paths.loops.get(dataset.name) ?? [];
      const children = await deps.records.children(
        request.tenantId,
        dataset,
        request.recordId,
        loopPaths,
        timeZone,
        businessCalendars,
      );
      if (!children.ok) {
        return failure('@core.documents/render.dataset-invalid', {
          name: dataset.name,
          detail: children.error,
        });
      }
      scope[dataset.name] = children.value;
    }

    const evaluate = evaluatorFor(collection, locale, timeZone, request.permissions, businessCalendars);

    return {
      ok: true,
      value: { template, destination, output, physicalCollection: table.physicalCollection, templateText, fileNameTemplate, scope, evaluate },
    };
};

/** Os caminhos que o modelo lê A PARTIR de `key` — `cliente.nome` vira `nome` para o registro do cliente. */
const pathsUnder = (paths: readonly string[], key: string): string[] =>
  paths.filter((path) => path.startsWith(`${key}.`)).map((path) => path.slice(key.length + 1));

/**
 * O payload, conferido contra o contrato do modelo e com as referências hidratadas.
 *
 * É o caminho do registro com a leitura trocada: em vez de buscar um registro e seguir os vínculos
 * dele, o escopo É o payload, e só os `EntityReference` do primeiro nível viram registro — o mesmo
 * passo a mais que um campo de referência dá. A leitura de cada registro apontado cobra
 * `<coleção>.read` de quem gera: o payload não pode servir de atalho para ler o que a pessoa não lê.
 */
const preparePayload = async (
  deps: RenderDocumentDeps,
  request: Omit<RenderDocumentRequest, 'author'>,
  template: ResolvedDocumentTemplate,
  output: DocumentOutputFormat,
  mode: PrepareMode,
): Promise<Prepared> => {
  if (request.recordId || request.collection) {
    return failure('@core.documents/render.payload-template-record', { key: template.key });
  }
  const payload = request.payload ?? (mode === 'preview' ? template.sample : undefined);
  if (!isPlainObject(payload)) return failure('@core.documents/render.payload-missing', { key: template.key });
  if (JSON.stringify(payload).length > DOCUMENT_PAYLOAD_MAX_BYTES) {
    return failure('@core.documents/render.payload-too-large', { limitKb: String(DOCUMENT_PAYLOAD_MAX_BYTES / 1024) });
  }

  const destination = request.destination ?? template.destination ?? 'downloads';
  if (destination === 'record') return failure('@core.documents/render.payload-destination', { key: template.key });
  // Pré-visualizar não gera nada: a permissão de gerar só é cobrada de quem gera. A leitura de cada
  // registro apontado continua cobrada abaixo, nos dois modos.
  const denied = mode === 'render' ? charge(request, PERMISSION_DOCUMENTS_GENERATE) : null;
  if (denied) return denied;

  const parameters = template.parameters ?? [];
  const [missing] = collectRequiredIssues(parameters, payload);
  if (missing) return failure(missing.error, missing.errorParams);
  const checked = formatAndValidateParameters(parameters, payload);
  const [invalid] = checked.issues;
  if (invalid) return failure(invalid.error, invalid.errorParams);

  const text = readTemplateText(deps, template, request);
  if (!text.ok) return text;
  const { templateText, fileNameTemplate, paths } = text;

  const countsBusinessDays = mentionsBusinessDays(templateText) || mentionsBusinessDays(fileNameTemplate);
  const [locale, timeZone, businessCalendars] = await Promise.all([
    deps.localeOf(request.tenantId),
    deps.timeZoneOf(request.tenantId),
    countsBusinessDays
      ? (deps.businessCalendarsOf?.(request.tenantId) ?? Promise.resolve(null))
      : Promise.resolve(undefined),
  ]);

  const scope: Record<string, unknown> = { ...checked.data };
  const references = parameters.filter((parameter) => parameter.type === 'EntityReference' && parameter.entityType);
  if (references.length > 0) {
    const schema = await deps.screens.getSchemaContext(request.tenantId);
    for (const parameter of references) {
      const value = scope[parameter.key];
      if (value === undefined || value === null || value === '') continue;
      const table = resolveQueryTable(parameter.entityType ?? '', schema);
      if (!table) return failure('@core.automation/mutation.table.unknown', { table: parameter.entityType ?? '' });
      const readDenied = charge(request, collectionPermissionId(table.physicalCollection, 'read'));
      if (readDenied) return readDenied;

      const read = async (
        id: unknown,
        recordPaths: readonly string[],
      ): Promise<{ ok: true; value: Record<string, unknown> } | Failure> => {
        const outcome = await deps.records.record(
          request.tenantId,
          table.physicalCollection,
          String(id),
          recordPaths,
          timeZone,
          businessCalendars,
        );
        if (!outcome.ok) return failure(outcome.error, outcome.errorParams);
        if (!outcome.value) {
          return failure('@core.documents/render.payload-reference-not-found', { key: parameter.key, id: String(id) });
        }
        return { ok: true, value: outcome.value };
      };

      if (parameter.list) {
        if (!Array.isArray(value)) continue;
        const loopPaths = paths.loops.get(parameter.key) ?? [];
        const items: Record<string, unknown>[] = [];
        for (const id of value) {
          const item = await read(id, loopPaths);
          if (!item.ok) return item;
          items.push(item.value);
        }
        scope[parameter.key] = items;
      } else {
        const item = await read(value, pathsUnder(paths.root, parameter.key));
        if (!item.ok) return item;
        scope[parameter.key] = item.value;
      }
    }
  }

  const evaluate = evaluatorFor('', locale, timeZone, request.permissions, businessCalendars);

  return {
    ok: true,
    value: { template, destination, output, physicalCollection: null, templateText, fileNameTemplate, scope, evaluate },
  };
};

const baseNameOf = (prepared: PreparedDocument): string =>
  (prepared.fileNameTemplate
    ? renderTemplate(parseTemplate(prepared.fileNameTemplate).nodes, prepared.scope, { evaluate: prepared.evaluate }).text.trim()
    : '');

export const makeRenderDocumentUseCase = (deps: RenderDocumentDeps): RenderDocumentUseCase => ({
  execute: async (request) => {
    const prepared = await prepare(deps, request, 'render');
    if (!prepared.ok) return prepared;
    const { template, output, scope, evaluate, physicalCollection } = prepared.value;

    let rendered;
    try {
      rendered = await deps.renderer.render({ template, output, scope, evaluate });
    } catch (cause) {
      if (cause instanceof DocumentRenderError) return failure(cause.reference, cause.params);
      throw cause;
    }

    if (rendered.data.length >= AGENT_DOCUMENT_MAX_BYTES) {
      return failure('@core.documents/render.too-large', {
        limitMb: String(Math.round(AGENT_DOCUMENT_MAX_BYTES / (1024 * 1024))),
      });
    }

    const baseName = baseNameOf(prepared.value);
    // A barra de um valor ("Contrato 01/2026") não pode virar diretório: o nome é saneado para o
    // último segmento, e o documento se chamaria "2026.pdf".
    const name = agentDocumentName(`${(baseName || template.title).replace(/[/\\]/g, '-')}.${rendered.extension}`)
      ?? `${template.key}.${rendered.extension}`;

    if (prepared.value.destination === 'downloads') {
      const policy = await deps.downloadPolicyOf(request.tenantId);
      const retentionDays = resolveRetentionDays(request.expiresInDays, template.retentionDays, policy);
      // Sem pessoa por trás não há dono: quem vê o arquivo é o que o escritório configurou.
      const unattended = request.author.via === 'automation';
      const visibility: DownloadVisibility = unattended ? policy.automationVisibility : 'owner';
      const saved = await deps.downloads.save({
        tenantId: request.tenantId,
        name,
        contentType: rendered.contentType,
        data: rendered.data,
        ownerId: unattended ? null : request.author.uid,
        visibility,
        expiresAt: downloadExpiresAt((deps.now ?? (() => new Date()))(), retentionDays),
        templateKey: template.key,
        ...(physicalCollection && request.recordId
          ? { origin: { collection: physicalCollection, recordId: request.recordId } }
          : {}),
        author: request.author,
      });
      return {
        ok: true,
        destination: 'downloads',
        document: { id: saved.id, name: saved.name, url: saved.url, expiresAt: saved.expiresAt },
        output,
        issues: rendered.issues,
      };
    }

    // Só o caminho do registro chega aqui: o do payload recusa `record` antes de ler qualquer coisa.
    if (!physicalCollection || !request.recordId) return failure('@core.documents/render.payload-destination', { key: template.key });
    const document = await deps.writer.attach({
      tenantId: request.tenantId,
      physicalCollection,
      recordId: request.recordId,
      name,
      contentType: rendered.contentType,
      data: rendered.data,
      type: request.documentType ?? template.documentType ?? null,
      author: request.author,
    });

    return { ok: true, destination: 'record', document, output, issues: rendered.issues };
  },

  preview: async (request) => {
    const prepared = await prepare(deps, request, 'preview');
    if (!prepared.ok) return prepared;
    const { template, output, templateText, scope, evaluate } = prepared.value;
    // O texto que o renderizador LÊ — no Word, o remontado —, mesclado pela mesma gramática. O Markdown
    // sai com o valor ESCAPADO, como sai no arquivo: um nome com `*` não vira negrito na prévia.
    const merged = renderTemplate(
      parseTemplate(templateText).nodes,
      scope,
      { evaluate, ...(template.format === 'markdown' ? { write: escapeMarkdownValue } : {}) },
    );
    return {
      ok: true,
      text: merged.text,
      fileName: (baseNameOf(prepared.value) || template.title).replace(/[/\\]/g, '-'),
      output,
      issues: merged.issues,
    };
  },
});
