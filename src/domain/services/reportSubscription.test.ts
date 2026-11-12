import { describe, it, expect } from 'vitest';
import type { ReportSpec } from '../schema/report/reportSpec';
import { alertableMeasures, buildReportSubscription } from './reportSubscription';
import type { ReportSubscriptionInput } from './reportSubscription';
import { parseCron } from '../schema/workflowClock';

const base: ReportSubscriptionInput = {
  name: 'Receita semanal',
  reportKey: 'receita',
  reportTitle: 'Receita',
  prompts: { periodo: 'last-week', cliente: '' },
  frequency: 'weekly',
  hour: 8,
  recipientIds: ['ana'],
};

describe('buildReportSubscription', () => {
  it('agenda, executa o relatório com os filtros respondidos e avisa com o link dele', () => {
    const workflow = buildReportSubscription(base);

    expect(workflow.eventName).toBe('schedule');
    expect(workflow.schedule).toEqual({ cron: '0 8 * * 1' });
    expect(parseCron(workflow.schedule?.cron ?? '')).not.toBeNull();
    const [run, notify] = workflow.steps;
    expect(run.stepDefinitionId).toBe('run-report');
    // O filtro sem resposta não vai: é ele que deixa o padrão do relatório valer em cada execução.
    expect(run.configuration).toEqual({
      report: { kind: 'Literal', value: 'receita' },
      'param.periodo': { kind: 'Literal', value: 'last-week' },
    });
    expect(notify.stepDefinitionId).toBe('notify');
    expect(notify.configuration.link).toEqual({ kind: 'Literal', value: 'rep:receita' });
    expect(notify.configuration.recipientMembers).toEqual({ kind: 'Literal', value: ['ana'] });
    expect(notify.configuration.message).toEqual({ kind: 'Literal', value: '@core.reports/subscribe.notify.message' });
  });

  it('com alerta, o aviso fica dentro da condição sobre a medida', () => {
    const workflow = buildReportSubscription({ ...base, alert: { measure: 'total', op: '>', value: 1000 } });

    const [, alert] = workflow.steps;
    expect(alert.type).toBe('Condition');
    expect(alert.condition).toEqual({ kind: 'Expression', expression: 'output.report.totals.total > 1000' });
    expect(alert.branches?.whenTrue.map((step) => step.stepDefinitionId)).toEqual(['notify']);
    expect(alert.branches?.whenFalse).toEqual([]);
  });

  it('recusa o alerta cuja chave não cabe numa expressão, em vez de escrever uma que quebra', () => {
    const workflow = buildReportSubscription({ ...base, alert: { measure: 'total"; x', op: '>', value: 1 } });
    expect(workflow.steps.map((step) => step.type)).toEqual(['Action', 'Action']);
  });

  it('o horário e a frequência viram cron', () => {
    expect(buildReportSubscription({ ...base, frequency: 'daily', hour: 7 }).schedule?.cron).toBe('0 7 * * *');
    expect(buildReportSubscription({ ...base, frequency: 'monthly', hour: 30 }).schedule?.cron).toBe('0 23 1 * *');
  });

  it('sem nome, a automação se chama como o relatório', () => {
    expect(buildReportSubscription({ ...base, name: '  ' }).name).toBe('Receita');
  });
});

describe('assinatura com arquivo', () => {
  it('o passo grava o arquivo, e o aviso leva à página Downloads com o nome dele', () => {
    const workflow = buildReportSubscription({ ...base, file: 'xlsx' });
    const [run, notify] = workflow.steps;
    expect(run.configuration.file).toEqual({ kind: 'Literal', value: 'xlsx' });
    expect(notify.configuration.link).toEqual({ kind: 'Literal', value: 'downloads' });
    expect(notify.configuration.message).toEqual({ kind: 'Literal', value: '@core.reports/subscribe.notify.message-file' });
    expect(notify.configuration.messageParams).toEqual({
      kind: 'Expression',
      expression: 'object("count", output.report.count, "total", output.report.total, "file", output.report.fileName)',
    });
  });
});

describe('alertableMeasures', () => {
  it('só as medidas agregadas com chave de expressão', () => {
    const spec: ReportSpec = {
      v: 1,
      dataset: {
        table: 'vendas',
        measures: [
          { key: 'receita', op: 'sum', path: 'valor' },
          { key: 'margem', kind: 'computed', expression: 'receita / 2' },
          { key: 'com-hifen', op: 'count' },
        ],
      },
      shape: { kind: 'summary', groupBy: [], values: ['receita'] },
    };
    expect(alertableMeasures(spec)).toEqual(['receita']);
  });
});
