import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { WorkflowContext, WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { IReportDefinitionReader, StoredReport } from '../../../domain/repositories/IReportDefinitionReader';
import type { IDownloadWriter } from '../../../domain/repositories/IDownloadWriter';
import type { RecordDocumentAuthor } from '../../../domain/repositories/IRecordDocumentWriter';
import {
  RUN_REPORT_MAX_ROWS,
  RUN_REPORT_STEP_ID,
  isReportFileFormat,
  reportTabLink,
  runReportStepOutputs,
} from '../../../domain/schema/report/reportStep';
import type { ReportFileFormat } from '../../../domain/schema/report/reportStep';
import type { ReportResult } from '../../../domain/schema/report/reportResult';
import { buildReportTable } from '../../../domain/schema/report/reportTable';
import { reportFileName, reportResultToCsv } from '../../../domain/schema/report/reportCsv';
import type { ReportCsvTable } from '../../../domain/schema/report/reportCsv';
import { XLSX_MIME_TYPE, reportResultToXlsx } from '../../../domain/schema/report/reportXlsx';
import { downloadExpiresAt, resolveRetentionDays } from '../../../domain/schema/document/documentDownloads';
import type { DownloadPolicy } from '../../../domain/schema/document/documentDownloads';
import type { MessageCatalog } from '../../../domain/schema/i18n/messages';
import { resolveLabel } from '../../../domain/schema/i18n/messageRef';
import type { SchemaContext } from '../../../domain/schema/pathResolver';
import { reportFileText } from '../../../domain/services/reportFileText';
import type { ReportFileTextSources } from '../../../domain/services/reportFileText';
import { runReportQuery } from '../../report/runReportQuery';
import type { IReportSnapshotRepository } from '../../../domain/repositories/IReportSnapshotRepository';
import {
  REPORT_SNAPSHOT_RETENTION_YEARS,
  reportSnapshotDefinition,
  snapshotRefusal,
  snapshotRowsOf,
} from '../../../domain/schema/report/reportSnapshot';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';

/**
 * O que o passo precisa para escrever o relatório como o escritório o lê — a tabela legível e o arquivo.
 * Opcional: sem isto o passo publica só os números crus, como antes.
 */
export interface RunReportFileDeps {
  sources: ReportFileTextSources;
  catalog(tenantId: string): Promise<MessageCatalog>;
  localeOf(tenantId: string): Promise<string>;
  downloads: IDownloadWriter;
  downloadPolicyOf(tenantId: string): Promise<DownloadPolicy>;
  renderPdf(table: ReportCsvTable, title: string): Promise<Buffer>;
}

export interface RunReportStepDeps {
  reports: IReportDefinitionReader;
  query: WorkflowQueryDeps;
  file?: RunReportFileDeps;
  /** Onde a foto é guardada (`snapshot`) e de onde a série é lida. Sem isto, os dois são recusados. */
  snapshots?: IReportSnapshotRepository;
}

const WORKFLOW_ACTOR = 'workflow-engine';

const FILE_TYPES: Record<ReportFileFormat, string> = {
  csv: 'text/csv;charset=utf-8',
  xlsx: XLSX_MIME_TYPE,
  pdf: 'application/pdf',
};

/** O autor pela regra do "Gerar documento": a pessoa do escritório por trás, ou o motor, sem nome. */
const authorOf = (context: WorkflowContext): RecordDocumentAuthor =>
  context.actor && context.actor.via !== 'portal'
    ? { uid: context.actor.userId, name: context.actor.name, photoUrl: context.actor.photoURL, via: context.actor.via }
    : { uid: WORKFLOW_ACTOR, name: null, via: 'automation' };

const PARAM_PREFIX = 'param.';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** Sem resposta, e não "resposta vazia": o campo que ninguém preencheu no editor deixa o padrão do relatório valer. */
const unanswered = (value: unknown): boolean => value === undefined || value === null || value === '';

/**
 * O passo `run-report`: executa um relatório do escritório pelo MESMO caminho da tela e publica o
 * resultado achatado (`runReportStepOutputs`).
 *
 * Roda como a automação, como o passo `query`: conta o que a automação lê, sem a visibilidade por
 * registro de uma pessoa. Quem decide a quem o número chega é quem monta a automação — e é por isso
 * que montá-la exige `automation.manage`.
 *
 * O relatório que não roda (spec inválido, filtro obrigatório sem resposta) REPROVA o passo: um
 * alerta que segue com total zero diria "está tudo bem" justamente quando não se sabe.
 */
export const makeRunReportStepDefinition = (deps: RunReportStepDeps): StepDefinition => ({
  ...coreStepMetadata(RUN_REPORT_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const tenantId = context.execution.tenantId;
      const reference = textOf(inputs.report);
      if (!reference) return { success: false, message: '@core.automation/step.run-report.not-configured' };

      const report = await deps.reports.find(tenantId, reference);
      if (!report) {
        return { success: false, message: '@core.reports/handler.not-found', messageParams: { id: reference } };
      }

      // As respostas em bloco primeiro, os `param.<chave>` por cima — o gesto mais específico manda,
      // como em "Gerar documento".
      const prompts: Record<string, unknown> = isPlainObject(inputs.prompts) ? { ...inputs.prompts } : {};
      for (const [key, mapping] of Object.entries(context.stepConfiguration ?? {})) {
        if (!key.startsWith(PARAM_PREFIX)) continue;
        const value = resolveMapping(mapping, context);
        if (!unanswered(value)) prompts[key.slice(PARAM_PREFIX.length)] = value;
      }

      const snapshot = inputs.snapshot === true;
      if (snapshot) {
        const refusal = snapshotRefusal(report.spec);
        if (refusal) return { success: false, message: refusal };
        if (!deps.snapshots) return { success: false, message: '@core.reports/snapshot.unavailable' };
      }

      const outcome = await runReportQuery({
        spec: report.spec,
        context,
        deps: deps.query,
        prompts,
        ...(deps.snapshots ? { series: { reports: deps.reports, snapshots: deps.snapshots } } : {}),
      });
      if (!outcome.ok) return { success: false, message: outcome.error, messageParams: outcome.errorParams };

      // O que degradou sem impedir: o mesmo aviso que a tela mostraria em cima do relatório.
      for (const issue of outcome.issues) context.logger.warn(issue.error, issue.errorParams);

      const outputs = runReportStepOutputs(report.spec, outcome.value);

      const format = textOf(inputs.file).toLowerCase();
      if (format !== '' && !isReportFileFormat(format)) {
        return { success: false, message: '@core.automation/step.run-report.file-unsupported', messageParams: { format } };
      }
      const schema = await deps.query.screenProvider.getSchemaContext(context.execution.tenantId);
      const file = await writeReportFile(deps.file, context, schema, report, outcome.value, isReportFileFormat(format) ? format : null);
      if (file && 'error' in file) return { success: false, message: file.error };
      const snapshotId = snapshot && deps.snapshots
        ? await saveSnapshot(deps.snapshots, context, report, outcome.value)
        : null;
      const params = {
        name: report.title,
        count: String(outputs.count),
        groups: String(outputs.groups),
        scanned: String(outputs.scanned),
      };
      return {
        success: true,
        message: outputs.complete ? '@core.automation/step.run-report.done' : '@core.automation/step.run-report.done-partial',
        messageParams: params,
        outputs: {
          ...outputs,
          name: report.title,
          link: reportTabLink(report.key),
          ...(file ? { table: file.table, fileId: file.id, fileName: file.name, fileUrl: file.url } : {}),
          ...(snapshotId ? { snapshotId } : {}),
        },
      };
    },
  }),
});

/**
 * A FOTO do resultado, para a série: os grupos do nível mais fundo (até o teto), os totais e a definição
 * do relatório naquele momento — é ela que avisa quando a série atravessa uma mudança do relatório.
 */
const saveSnapshot = async (
  snapshots: IReportSnapshotRepository,
  context: WorkflowContext,
  report: StoredReport,
  result: ReportResult,
): Promise<string> => {
  const all = runReportStepOutputs(report.spec, result, Number.POSITIVE_INFINITY);
  const { rows, truncated } = snapshotRowsOf(all.rows);
  const takenAt = context.services.now();
  const expiresAt = new Date(takenAt);
  expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + REPORT_SNAPSHOT_RETENTION_YEARS);
  const author = authorOf(context);
  return snapshots.save(context.execution.tenantId, {
    report: report.key,
    takenAt,
    definition: reportSnapshotDefinition(report.spec),
    rows,
    totals: all.totals,
    count: all.count,
    complete: all.complete,
    truncated,
    takenBy: author.via === 'automation' ? null : author.uid,
    expiresAt,
  });
};

type WrittenFile = { table: ReportCsvTable; id: string; name: string; url: string };

/**
 * A tabela legível e, quando pedido, o ARQUIVO em Downloads — com a retenção e a visibilidade que o
 * escritório configurou para arquivos de automação, como o "Gerar documento". A tabela publicada é
 * cortada no mesmo teto das linhas; o arquivo leva tudo.
 */
const writeReportFile = async (
  deps: RunReportFileDeps | undefined,
  context: WorkflowContext,
  schema: SchemaContext,
  report: StoredReport,
  result: ReportResult,
  format: ReportFileFormat | null,
): Promise<WrittenFile | { error: string } | null> => {
  if (!deps) return format ? { error: '@core.automation/step.run-report.file-unavailable' } : null;
  const tenantId = context.execution.tenantId;
  const [catalog, locale] = await Promise.all([deps.catalog(tenantId), deps.localeOf(tenantId)]);
  const title = resolveLabel(catalog, report.title) || report.key;
  const textFor = (formatted: boolean) => reportFileText({
    tenantId, spec: report.spec, result, schema,
    catalog, sources: deps.sources, locale, formatted,
  });
  const readable = buildReportTable(report.spec, result, await textFor(true));
  const table: ReportCsvTable = { ...readable, rows: readable.rows.slice(0, RUN_REPORT_MAX_ROWS) };
  if (!format) return { table, id: '', name: '', url: '' };

  const data = format === 'pdf'
    ? await deps.renderPdf(readable, title)
    : format === 'xlsx'
      ? Buffer.from(reportResultToXlsx(buildReportTable(report.spec, result, await textFor(false)), title))
      : Buffer.from(reportResultToCsv(buildReportTable(report.spec, result, await textFor(false))), 'utf8');
  const author = authorOf(context);
  const unattended = author.via === 'automation';
  const policy = await deps.downloadPolicyOf(tenantId);
  const saved = await deps.downloads.save({
    tenantId,
    name: reportFileName(report.spec.presentation?.export?.fileName?.trim() || title, context.services.now(), format),
    contentType: FILE_TYPES[format],
    data,
    ownerId: unattended ? null : author.uid,
    visibility: unattended ? policy.automationVisibility : 'owner',
    expiresAt: downloadExpiresAt(context.services.now(), resolveRetentionDays(undefined, undefined, policy)),
    author,
  });
  return { table, id: saved.id, name: saved.name, url: saved.url };
};
