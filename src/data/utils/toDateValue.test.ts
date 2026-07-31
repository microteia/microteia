import { describe, expect, it } from 'vitest';
import { toDateValue, toDateValueOrNow } from './toDateValue';

/**
 * O caso real: a listagem de Processos quebrou inteira num `filedAt` que não era `Date` —
 * `c.filedAt.getTime is not a function`. Uma coleção com mais de um escritor (tela fixa, tela de
 * extensão, automação) e documentos anteriores à coerção de tipo torna isso inevitável; a leitura
 * normaliza em vez de confiar.
 */
describe('toDateValue', () => {
  it('texto no formato de data vira Date — o valor que derrubava a listagem', () => {
    expect(toDateValue('2026-07-30')).toEqual(new Date(2026, 6, 30));
  });

  it('aceita as formas que o Firestore e o app produzem', () => {
    const date = new Date(2026, 0, 15);
    expect(toDateValue(date)).toBe(date);
    expect(toDateValue({ seconds: 1_700_000_000, nanoseconds: 0 })).toEqual(new Date(1_700_000_000_000));
    expect(toDateValue(1_700_000_000_000)).toEqual(new Date(1_700_000_000_000));
    expect(toDateValue('2026-01-15T10:30:00.000Z')).toEqual(new Date('2026-01-15T10:30:00.000Z'));
  });

  it('vazio e lixo viram null, que toda tela já sabe tratar', () => {
    expect(toDateValue(null)).toBeNull();
    expect(toDateValue(undefined)).toBeNull();
    expect(toDateValue('')).toBeNull();
    expect(toDateValue('não é data')).toBeNull();
    expect(toDateValue(new Date('inválida'))).toBeNull();
    expect(toDateValue({ qualquer: 'coisa' })).toBeNull();
  });

  it('os carimbos que a tela assume existir nunca voltam nulos', () => {
    expect(toDateValueOrNow('2026-07-30')).toEqual(new Date(2026, 6, 30));
    expect(toDateValueOrNow(undefined)).toBeInstanceOf(Date);
  });
});
