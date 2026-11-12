import { describe, it, expect } from 'vitest';
import { isReportPeriod, previousReportPeriod, REPORT_PERIODS, reportPeriodRange } from './reportPeriod';

// 2026-11-11 é uma quarta-feira: é o que deixa a semana ISO ser conferida por inteiro.
const TODAY = '2026-11-11';

describe('reportPeriodRange', () => {
  it('o mês, a semana ISO e o trimestre de hoje, como intervalo semiaberto de dias', () => {
    expect(reportPeriodRange('this-month', TODAY)).toEqual({ from: '2026-11-01', until: '2026-12-01' });
    expect(reportPeriodRange('this-week', TODAY)).toEqual({ from: '2026-11-09', until: '2026-11-16' });
    expect(reportPeriodRange('this-quarter', TODAY)).toEqual({ from: '2026-10-01', until: '2027-01-01' });
    expect(reportPeriodRange('last-quarter', TODAY)).toEqual({ from: '2026-07-01', until: '2026-10-01' });
  });

  it('atravessa a virada do ano sem conta à mão', () => {
    expect(reportPeriodRange('last-month', '2026-01-15')).toEqual({ from: '2025-12-01', until: '2026-01-01' });
    expect(reportPeriodRange('last-quarter', '2026-02-01')).toEqual({ from: '2025-10-01', until: '2026-01-01' });
    expect(reportPeriodRange('last-year', TODAY)).toEqual({ from: '2025-01-01', until: '2026-01-01' });
  });

  it('"últimos N dias" inclui hoje, e "do início do ano" termina amanhã exclusive', () => {
    expect(reportPeriodRange('last-7-days', TODAY)).toEqual({ from: '2026-11-05', until: '2026-11-12' });
    expect(reportPeriodRange('year-to-date', TODAY)).toEqual({ from: '2026-01-01', until: '2026-11-12' });
    expect(reportPeriodRange('yesterday', TODAY)).toEqual({ from: '2026-11-10', until: '2026-11-11' });
  });

  it('todo período declarado tem intervalo — nenhum cai num `default` calado', () => {
    for (const period of REPORT_PERIODS) {
      expect(reportPeriodRange(period, TODAY)).not.toBeNull();
    }
  });

  it('um dia malformado não vira período nenhum', () => {
    expect(reportPeriodRange('this-month', '11/11/2026')).toBeNull();
    expect(isReportPeriod('this_decade')).toBe(false);
  });
});

describe('previousReportPeriod', () => {
  it('só os períodos correntes têm anterior nomeado', () => {
    expect(previousReportPeriod('this-month')).toBe('last-month');
    expect(previousReportPeriod('today')).toBe('yesterday');
    expect(previousReportPeriod('last-30-days')).toBeNull();
    expect(previousReportPeriod('qualquer')).toBeNull();
  });
});
