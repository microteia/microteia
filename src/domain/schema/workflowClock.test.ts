import { describe, expect, it } from 'vitest';

import {
  MIN_SCHEDULE_INTERVAL_MINUTES,
  minCronIntervalMinutes,
  nextCronOccurrence,
  nextCronOccurrences,
  parseCron,
  scheduleIssues,
  scheduleTimeZone,
  addDays,
  dateReachedCron,
  dateReachedFireDay,
  dateReachedIssues,
  dateReachedPrefix,
  dateReachedTargetDay,
  parseOffsetDays,
  parseTimeOfDay,
  zonedInstant,
} from './workflowClock';

const parse = (expression: string) => {
  const parsed = parseCron(expression);
  if (!parsed) throw new Error(`cron inválido no teste: ${expression}`);
  return parsed;
};

const iso = (date: Date | null): string | null => date?.toISOString() ?? null;

describe('parseCron', () => {
  it('aceita os cinco campos com lista, faixa, passo e nomes', () => {
    const cron = parse('0,30 8-18/2 * jan-mar MON-FRI');
    expect([...cron.minutes]).toEqual([0, 30]);
    expect([...cron.hours]).toEqual([8, 10, 12, 14, 16, 18]);
    expect([...cron.months]).toEqual([1, 2, 3]);
    expect([...cron.daysOfWeek]).toEqual([1, 2, 3, 4, 5]);
    expect(cron.dayOfMonthRestricted).toBe(false);
    expect(cron.dayOfWeekRestricted).toBe(true);
  });

  it('expande as macros e trata 7 como domingo', () => {
    expect(parse('@daily').hours).toEqual(new Set([0]));
    expect([...parse('0 9 * * 7').daysOfWeek]).toEqual([0]);
  });

  it('recusa o que não é cron', () => {
    for (const bad of ['', '* * * *', '60 * * * *', '* 24 * * *', '0 0 0 * *', '5-1 * * * *', '*/0 * * * *', 'a b c d e', 42]) {
      expect(parseCron(bad)).toBeNull();
    }
  });
});

describe('nextCronOccurrence', () => {
  it('casa no relógio de parede do fuso do escritório', () => {
    const after = new Date('2026-10-12T10:00:00Z');
    expect(iso(nextCronOccurrence(parse('0 8 * * *'), after, 'America/Sao_Paulo'))).toBe('2026-10-12T11:00:00.000Z');
    expect(iso(nextCronOccurrence(parse('0 8 * * *'), after, 'UTC'))).toBe('2026-10-13T08:00:00.000Z');
  });

  it('é estritamente posterior ao instante dado', () => {
    const at = new Date('2026-10-13T11:00:00Z');
    expect(iso(nextCronOccurrence(parse('0 8 * * *'), at, 'America/Sao_Paulo'))).toBe('2026-10-14T11:00:00.000Z');
  });

  it('com dia do mês E dia da semana, vale qualquer um dos dois', () => {
    const after = new Date('2026-10-12T12:00:00Z');
    expect(iso(nextCronOccurrence(parse('0 9 20 * FRI'), after, 'UTC'))).toBe('2026-10-16T09:00:00.000Z');
  });

  it('acompanha o horário de verão: 8h continua sendo 8h', () => {
    const cron = parse('0 8 * * *');
    expect(iso(nextCronOccurrence(cron, new Date('2026-03-07T14:00:00Z'), 'America/New_York'))).toBe('2026-03-08T12:00:00.000Z');
    expect(iso(nextCronOccurrence(cron, new Date('2026-03-06T14:00:00Z'), 'America/New_York'))).toBe('2026-03-07T13:00:00.000Z');
  });

  it('atravessa meses e anos', () => {
    const after = new Date('2026-12-31T23:30:00Z');
    expect(iso(nextCronOccurrence(parse('0 0 1 1 *'), after, 'UTC'))).toBe('2027-01-01T00:00:00.000Z');
  });

  it('devolve null para a expressão que nunca casa', () => {
    expect(nextCronOccurrence(parse('0 0 31 2 *'), new Date('2026-01-01T00:00:00Z'), 'UTC')).toBeNull();
  });

  it('fuso inválido cai em UTC em vez de estourar', () => {
    const after = new Date('2026-10-12T10:00:00Z');
    expect(iso(nextCronOccurrence(parse('0 8 * * *'), after, 'Lugar/Nenhum'))).toBe('2026-10-13T08:00:00.000Z');
  });

  it('lista as próximas ocorrências em sequência', () => {
    const list = nextCronOccurrences(parse('0 9 * * MON'), new Date('2026-10-12T10:00:00Z'), 'UTC', 2);
    expect(list.map((date) => date.toISOString())).toEqual(['2026-10-19T09:00:00.000Z', '2026-10-26T09:00:00.000Z']);
  });
});

describe('minCronIntervalMinutes', () => {
  it('mede o menor intervalo do dia, incluindo a volta para o dia seguinte', () => {
    expect(minCronIntervalMinutes(parse('*/15 * * * *'))).toBe(15);
    expect(minCronIntervalMinutes(parse('0,5 8 * * *'))).toBe(5);
    expect(minCronIntervalMinutes(parse('0 8 * * *'))).toBe(24 * 60);
    expect(minCronIntervalMinutes(parse('0 0,23 * * *'))).toBe(60);
  });
});

describe('scheduleIssues', () => {
  it('aceita a declaração bem formada', () => {
    expect(scheduleIssues({ cron: '0 8 * * MON-FRI' })).toEqual([]);
    expect(scheduleIssues({ cron: '@daily', timeZone: 'America/Sao_Paulo' })).toEqual([]);
  });

  it('cobra a expressão ausente, inválida, que nunca casa ou frequente demais', () => {
    expect(scheduleIssues(undefined).map((issue) => issue.code)).toEqual(['missing']);
    expect(scheduleIssues({ cron: '  ' }).map((issue) => issue.code)).toEqual(['missing']);
    expect(scheduleIssues({ cron: 'todo dia' }).map((issue) => issue.code)).toEqual(['cron-invalid']);
    expect(scheduleIssues({ cron: '0 0 30 2 *' }).map((issue) => issue.code)).toEqual(['cron-invalid']);
    const frequent = scheduleIssues({ cron: '*/5 * * * *' });
    expect(frequent.map((issue) => issue.code)).toEqual(['too-frequent']);
    expect(frequent[0].messageParams?.minutes).toBe(String(MIN_SCHEDULE_INTERVAL_MINUTES));
  });

  it('cobra o fuso que a plataforma não conhece', () => {
    expect(scheduleIssues({ cron: '@daily', timeZone: '-03:00' }).map((issue) => issue.code)).toEqual(['time-zone-invalid']);
  });
});

describe('scheduleTimeZone', () => {
  it('o declarado sobrescreve o do escritório só quando é válido', () => {
    expect(scheduleTimeZone({ cron: '@daily' }, 'America/Sao_Paulo')).toBe('America/Sao_Paulo');
    expect(scheduleTimeZone({ cron: '@daily', timeZone: 'Europe/Lisbon' }, 'America/Sao_Paulo')).toBe('Europe/Lisbon');
    expect(scheduleTimeZone({ cron: '@daily', timeZone: 'x' }, 'America/Sao_Paulo')).toBe('America/Sao_Paulo');
  });
});

describe('gatilho de data — a forma', () => {
  it('lê o deslocamento em dias, com sinal, até o teto', () => {
    expect(parseOffsetDays('-3d')).toBe(-3);
    expect(parseOffsetDays('0d')).toBe(0);
    expect(parseOffsetDays('+1d')).toBe(1);
    expect(parseOffsetDays('1d')).toBe(1);
    for (const bad of ['-3', '3h', 'd', '-400d', '', 3]) expect(parseOffsetDays(bad)).toBeNull();
  });

  it('lê a hora do dia em HH:mm, e a transforma em cron', () => {
    expect(parseTimeOfDay('08:30')).toEqual({ hour: 8, minute: 30 });
    for (const bad of ['8:30', '24:00', '08:60', 'x']) expect(parseTimeOfDay(bad)).toBeNull();
    expect(dateReachedCron({ at: '07:15' })).toBe('15 7 * * *');
    expect(dateReachedCron({})).toBe('0 8 * * *');
  });

  it('separa o prefixo do nome do evento', () => {
    expect(dateReachedPrefix('prazo.dateReached')).toBe('prazo');
    expect(dateReachedPrefix('prazo.saved')).toBeNull();
    expect(dateReachedPrefix('.dateReached')).toBeNull();
  });

  it('cobra campo, deslocamento e hora — e o campo que não é de data, quando a tela é conhecida', () => {
    expect(dateReachedIssues({ field: 'dueDate', offset: '-3d', at: '09:00' })).toEqual([]);
    expect(dateReachedIssues({ field: 'dueDate', offset: '-3d' }, ['dueDate'])).toEqual([]);
    expect(dateReachedIssues(undefined).map((issue) => issue.code)).toEqual(['field-missing', 'offset-invalid']);
    expect(dateReachedIssues({ field: 'title', offset: '0d' }, ['dueDate']).map((issue) => issue.code)).toEqual(['field-not-date']);
    expect(dateReachedIssues({ field: 'dueDate', offset: '0d', at: '8h' }).map((issue) => issue.code)).toEqual(['at-invalid']);
  });
});

describe('gatilho de data — o calendário', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('-3d dispara três dias ANTES da data, e hoje alcança a data de daqui a três dias', () => {
    expect(dateReachedFireDay('2026-10-20', -3)).toBe('2026-10-17');
    expect(dateReachedTargetDay('2026-10-17', -3)).toBe('2026-10-20');
    expect(dateReachedTargetDay('2026-10-17', 1)).toBe('2026-10-16');
  });

  it('acha o instante da hora de parede no fuso, inclusive na virada do horário de verão', () => {
    expect(zonedInstant('2026-10-13', { hour: 0, minute: 0 }, 'America/Sao_Paulo').toISOString()).toBe('2026-10-13T03:00:00.000Z');
    expect(zonedInstant('2026-10-13', { hour: 8, minute: 0 }, 'UTC').toISOString()).toBe('2026-10-13T08:00:00.000Z');
    expect(zonedInstant('2026-03-08', { hour: 8, minute: 0 }, 'America/New_York').toISOString()).toBe('2026-03-08T12:00:00.000Z');
    expect(zonedInstant('2026-03-07', { hour: 8, minute: 0 }, 'America/New_York').toISOString()).toBe('2026-03-07T13:00:00.000Z');
  });
});
