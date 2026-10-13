import { mentionsBusinessDays, type BusinessCalendarSet } from '../schema/time/businessDays';
import { tableMentionsBusinessDays } from '../schema/recordRules';
import { evaluateFieldExpression } from '../schema/fieldExpression';
import { configuredLocale, setAmbientLocale } from '../schema/i18n/localeGate';
import type { SchemaContext } from '../schema/pathResolver';
import { resolveQueryTable } from '../schema/querySpec';
import { agentDocumentName, AGENT_DOCUMENT_MAX_BYTES } from '../schema/agent/agentDocument';
import type { DocumentOutputFormat } from '../schema/document/documentTemplate';
import { templateOutputs } from '../schema/document/documentTemplate';
import type { RenderIssue, TemplateEvaluator } from '../schema/document/templateGrammar';
import { collectTemplatePaths, parseTemplate, renderTemplate } from '../schema/document/templateGrammar';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IDocumentRenderer } from '../repositories/IDocumentRenderer';
import { DocumentRenderError } from '../repositories/IDocumentRenderer';
import type {
  AttachedRecordDocument,
  IRecordDocumentWriter,
  RecordDocumentAuthor,
} from '../repositories/IRecordDocumentWriter';
import type { IDocumentRecordReader, IDocumentTemplateSource } from '../repositories/IDocumentGenerationPorts';

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
}

export type RenderDocumentResult =
  | { ok: true; document: AttachedRecordDocument; output: DocumentOutputFormat; issues: RenderIssue[] }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface RenderDocumentDeps {
  templates: IDocumentTemplateSource;
  screens: IScreenDefinitionProvider;
  records: IDocumentRecordReader;
  renderer: IDocumentRenderer;
  writer: IRecordDocumentWriter;
  /** O idioma e o fuso do ESCRITÓRIO: o documento é dele, e `formatMoney(valor)` fala a língua dele. */
  localeOf(tenantId: string): Promise<string>;
  timeZoneOf(tenantId: string): Promise<string>;
  /** Os calendários de dias úteis, lidos só quando o modelo ou um campo derivado conta dias úteis. */
  businessCalendarsOf?(tenantId: string): Promise<BusinessCalendarSet | null>;
}

export interface RenderDocumentUseCase {
  execute(request: RenderDocumentRequest): Promise<RenderDocumentResult>;
}

const failure = (error: string, errorParams?: Record<string, string>): RenderDocumentResult =>
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
 * Gerar o documento de um registro a partir de um modelo e anexá-lo à aba Documentos.
 *
 * É UM caminho para as duas portas — o passo "Gerar documento" e o gesto do registro —, e por isso o
 * documento que a pessoa gera na tela é o mesmo que a automação gera de madrugada.
 *
 * A ordem das recusas é a da pergunta que se faria a mão: o modelo existe, ele produz o formato
 * pedido, a tela tem a aba Documentos, o registro existe. Só então os filhos são lidos e o arquivo é
 * montado — nada é gravado antes de tudo ter dado certo.
 */
export const makeRenderDocumentUseCase = (deps: RenderDocumentDeps): RenderDocumentUseCase => ({
  execute: async (request) => {
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
    if (documentsScreen(schema, collection)?.hasDocuments !== true) {
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

    const baseName = fileNameTemplate
      ? renderTemplate(parseTemplate(fileNameTemplate).nodes, scope, { evaluate }).text.trim()
      : '';
    // A barra de um valor ("Contrato 01/2026") não pode virar diretório: o nome é saneado para o
    // último segmento, e o documento se chamaria "2026.pdf".
    const name = agentDocumentName(`${(baseName || template.title).replace(/[/\\]/g, '-')}.${rendered.extension}`)
      ?? `${template.key}.${rendered.extension}`;

    const document = await deps.writer.attach({
      tenantId: request.tenantId,
      physicalCollection: table.physicalCollection,
      recordId: request.recordId,
      name,
      contentType: rendered.contentType,
      data: rendered.data,
      type: request.documentType ?? template.documentType ?? null,
      author: request.author,
    });

    return { ok: true, document, output, issues: rendered.issues };
  },
});
