import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import type { IReportDefinitionReader } from '../../../domain/repositories/IReportDefinitionReader';
import { RUN_REPORT_STEP_ID, reportTabLink, runReportStepOutputs } from '../../../domain/schema/report/reportStep';
import { runReportQuery } from '../../report/runReportQuery';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';

export interface RunReportStepDeps {
  reports: IReportDefinitionReader;
  query: WorkflowQueryDeps;
}

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

      const outcome = await runReportQuery({ spec: report.spec, context, deps: deps.query, prompts });
      if (!outcome.ok) return { success: false, message: outcome.error, messageParams: outcome.errorParams };

      // O que degradou sem impedir: o mesmo aviso que a tela mostraria em cima do relatório.
      for (const issue of outcome.issues) context.logger.warn(issue.error, issue.errorParams);

      const outputs = runReportStepOutputs(report.spec, outcome.value);
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
        outputs: { ...outputs, name: report.title, link: reportTabLink(report.key) },
      };
    },
  }),
});
