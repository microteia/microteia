import { mentionsBusinessDays, type BusinessCalendarSet } from '../schema/time/businessDays';
import { tableMentionsBusinessDays } from '../schema/recordRules';
import { evaluateFieldExpression } from '../schema/fieldExpression';
import { configuredLocale, setAmbientLocale } from '../schema/i18n/localeGate';
import type { SchemaContext } from '../schema/pathResolver';
import { resolveQueryTable } from '../schema/querySpec';
import { agentDocumentName, AGENT_DOCUMENT_MAX_BYTES } from '../schema/agent/agentDocument';
import type { DocumentOutputFormat, ResolvedDocumentTemplate } from '../schema/document/documentTemplate';
import { templateOutputs } from '../schema/document/documentTemplate';
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
  recordId: string;
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
 * Gerar o documento de um registro a partir de um modelo e entregá-lo no DESTINO: a aba Documentos
 * do registro ou a tela Downloads.
 *
 * É UM caminho para as três portas — o passo "Gerar documento", o gesto do registro e o agente —, e
 * por isso o documento que a pessoa gera na tela é o mesmo que a automação gera de madrugada.
 *
 * A ordem das recusas é a da pergunta que se faria a mão: o modelo existe, ele produz o formato
 * pedido, quem pede pode entregar ali, a tela tem a aba Documentos (só quando o destino é ela), o
 * registro existe. Só então os filhos são lidos e o arquivo é
 * montado — nada é gravado antes de tudo ter dado certo.
 */
interface PreparedDocument {
  template: ResolvedDocumentTemplate;
  destination: DocumentDestination;
  output: DocumentOutputFormat;
  physicalCollection: string;
  templateText: string;
  fileNameTemplate: string;
  scope: Record<string, unknown>;
  evaluate: TemplateEvaluator;
}

/**
 * Tudo o que vem antes de montar o arquivo: as recusas, na ordem da pergunta que se faria à mão, e a
 * leitura do registro e das listas. A geração e a pré-visualização partem DAQUI, e por isso o texto
 * pré-visualizado é o texto que o documento terá.
 */
const prepare = async (
  deps: RenderDocumentDeps,
  request: Omit<RenderDocumentRequest, 'author'>,
): Promise<{ ok: true; value: PreparedDocument } | Failure> => {
    const templates = await deps.templates.resolve(request.tenantId);
    const template = templates.find((one) => one.key === request.templateKey);
    if (!template) return failure('@core.documents/render.template-not-found', { key: request.templateKey });

    const collection = template.collection;
    if (request.collection && request.collection !== collection) {
      return failure('@core.documents/render.collection-mismatch', { key: template.key, collection: request.collection });
    }

    const outputs = templateOutputs(template);
    const output = request.output ?? outputs[0];
    if (!output || !outputs.includes(output)) {
      return failure('@core.documents/render.output-unsupported', { format: template.format, output: String(output ?? '') });
    }

    const schema = await deps.screens.getSchemaContext(request.tenantId);
    const table = resolveQueryTable(collection, schema);
    if (!table || !documentsScreen(schema, collection)) {
      return failure('@core.automation/mutation.table.unknown', { table: collection });
    }

    const destination = request.destination ?? template.destination ?? 'record';
    if (request.chargePermissions) {
      const permission = collectionPermissionId(collection, destination === 'record' ? 'update' : 'read');
      if (!grants(request.permissions ?? [], permission)) {
        return failure('@core.access/permission.denied', { permission });
      }
    }
    if (destination === 'record' && documentsScreen(schema, collection)?.hasDocuments !== true) {
      return failure('@core.documents/render.documents-disabled', { collection });
    }

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

const baseNameOf = (prepared: PreparedDocument): string =>
  (prepared.fileNameTemplate
    ? renderTemplate(parseTemplate(prepared.fileNameTemplate).nodes, prepared.scope, { evaluate: prepared.evaluate }).text.trim()
    : '');

export const makeRenderDocumentUseCase = (deps: RenderDocumentDeps): RenderDocumentUseCase => ({
  execute: async (request) => {
    const prepared = await prepare(deps, request);
    if (!prepared.ok) return prepared;
    const { template, output, scope, evaluate } = prepared.value;

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
        origin: { collection: prepared.value.physicalCollection, recordId: request.recordId },
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

    const document = await deps.writer.attach({
      tenantId: request.tenantId,
      physicalCollection: prepared.value.physicalCollection,
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
    const prepared = await prepare(deps, request);
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
