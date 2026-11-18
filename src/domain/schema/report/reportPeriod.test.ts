import { describe, it, expect } from 'vitest';
import {
  isDeclarableReportPeriod,
  isReportPeriod,
  parseRelativeReportPeriod,
  previousReportPeriod,
  REPORT_PERIOD_MAX_COUNT,
  REPORT_PERIODS,
  reportPeriodLabel,
  reportPeriodRange,
} from './reportPeriod';

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

describe('períodos parametrizados (#4)', () => {
  it('meses: períodos de calendário inteiros, terminando no corrente', () => {
    expect(reportPeriodRange('last-12-months', TODAY)).toEqual({ from: '2025-12-01', until: '2026-12-01' });
    expect(reportPeriodRange('last-24-months', TODAY)).toEqual({ from: '2024-12-01', until: '2026-12-01' });
    expect(reportPeriodRange('last-1-months', TODAY)).toEqual(reportPeriodRange('this-month', TODAY));
  });

  it('previous: os n períodos FECHADOS — previous-1 é o "último" nomeado', () => {
    expect(reportPeriodRange('previous-12-months', TODAY)).toEqual({ from: '2025-11-01', until: '2026-11-01' });
    expect(reportPeriodRange('previous-1-months', TODAY)).toEqual(reportPeriodRange('last-month', TODAY));
    expect(reportPeriodRange('previous-1-weeks', TODAY)).toEqual(reportPeriodRange('last-week', TODAY));
    expect(reportPeriodRange('previous-1-quarters', TODAY)).toEqual(reportPeriodRange('last-quarter', TODAY));
    expect(reportPeriodRange('previous-1-years', TODAY)).toEqual(reportPeriodRange('last-year', TODAY));
    expect(reportPeriodRange('previous-1-days', TODAY)).toEqual(reportPeriodRange('yesterday', TODAY));
  });

  it('semanas por CALENDÁRIO: semanas ISO inteiras, começando na segunda', () => {
    expect(reportPeriodRange('last-2-weeks', TODAY)).toEqual({ from: '2026-11-02', until: '2026-11-16' });
    expect(reportPeriodRange('last-1-weeks', TODAY)).toEqual(reportPeriodRange('this-week', TODAY));
  });

  it('dias: janela móvel que inclui hoje — o last-7-days de antes cabe na forma', () => {
    expect(reportPeriodRange('last-15-days', TODAY)).toEqual({ from: '2026-10-28', until: '2026-11-12' });
    expect(reportPeriodRange('last-7-days', TODAY)).toEqual({ from: '2026-11-05', until: '2026-11-12' });
  });

  it('trimestres e anos atravessam a virada do ano', () => {
    expect(reportPeriodRange('last-2-quarters', '2026-02-10')).toEqual({ from: '2025-10-01', until: '2026-04-01' });
    expect(reportPeriodRange('last-3-years', TODAY)).toEqual({ from: '2024-01-01', until: '2027-01-01' });
  });

  it('o deslocamento recua janelas inteiras do mesmo tamanho', () => {
    expect(reportPeriodRange('last-12-months-offset-1', TODAY)).toEqual({ from: '2024-12-01', until: '2025-12-01' });
    expect(reportPeriodRange('last-15-days-offset-1', TODAY)).toEqual({ from: '2026-10-13', until: '2026-10-28' });
  });

  it('fora da gramática ou acima do teto não é período', () => {
    for (const token of ['last-0-days', 'last-012-months', 'last-12-month', 'next-3-days', 'last--3-days', 'last-3-days-offset-0']) {
      expect(isReportPeriod(token), token).toBe(false);
    }
    expect(isReportPeriod(`last-${REPORT_PERIOD_MAX_COUNT.months}-months`)).toBe(true);
    expect(isReportPeriod(`last-${REPORT_PERIOD_MAX_COUNT.months + 1}-months`)).toBe(false);
    expect(isReportPeriod(`last-${REPORT_PERIOD_MAX_COUNT.months}-months-offset-1`)).toBe(false);
    expect(parseRelativeReportPeriod('last-12-months')).toEqual({ direction: 'last', count: 12, unit: 'months', offset: 0 });
  });

  it('o deslocado é período do servidor, mas não do autor', () => {
    expect(isReportPeriod('last-12-months-offset-1')).toBe(true);
    expect(isDeclarableReportPeriod('last-12-months-offset-1')).toBe(false);
    expect(isDeclarableReportPeriod('last-12-months')).toBe(true);
    expect(isDeclarableReportPeriod('this-month')).toBe(true);
  });
});

describe('reportPeriodLabel', () => {
  it('o nomeado tem a chave dele; o parametrizado, a da família com o count do plural', () => {
    expect(reportPeriodLabel('this-month')).toEqual({ key: 'period.this-month' });
    expect(reportPeriodLabel('last-12-months')).toEqual({ key: 'period.last.months', params: { count: 12 } });
    expect(reportPeriodLabel('previous-2-weeks')).toEqual({ key: 'period.previous.weeks', params: { count: 2 } });
    expect(reportPeriodLabel('last-12-months-offset-1')).toBeNull();
    expect(reportPeriodLabel('qualquer')).toBeNull();
  });
});

describe('previousReportPeriod', () => {
  it('os correntes têm anterior nomeado', () => {
    expect(previousReportPeriod('this-month')).toBe('last-month');
    expect(previousReportPeriod('today')).toBe('yesterday');
    expect(previousReportPeriod('qualquer')).toBeNull();
    expect(previousReportPeriod('year-to-date')).toBeNull();
  });

  it('os demais comparam com a janela de mesmo tamanho logo antes', () => {
    expect(previousReportPeriod('last-12-months')).toBe('last-12-months-offset-1');
    expect(previousReportPeriod('last-30-days')).toBe('last-30-days-offset-1');
    expect(previousReportPeriod('last-12-months-offset-1')).toBe('last-12-months-offset-2');
    expect(previousReportPeriod('last-month')).toBe('previous-1-months-offset-1');
    expect(reportPeriodRange(previousReportPeriod('last-month') ?? '', TODAY))
      .toEqual({ from: '2026-09-01', until: '2026-10-01' });
  });

  it('a janela anterior que passaria do teto não compara', () => {
    expect(previousReportPeriod(`last-${REPORT_PERIOD_MAX_COUNT.years}-years`)).toBeNull();
  });
});
