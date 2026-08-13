import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  isValidLocale,
  localeChain,
  negotiateLocale,
  normalizeLocale,
  resolutionOrder,
} from './localeNegotiation';

describe('normalizeLocale', () => {
  it('leva à forma canônica do BCP-47', () => {
    expect(normalizeLocale('pt-br')).toBe('pt-BR');
    expect(normalizeLocale('PT-BR')).toBe('pt-BR');
    expect(normalizeLocale('  en  ')).toBe('en');
  });

  it('aceita o sublinhado, que aparece em arquivo escrito à mão', () => {
    expect(normalizeLocale('pt_BR')).toBe('pt-BR');
  });

  it('devolve vazio para o que não é texto', () => {
    expect(normalizeLocale(null)).toBe('');
    expect(normalizeLocale(42)).toBe('');
    expect(normalizeLocale('')).toBe('');
  });
});

describe('isValidLocale', () => {
  it('aceita idioma com e sem região', () => {
    expect(isValidLocale('en')).toBe(true);
    expect(isValidLocale('pt-BR')).toBe(true);
    expect(isValidLocale('zh-Hans-CN')).toBe(true);
  });

  it('recusa o que não tem forma de idioma', () => {
    expect(isValidLocale('')).toBe(false);
    expect(isValidLocale('português')).toBe(false);
    expect(isValidLocale(null)).toBe(false);
  });
});

describe('localeChain', () => {
  it('vai do mais específico ao mais genérico', () => {
    expect(localeChain('pt-BR')).toEqual(['pt-BR', 'pt']);
    expect(localeChain('zh-Hans-CN')).toEqual(['zh-Hans-CN', 'zh-Hans', 'zh']);
    expect(localeChain('en')).toEqual(['en']);
  });
});

describe('negotiateLocale', () => {
  it('devolve o exato quando ele existe', () => {
    expect(negotiateLocale('pt-BR', ['en', 'pt-BR'])).toBe('pt-BR');
  });

  it('cai no idioma sem região antes de cair no padrão', () => {
    expect(negotiateLocale('pt-BR', ['en', 'pt'])).toBe('pt');
  });

  it('cai no padrão quando nada da cadeia está instalado', () => {
    expect(negotiateLocale('ja', ['en', 'pt-BR'])).toBe(DEFAULT_LOCALE);
  });

  it('não se importa com a grafia do que está instalado', () => {
    expect(negotiateLocale('PT_br', ['pt-br'])).toBe('pt-BR');
  });
});

describe('resolutionOrder', () => {
  it('empilha do mais genérico ao mais específico, com o idioma-fonte na base', () => {
    expect(resolutionOrder('pt-BR')).toEqual(['en', 'pt', 'pt-BR']);
  });

  it('não repete o idioma-fonte quando ele já está na cadeia', () => {
    expect(resolutionOrder('en')).toEqual(['en']);
    expect(resolutionOrder('en-GB')).toEqual(['en', 'en-GB']);
  });
});
