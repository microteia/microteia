import { describe, it, expect } from 'vitest';
import {
  compareTextFor,
  currencyForLocale,
  formatDateFor,
  formatMoneyFor,
  formatNumberFor,
  localeDisplayName,
} from './localeFormat';

const day = new Date(Date.UTC(2026, 7, 13, 12, 0, 0));

describe('formatDateFor', () => {
  it('escreve a data como cada idioma a escreve', () => {
    expect(formatDateFor('pt-BR', day)).toBe('13/08/2026');
    expect(formatDateFor('en-US', day)).toBe('8/13/2026');
  });

  it('aceita as três formas com que uma data chega ao sistema', () => {
    expect(formatDateFor('pt-BR', day.toISOString())).toBe('13/08/2026');
    expect(formatDateFor('pt-BR', day)).toBe('13/08/2026');
  });

  it('o texto de um dia é aquele dia em qualquer fuso — nunca a véspera da meia-noite UTC', () => {
    expect(formatDateFor('pt-BR', '2026-08-13')).toBe('13/08/2026');
  });

  it('lê o Timestamp do Firestore, que antes virava vazio', () => {
    expect(formatDateFor('pt-BR', { toDate: () => day, seconds: day.getTime() / 1000 })).toBe('13/08/2026');
  });

  it('devolve vazio — nunca "Invalid Date" — para o irreconhecível', () => {
    expect(formatDateFor('pt-BR', 'nem data')).toBe('');
    expect(formatDateFor('pt-BR', null)).toBe('');
    expect(formatDateFor('pt-BR', '')).toBe('');
  });
});

describe('formatMoneyFor', () => {
  it('formata na convenção do idioma', () => {
    expect(formatMoneyFor('pt-BR', 1234.56, 'BRL')).toBe('R$ 1.234,56');
    expect(formatMoneyFor('en-US', 1234.56, 'USD')).toBe('$1,234.56');
  });

  /** O espaço fino do `Intl` quebra comparação, busca e diff — e ninguém o enxerga. */
  it('troca o espaço inquebrável por espaço comum', () => {
    expect(formatMoneyFor('pt-BR', 1, 'BRL')).not.toMatch(/[\u00A0\u202F]/);
  });

  it('devolve vazio para o que não é número', () => {
    expect(formatMoneyFor('pt-BR', null, 'BRL')).toBe('');
    expect(formatMoneyFor('pt-BR', Number.NaN, 'BRL')).toBe('');
  });
});

describe('formatNumberFor', () => {
  it('respeita o separador de cada idioma', () => {
    expect(formatNumberFor('pt-BR', 1234.5)).toBe('1.234,5');
    expect(formatNumberFor('en-US', 1234.5)).toBe('1,234.5');
  });
});

describe('compareTextFor', () => {
  /** Sem idioma explícito, o servidor ordenaria "Ávila" depois de "Zuza". */
  it('ordena acento no lugar certo', () => {
    expect(compareTextFor('pt-BR', 'Ávila', 'Zuza')).toBeLessThan(0);
  });
});

describe('currencyForLocale', () => {
  it('deriva da região quando ela existe', () => {
    expect(currencyForLocale('pt-BR')).toBe('BRL');
    expect(currencyForLocale('pt-PT')).toBe('EUR');
    expect(currencyForLocale('en-US')).toBe('USD');
  });

  it('cai no idioma quando não há região', () => {
    expect(currencyForLocale('en')).toBe('USD');
  });

  it('cai em USD quando não conhece o idioma, junto com o padrão do texto', () => {
    expect(currencyForLocale('ja')).toBe('USD');
  });
});

describe('localeDisplayName', () => {
  /** Quem procura a própria língua a procura como ELA se escreve, não como o idioma atual a chama. */
  it('escreve o nome do idioma no próprio idioma', () => {
    expect(localeDisplayName('pt-BR').toLowerCase()).toContain('portugu');
    expect(localeDisplayName('en').toLowerCase()).toContain('english');
  });
});
