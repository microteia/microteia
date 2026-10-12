import { afterEach, describe, expect, it } from 'vitest';
import { todayFn } from './builtins/dateFns';
import type { WorkflowContext } from '../../entities/WorkflowContext';
import { evaluateFieldExpression } from '../../schema/fieldExpression';
import { resetAmbientInstant, setAmbientTimeZone, withAmbientTimeZone } from '../../schema/clockGate';
import { resolveTimeZone } from '../../schema/i18n/timeZone';
import { filterReportRows } from '../../schema/report/reportRowFilter';
import type { ReportSpec } from '../../schema/report/reportSpec';

/**
 * PARIDADE cliente × servidor do `today()`, às 22h em Brasília — a hora em que UTC já virou a página
 * e as duas pontas discordavam: a regra `dueDate < today()` aprovava na tela e reprovava na
 * automação (ou o contrário), sobre o MESMO registro, no mesmo instante.
 *
 * O fuso sai das mesmas configurações gravadas pelas duas pontas, pela mesma função. O teste exercita
 * cada caminho por onde o servidor avalia `today()` e cobra o mesmo dia que a tela mostra.
 */

const EVENING_IN_BRASILIA = new Date('2026-03-31T01:00:00.000Z');
const OFFICE_DAY = '2026-03-30';

const settings = { user: {}, tenant: { 'i18n.locale': 'pt-BR' } };

const workflowContext = (timeZone: string): WorkflowContext =>
  ({ services: { now: () => EVENING_IN_BRASILIA, timeZone } }) as unknown as WorkflowContext;

afterEach(() => resetAmbientInstant());

describe('today() às 22h em Brasília — cliente e servidor respondem o mesmo dia', () => {
  const timeZone = resolveTimeZone(settings);

  it('as duas pontas resolvem o mesmo fuso a partir das mesmas configurações', () => {
    expect(timeZone).toBe('America/Sao_Paulo');
  });

  it('cliente: expressão de campo com o fuso empurrado pelo provedor', () => {
    setAmbientTimeZone(timeZone);
    expect(evaluateFieldExpression('today()', { value: null, data: {}, at: EVENING_IN_BRASILIA })).toBe(OFFICE_DAY);
  });

  it('servidor: today() da automação cai no mesmo dia', () => {
    const stamped = todayFn.call([], workflowContext(timeZone)) as Date;
    expect(stamped.toISOString().slice(0, 10)).toBe(OFFICE_DAY);
  });

  it('servidor: derive lido no servidor, avaliado sob o fuso da execução', () => {
    const derived = withAmbientTimeZone(timeZone, () =>
      evaluateFieldExpression('today()', { value: null, data: {}, at: EVENING_IN_BRASILIA }),
    );
    expect(derived).toBe(OFFICE_DAY);
  });

  it('servidor: includeWhen de relatório separa ontem de hoje pelo dia do escritório', () => {
    const spec = { dataset: { table: 'invoices', includeWhen: 'dueDate < today()' } } as unknown as ReportSpec;
    const outcome = filterReportRows({
      spec,
      rows: [{ id: 'yesterday', dueDate: '2026-03-29' }, { id: 'today', dueDate: OFFICE_DAY }],
      now: EVENING_IN_BRASILIA,
      timeZone,
    });
    expect(outcome.ok && outcome.rows.map((row) => row.id)).toEqual(['yesterday']);
  });

  it('o fuso do servidor não vaza da execução para o módulo', () => {
    withAmbientTimeZone(timeZone, () => undefined);
    expect(evaluateFieldExpression('today()', { value: null, data: {}, at: EVENING_IN_BRASILIA })).toBe('2026-03-31');
  });
});
