import { describe, expect, it } from 'vitest';
import { todayFn } from './dateFns';
import type { WorkflowContext } from '../../../entities/WorkflowContext';

const contextAt = (instant: string): WorkflowContext =>
  ({ services: { now: () => new Date(instant) } }) as unknown as WorkflowContext;

/**
 * O carimbo de "hoje" de uma automação é lido no escritório, não no servidor. Meia-noite em UTC —
 * que era o que `today()` devolvia — é o dia ANTERIOR para quem lê no Brasil: concluir um prazo às
 * 10h de 12/08 registrava 11/08.
 */
describe('today', () => {
  const readInBrazil = (date: unknown): string =>
    (date as Date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  it('devolve o dia ancorado ao meio-dia em UTC', () => {
    expect((todayFn.call([], contextAt('2026-08-12T13:00:00.000Z')) as Date).toISOString())
      .toBe('2026-08-12T12:00:00.000Z');
  });

  it('o dia carimbado é o dia que o escritório lê, de manhã e de tarde', () => {
    expect(readInBrazil(todayFn.call([], contextAt('2026-08-12T03:30:00.000Z')))).toBe('12/08/2026');
    expect(readInBrazil(todayFn.call([], contextAt('2026-08-12T20:59:00.000Z')))).toBe('12/08/2026');
  });
});
