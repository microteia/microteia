import { describe, expect, it } from 'vitest';
import {
  addBusinessDays,
  businessCalendarOf,
  businessDaysBetween,
  BusinessDaysError,
  createBusinessCalendarSet,
  isBusinessDay,
  isBusinessDaysError,
  mentionsBusinessDays,
  nextBusinessDay,
  type BusinessDaysEnvironment,
} from './businessDays';

const national = businessCalendarOf('cal-national', {
  key: 'national',
  name: 'National',
  weekend: [0, 6],
  years: {
    '2026': ['2026-01-01', '2026-04-03', '2026-04-21', '2026-12-25'],
    '2027': ['2027-01-01'],
  },
});

const court = businessCalendarOf('cal-court', {
  key: 'court',
  weekend: [0, 6],
  years: {
    '2026': ['2026-04-20', '2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31'],
    '2027': ['2027-01-04'],
  },
});

const env: BusinessDaysEnvironment = {
  calendars: createBusinessCalendarSet([national, court]),
  timeZone: 'America/Sao_Paulo',
};

const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
    return undefined;
  } catch (error) {
    return isBusinessDaysError(error) ? error.code : 'other';
  }
};

describe('dias úteis — leitura do documento', () => {
  it('descarta item a item o que está malformado, sem perder o resto', () => {
    const calendar = businessCalendarOf('x', {
      weekend: [6, 0, 9, 'a', 6],
      years: { '2026': ['2026-02-30', '2027-01-01', '2026-03-01', '2026-03-01'], abc: ['2026-01-01'] },
    });
    expect(calendar.weekend).toEqual([0, 6]);
    expect(calendar.years).toEqual({ '2026': ['2026-03-01'] });
  });
});

describe('dias úteis — isBusinessDay', () => {
  it('fim de semana e dia marcado não são úteis', () => {
    expect(isBusinessDay(env, '2026-04-04', 'national')).toBe(false);
    expect(isBusinessDay(env, '2026-04-03', 'national')).toBe(false);
    expect(isBusinessDay(env, '2026-04-06', 'national')).toBe(true);
  });

  it('a UNIÃO dos calendários faz o não útil prevalecer', () => {
    expect(isBusinessDay(env, '2026-04-20', 'national')).toBe(true);
    expect(isBusinessDay(env, '2026-04-20', ['national', 'court'])).toBe(false);
  });

  it('acha o calendário pelo id do documento ou pela chave, e aceita o registro hidratado', () => {
    expect(isBusinessDay(env, '2026-04-20', 'cal-court')).toBe(false);
    expect(isBusinessDay(env, '2026-04-20', [{ id: 'cal-court' }])).toBe(false);
  });

  it('um instante vira o dia do FUSO do escritório', () => {
    expect(isBusinessDay(env, '2026-04-07T01:00:00.000Z', 'national')).toBe(true);
    expect(isBusinessDay(env, '2026-04-04T02:00:00.000Z', 'national')).toBe(false);
  });
});

describe('dias úteis — addBusinessDays', () => {
  it('conta a partir do dia seguinte e pula o que não é útil', () => {
    expect(addBusinessDays(env, '2026-04-02', 1, 'national')).toBe('2026-04-06');
    expect(addBusinessDays(env, '2026-04-17', 2, ['national', 'court'])).toBe('2026-04-23');
  });

  it('atravessa o recesso e a virada do ano', () => {
    expect(addBusinessDays(env, '2026-12-18', 1, ['national', 'court'])).toBe('2027-01-05');
  });

  it('conta para trás com número negativo, e zero devolve a própria data', () => {
    expect(addBusinessDays(env, '2026-04-06', -1, 'national')).toBe('2026-04-02');
    expect(addBusinessDays(env, '2026-04-04', 0, 'national')).toBe('2026-04-04');
  });

  it('fecha com businessDaysBetween para qualquer n', () => {
    for (const start of ['2026-04-02', '2026-04-04', '2026-12-18']) {
      for (const n of [-7, -1, 0, 1, 5, 12]) {
        const end = addBusinessDays(env, start, n, ['national', 'court']);
        expect(businessDaysBetween(env, start, end, ['national', 'court'])).toBe(n);
      }
    }
  });
});

describe('dias úteis — nextBusinessDay', () => {
  it('é a própria data quando útil, senão a próxima útil', () => {
    expect(nextBusinessDay(env, '2026-04-06', 'national')).toBe('2026-04-06');
    expect(nextBusinessDay(env, '2026-04-03', 'national')).toBe('2026-04-06');
  });
});

describe('dias úteis — recusas nomeadas, nunca contagem sem os dias', () => {
  it('sem extensão, carregando, sem calendário e calendário inexistente', () => {
    expect(codeOf(() => isBusinessDay({ ...env, calendars: null }, '2026-04-06', 'national'))).toBe('unavailable');
    expect(codeOf(() => isBusinessDay({ ...env, calendars: createBusinessCalendarSet([], false) }, '2026-04-06', 'x'))).toBe('loading');
    expect(codeOf(() => isBusinessDay(env, '2026-04-06', []))).toBe('no-calendar');
    expect(codeOf(() => isBusinessDay(env, '2026-04-06', 'state'))).toBe('not-found');
  });

  it('ano não cadastrado é recusa que diz o calendário e o ano', () => {
    try {
      addBusinessDays(env, '2027-12-30', 3, 'national');
      throw new Error('deveria recusar');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessDaysError);
      expect((error as BusinessDaysError).code).toBe('year-missing');
      expect((error as BusinessDaysError).params).toEqual({ calendar: 'National', year: '2028' });
    }
  });

  it('data e quantidade inválidas, e o teto da busca', () => {
    expect(codeOf(() => isBusinessDay(env, 'ontem', 'national'))).toBe('invalid-date');
    expect(codeOf(() => addBusinessDays(env, '2026-04-06', 1.5, 'national'))).toBe('invalid-count');
    const years = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [String(2026 + index), []]));
    const everything = businessCalendarOf('all', { weekend: [0, 1, 2, 3, 4, 5, 6], years });
    const closed = { ...env, calendars: createBusinessCalendarSet([everything]) };
    expect(codeOf(() => nextBusinessDay(closed, '2026-04-06', 'all'))).toBe('too-far');
  });

  it('ano cadastrado sem dia marcado vale: só o fim de semana não é útil', () => {
    const empty = businessCalendarOf('e', { weekend: [0, 6], years: { '2026': [] } });
    expect(isBusinessDay({ ...env, calendars: createBusinessCalendarSet([empty]) }, '2026-01-01', 'e')).toBe(true);
  });
});

describe('dias úteis — mentionsBusinessDays', () => {
  it('reconhece a chamada, e não o nome solto', () => {
    expect(mentionsBusinessDays('addBusinessDays(date, 15, "national")')).toBe(true);
    expect(mentionsBusinessDays('isBusinessDayFlag == true')).toBe(false);
    expect(mentionsBusinessDays(undefined)).toBe(false);
  });
});
