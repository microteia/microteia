import type { InputMapping, WorkflowDefinition, WorkflowStep } from '../entities/Workflow';
import { RUN_REPORT_STEP_ID, reportTabLink } from '../schema/report/reportStep';
import { isAggregateMeasure } from '../schema/report/reportSpec';
import type { ReportSpec } from '../schema/report/reportSpec';
import { WORKFLOW_SCHEDULE_EVENT } from '../schema/workflowClock';

export const REPORT_SUBSCRIPTION_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const;
export type ReportSubscriptionFrequency = typeof REPORT_SUBSCRIPTION_FREQUENCIES[number];

export const REPORT_ALERT_OPS = ['>', '>=', '<', '<=', '==', '!='] as const;
export type ReportAlertOp = typeof REPORT_ALERT_OPS[number];

export interface ReportAlert {
  measure: string;
  op: ReportAlertOp;
  value: number;
}

export interface ReportSubscriptionInput {
  /** O nome da automação. Dado do escritório: nasce do título do relatório, e ele pode trocar. */
  name: string;
  reportKey: string;
  /** O título do relatório, que vira o título do aviso. */
  reportTitle: string;
  /** As respostas aos filtros que valem para cada execução. Só as respondidas. */
  prompts: Record<string, unknown>;
  frequency: ReportSubscriptionFrequency;
  /** 0 a 23, no fuso do escritório. */
  hour: number;
  recipientIds: string[];
  /** Ausente: avisa toda vez. Presente: só quando a medida atende à comparação. */
  alert?: ReportAlert;
}

const REPORT_STEP = 'report';
const NOTIFY_STEP = 'notify';
const ALERT_STEP = 'alert';

/** Só a chave que uma expressão lê como `totals.<chave>` sem escapar nada. */
const EXPRESSION_KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * As medidas que um alerta pode vigiar: as agregadas cuja chave cabe numa expressão. A calculada fica
 * de fora porque o total dela não é a soma do que ela calcula — vigiar "margem" no total é vigiar outra
 * coisa.
 */
export const alertableMeasures = (spec: ReportSpec): string[] =>
  (spec.dataset.measures ?? [])
    .filter((measure) => isAggregateMeasure(measure) && EXPRESSION_KEY.test(measure.key))
    .map((measure) => measure.key);

const cronOf = (frequency: ReportSubscriptionFrequency, hour: number): string => {
  const at = Math.min(23, Math.max(0, Math.trunc(hour)));
  if (frequency === 'weekly') return `0 ${at} * * 1`;
  if (frequency === 'monthly') return `0 ${at} 1 * *`;
  return `0 ${at} * * *`;
};

const literal = (value: unknown): InputMapping => ({ kind: 'Literal', value });

/**
 * A assinatura de um relatório como AUTOMAÇÃO comum: agendada, executa o relatório e avisa — e, com
 * alerta, só avisa quando a medida atende à comparação.
 *
 * Não existe um segundo agendador: o `schedule` do contrato de relatório continua sem efeito, e o que
 * agenda é o relógio do motor de automações. Por isso a assinatura é editável como qualquer automação
 * — trocar o horário, acrescentar um canal, mandar para um grupo —, e some quando a apagam lá.
 *
 * O aviso leva ao RELATÓRIO (`rep:<chave>`), e não traz as linhas: é a tela que traduz cada chave e
 * cobra de quem abre a permissão de ver o que o número resume.
 */
export const buildReportSubscription = (
  input: ReportSubscriptionInput,
): Omit<WorkflowDefinition, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> => {
  const answered = Object.entries(input.prompts)
    .filter(([, value]) => value !== undefined && value !== null && value !== '');
  const runReport: WorkflowStep = {
    id: REPORT_STEP,
    stepDefinitionId: RUN_REPORT_STEP_ID,
    type: 'Action',
    order: 0,
    enabled: true,
    configuration: {
      report: literal(input.reportKey),
      ...Object.fromEntries(answered.map(([key, value]) => [`param.${key}`, literal(value)])),
    },
  };

  const alert = input.alert && EXPRESSION_KEY.test(input.alert.measure) && Number.isFinite(input.alert.value)
    ? input.alert
    : undefined;

  const notify: WorkflowStep = {
    id: NOTIFY_STEP,
    stepDefinitionId: 'notify',
    type: 'Action',
    order: alert ? 0 : 1,
    enabled: true,
    configuration: {
      title: literal(input.reportTitle),
      message: literal(alert ? '@core.reports/subscribe.alert.message' : '@core.reports/subscribe.notify.message'),
      messageParams: {
        kind: 'Expression',
        expression: alert
          ? `object("count", output.${REPORT_STEP}.count, "value", output.${REPORT_STEP}.totals.${alert.measure})`
          : `object("count", output.${REPORT_STEP}.count, "total", output.${REPORT_STEP}.total)`,
      },
      link: literal(reportTabLink(input.reportKey)),
      openRecord: literal(false),
      toInApp: literal(true),
      toEmail: literal(true),
      recipientMembers: literal(input.recipientIds),
    },
  };

  const steps: WorkflowStep[] = alert
    ? [
        runReport,
        {
          id: ALERT_STEP,
          stepDefinitionId: '',
          type: 'Condition',
          order: 1,
          enabled: true,
          configuration: {},
          condition: {
            kind: 'Expression',
            expression: `output.${REPORT_STEP}.totals.${alert.measure} ${alert.op} ${alert.value}`,
          },
          branches: { whenTrue: [notify], whenFalse: [] },
        },
      ]
    : [runReport, notify];

  return {
    name: input.name.trim() || input.reportTitle,
    eventName: WORKFLOW_SCHEDULE_EVENT,
    schedule: { cron: cronOf(input.frequency, input.hour) },
    enabled: true,
    version: 1,
    condition: { kind: 'AlwaysTrue' },
    steps,
  };
};
