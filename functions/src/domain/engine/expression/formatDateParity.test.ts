import { afterEach, describe, expect, it } from 'vitest';
import { dayFn, dayOfWeekFn, formatDateFn, nowFn } from './builtins/dateFns';
import type { WorkflowContext } from '../../entities/WorkflowContext';
import { evaluateFieldExpression } from '../../schema/fieldExpression';
import { resetAmbientInstant, setAmbientTimeZone, withAmbientTimeZone } from '../../schema/clockGate';
import { resolveTimeZone } from '../../schema/i18n/timeZone';
import { filterReportRows } from '../../schema/report/reportRowFilter';
import type { ReportSpec } from '../../schema/report/reportSpec';

/**
 * PARIDADE cliente × servidor do `formatDate`, às 23h em Brasília — 02h do dia seguinte em UTC.
 *
 * Os getters de `Date` respondiam pelo fuso do PROCESSO: o navegador carimbava 23:00 e a Cloud Function,
 * 02:00 do dia seguinte. A mensagem recebida às 11:32 ficava registrada às 14:32, e a movimentação
 * lançada depois das 21h caía no dia seguinte — sem erro nenhum, em todo escritório fora do UTC.
 */

const ELEVEN_PM_IN_BRASILIA = new Date('2026-03-31T02:00:00.000Z');
const OFFICE_CLOCK = '2026-03-30 23:00';
const PATTERN = '"YYYY-MM-DD HH:mm"';

const settings = { user: {}, tenant: { 'i18n.locale': 'pt-BR' } };

const workflowContext = (timeZone?: string): WorkflowContext =>
  ({ services: { now: () => ELEVEN_PM_IN_BRASILIA, ...(timeZone ? { timeZone } : {}) } }) as unknown as WorkflowContext;

afterEach(() => resetAmbientInstant());

describe('formatDate(now()) às 23h em Brasília — cliente e servidor escrevem a mesma hora', () => {
  const timeZone = resolveTimeZone(settings);
  const expression = `formatDate(now(), ${PATTERN})`;

  it('cliente: formulário com o fuso empurrado pelo provedor', () => {
    setAmbientTimeZone(timeZone);
    expect(evaluateFieldExpression(expression, { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA })).toBe(OFFICE_CLOCK);
  });

  it('servidor: workflow e Script (fn.formatDate) formatam no relógio do escritório', () => {
    const context = workflowContext(timeZone);
    const now = nowFn.call([], context);
    expect(formatDateFn.call([now, 'YYYY-MM-DD HH:mm'], context)).toBe(OFFICE_CLOCK);
    expect(dayFn.call([now], context)).toBe(30);
    expect(dayOfWeekFn.call([now], context)).toBe(1);
  });

  it('servidor: derive lido no servidor, avaliado sob o fuso da execução', () => {
    const derived = withAmbientTimeZone(timeZone, () =>
      evaluateFieldExpression(expression, { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA }),
    );
    expect(derived).toBe(OFFICE_CLOCK);
  });

  it('servidor: modelo de documento, com o fuso no contexto da avaliação', () => {
    expect(evaluateFieldExpression(expression, { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA, timeZone }))
      .toBe(OFFICE_CLOCK);
  });

  it('servidor: includeWhen de relatório lê a hora do escritório', () => {
    const spec = {
      dataset: { table: 'messages', includeWhen: `formatDate(sentAt, "HH") == "23"` },
    } as unknown as ReportSpec;
    const outcome = filterReportRows({
      spec,
      rows: [{ id: 'evening', sentAt: ELEVEN_PM_IN_BRASILIA.toISOString() }],
      now: ELEVEN_PM_IN_BRASILIA,
      timeZone,
    });
    expect(outcome.ok && outcome.rows.map((row) => row.id)).toEqual(['evening']);
  });

  it('year, month, day e dayOfWeek de um instante respondem o dia do escritório', () => {
    const at = { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA, timeZone };
    expect(evaluateFieldExpression('day(now())', at)).toBe(30);
    expect(evaluateFieldExpression('month(now())', at)).toBe(3);
    expect(evaluateFieldExpression('dayOfWeek(now())', at)).toBe(1);
  });
});

describe('formatDate — um dia continua sendo o mesmo dia, e o terceiro argumento troca o relógio', () => {
  it('um dia YYYY-MM-DD sai o mesmo dia em qualquer fuso, sem conversão', () => {
    for (const timeZone of ['America/Sao_Paulo', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const ctx = { value: null, data: { due: '2026-03-31' }, timeZone };
      expect(evaluateFieldExpression('formatDate(due, "DD/MM/YYYY")', ctx)).toBe('31/03/2026');
      expect(evaluateFieldExpression(`formatDate(due, "DD/MM/YYYY", "${timeZone}")`, ctx)).toBe('31/03/2026');
      expect(evaluateFieldExpression('dayOfWeek(due)', ctx)).toBe(2);
    }
  });

  it('um dia gravado pela automação (meio-dia UTC) se lê o mesmo dia no escritório', () => {
    const anchored = new Date('2026-03-31T12:00:00.000Z');
    expect(formatDateFn.call([anchored, 'DD/MM/YYYY'], workflowContext('America/Sao_Paulo'))).toBe('31/03/2026');
  });

  it('"UTC" como terceiro argumento dá a hora em UTC nas duas pontas', () => {
    const ctx = { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA, timeZone: 'America/Sao_Paulo' };
    expect(evaluateFieldExpression(`formatDate(now(), ${PATTERN}, "UTC")`, ctx)).toBe('2026-03-31 02:00');
    expect(formatDateFn.call([ELEVEN_PM_IN_BRASILIA, 'YYYY-MM-DD HH:mm', 'UTC'], workflowContext('America/Sao_Paulo')))
      .toBe('2026-03-31 02:00');
  });

  it('fuso desconhecido: texto vazio no formulário, recusa nomeada no fluxo — nunca a hora errada', () => {
    const ctx = { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA, timeZone: 'America/Sao_Paulo' };
    expect(evaluateFieldExpression(`formatDate(now(), ${PATTERN}, "-03:00")`, ctx)).toBe('');
    expect(() => formatDateFn.call([ELEVEN_PM_IN_BRASILIA, 'HH:mm', 'Brasilia'], workflowContext()))
      .toThrow(/expr\.arg\.third\.time-zone/);
  });

  it('sem fuso configurado, a hora é a de UTC — o que o escritório que não configura nada sempre viu', () => {
    expect(evaluateFieldExpression(`formatDate(now(), ${PATTERN})`, { value: null, data: {}, at: ELEVEN_PM_IN_BRASILIA }))
      .toBe('2026-03-31 02:00');
    expect(formatDateFn.call([ELEVEN_PM_IN_BRASILIA, 'YYYY-MM-DD HH:mm'], workflowContext())).toBe('2026-03-31 02:00');
  });

  it('meia-noite sai 00, e não 24', () => {
    const midnight = new Date('2026-03-31T03:00:00.000Z');
    expect(formatDateFn.call([midnight, 'HH:mm'], workflowContext('America/Sao_Paulo'))).toBe('00:00');
  });
});
