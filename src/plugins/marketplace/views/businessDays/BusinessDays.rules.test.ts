import { describe, expect, it } from 'vitest';
import {
  copyYear,
  draftOf,
  freeKey,
  isKeyTaken,
  isValidKey,
  keyFromName,
  monthGridOf,
  withDay,
  withWeekday,
  withYear,
  withoutYear,
  yearsOf,
} from './BusinessDays.rules';

const base = draftOf({ name: 'National', key: 'national', weekend: [6, 0], years: { '2026': ['2026-12-25', '2026-01-01'] } });

describe('grade de dias úteis — regras', () => {
  it('o mês começa no domingo e toda linha tem sete casas', () => {
    const grid = monthGridOf(2026, 2);
    expect(grid[0]).toEqual(['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-02-05', '2026-02-06', '2026-02-07']);
    expect(grid.every((row) => row.length === 7)).toBe(true);
    expect(monthGridOf(2026, 4)[0].slice(0, 3)).toEqual([null, null, null]);
  });

  it('lê o documento ordenando e descartando o que está malformado', () => {
    expect(base.weekend).toEqual([0, 6]);
    expect(base.years).toEqual({ '2026': ['2026-01-01', '2026-12-25'] });
    expect(draftOf({ years: { '2026': ['2027-01-01', '2026-02-30'] } }).years).toEqual({ '2026': [] });
  });

  it('marcar e desmarcar um dia só vale para um ano cadastrado', () => {
    expect(withDay(base, '2026-04-21', true).years['2026']).toContain('2026-04-21');
    expect(withDay(base, '2026-12-25', false).years['2026']).toEqual(['2026-01-01']);
    expect(withDay(base, '2027-01-01', true)).toBe(base);
  });

  it('acrescenta, remove e copia anos dentro do MESMO calendário', () => {
    const withNext = withYear(base, 2027);
    expect(yearsOf(withNext)).toEqual(['2026', '2027']);
    expect(withYear(withNext, 2027)).toBe(withNext);
    expect(yearsOf(withoutYear(withNext, '2026'))).toEqual(['2027']);
    expect(copyYear(base, '2026', '2027').years['2027']).toEqual(['2027-01-01', '2027-12-25']);
  });

  it('a cópia descarta o dia que não existe no ano de destino', () => {
    const leap = draftOf({ years: { '2028': ['2028-02-29', '2028-03-01'] } });
    expect(copyYear(leap, '2028', '2029').years['2029']).toEqual(['2029-03-01']);
  });

  it('liga e desliga um dia da semana', () => {
    expect(withWeekday(base, 5, true).weekend).toEqual([0, 5, 6]);
    expect(withWeekday(base, 6, false).weekend).toEqual([0]);
  });

  it('chave: forma, derivação do nome e unicidade sem diferenciar maiúsculas', () => {
    expect(isValidKey('national-2')).toBe(true);
    expect(isValidKey('-x')).toBe(false);
    expect(keyFromName('São Paulo — Capital')).toBe('sao-paulo-capital');
    expect(freeKey('Calendar', ['calendar', 'calendar-2'])).toBe('calendar-3');
    expect(isKeyTaken('National', ['national'])).toBe(true);
  });
});
