import { describe, it, expect } from 'vitest';
import { coerceWriteValue, parseDateOnly } from './mutationSpec';

/**
 * O dia digitado tem de voltar como o MESMO dia — venha ele da tela (onde "local" é o escritório) ou
 * do servidor (onde "local" é UTC). O teste fixa o instante escolhido, que é a razão de a regra
 * existir: meia-noite em UTC seria o dia anterior para quem lê no Brasil.
 */
describe('parseDateOnly', () => {
  it('um dia puro vira meio-dia em UTC', () => {
    expect(parseDateOnly('2026-08-12')?.toISOString()).toBe('2026-08-12T12:00:00.000Z');
  });

  it('o dia se lê igual no fuso do escritório, e não na véspera', () => {
    const date = parseDateOnly('2026-08-12') as Date;
    const noBrasil = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    expect(noBrasil).toBe('12/08/2026');
  });

  it('o que não é um dia puro não responde aqui', () => {
    expect(parseDateOnly('2026-08-12T10:30:00Z')).toBeNull();
    expect(parseDateOnly('12/08/2026')).toBeNull();
    expect(parseDateOnly('')).toBeNull();
  });
});

describe('coerceWriteValue — data', () => {
  it('grava o dia puro no mesmo instante de parseDateOnly', () => {
    expect(coerceWriteValue('date', ' 2026-08-12 ')).toEqual(parseDateOnly('2026-08-12'));
  });

  it('um instante completo é respeitado como veio', () => {
    expect(coerceWriteValue('date', '2026-08-12T10:30:00.000Z')).toEqual(new Date('2026-08-12T10:30:00.000Z'));
  });

  it('vazio é ausência de data, não uma data inválida', () => {
    expect(coerceWriteValue('date', '   ')).toBeNull();
  });
});
