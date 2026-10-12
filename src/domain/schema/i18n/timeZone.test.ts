import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_ZONE,
  TIME_ZONE_SETTING,
  automaticTimeZone,
  dayInTimeZone,
  isValidTimeZone,
  resolveTimeZone,
  timeZoneForLocale,
  timeZoneOptions,
} from './timeZone';

/** 22h de 30/03 em Brasília — UTC já está em 31/03. */
const EVENING_IN_BRASILIA = new Date('2026-03-31T01:00:00.000Z');

describe('isValidTimeZone', () => {
  it('aceita identificador IANA que a plataforma conhece', () => {
    expect(isValidTimeZone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone(' Europe/Lisbon ')).toBe(true);
  });

  it('recusa deslocamento solto, nome inventado e o que não é texto', () => {
    expect(isValidTimeZone('-03:00')).toBe(false);
    expect(isValidTimeZone('GMT-3')).toBe(false);
    expect(isValidTimeZone('America/Atlantida')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});

describe('timeZoneOptions', () => {
  it('lista os fusos da plataforma, com UTC sempre presente', () => {
    const options = timeZoneOptions();
    expect(options).toContain('UTC');
    expect(options).toContain('America/Sao_Paulo');
    expect(options.every(isValidTimeZone)).toBe(true);
  });
});

describe('resolveTimeZone — usuário → escritório → padrão', () => {
  it('a preferência pessoal vence a do escritório', () => {
    expect(resolveTimeZone({
      user: { [TIME_ZONE_SETTING]: 'America/Manaus' },
      tenant: { [TIME_ZONE_SETTING]: 'America/Sao_Paulo' },
    })).toBe('America/Manaus');
  });

  it('sem preferência pessoal, vale a do escritório', () => {
    expect(resolveTimeZone({ user: {}, tenant: { [TIME_ZONE_SETTING]: 'Europe/Lisbon' } })).toBe('Europe/Lisbon');
  });

  it('sem fuso gravado, o escritório pt-BR fica no horário de Brasília', () => {
    expect(resolveTimeZone({ user: {}, tenant: { 'i18n.locale': 'pt-BR' } })).toBe('America/Sao_Paulo');
  });

  it('sem fuso nem idioma do escritório, o idioma gravado do usuário sugere', () => {
    expect(resolveTimeZone({ user: { 'i18n.locale': 'pt-BR' }, tenant: {} })).toBe('America/Sao_Paulo');
  });

  it('o idioma do ESCRITÓRIO vence o do usuário no automático — o dia é do escritório', () => {
    expect(automaticTimeZone({ user: { 'i18n.locale': 'pt-BR' }, tenant: { 'i18n.locale': 'en' } }))
      .toBe(DEFAULT_TIME_ZONE);
  });

  it('valor gravado inválido ou vazio cai para o próximo nível em vez de quebrar', () => {
    expect(resolveTimeZone({
      user: { [TIME_ZONE_SETTING]: 'GMT-3' },
      tenant: { [TIME_ZONE_SETTING]: '', 'i18n.locale': 'pt-BR' },
    })).toBe('America/Sao_Paulo');
  });

  it('sem nada, UTC — o que today() sempre respondeu', () => {
    expect(resolveTimeZone({ user: {}, tenant: {} })).toBe('UTC');
    expect(timeZoneForLocale('en')).toBe('UTC');
    expect(timeZoneForLocale('pt')).toBe('UTC');
  });
});

describe('dayInTimeZone', () => {
  it('às 22h em Brasília o dia ainda é o de hoje, embora UTC já tenha virado', () => {
    expect(dayInTimeZone(EVENING_IN_BRASILIA, 'America/Sao_Paulo')).toBe('2026-03-30');
    expect(dayInTimeZone(EVENING_IN_BRASILIA, 'UTC')).toBe('2026-03-31');
  });

  it('fuso inválido cai no padrão', () => {
    expect(dayInTimeZone(EVENING_IN_BRASILIA, 'nada')).toBe('2026-03-31');
  });
});
