import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from '../shared/paths.js';
import { asString, asTimestamp, decodeValue } from './firestoreRest.js';

const source = (relative: string): string =>
  readFileSync(join(repoRoot, 'cli/src', relative), 'utf8');

/**
 * O tipo com que o Console grava um campo é lido do outro lado do produto, e o erro não aparece na
 * leitura.
 *
 * `backendState.appliedAt` era gravado como `stringValue`. A tela lia o texto, exibia a data certa e
 * falhava só ao gravar de volta — `Timestamp.fromDate` recebendo uma string, num botão que não fazia
 * nada. Data é `timestampValue`, e é aqui que isso se decide.
 */
describe('o tipo do valor gravado pela REST', () => {
  it('data vira timestampValue, em RFC 3339 UTC', () => {
    const valor = asTimestamp(new Date('2026-08-21T11:04:07.412Z'));
    expect(valor).toEqual({ timestampValue: '2026-08-21T11:04:07.412Z' });
  });

  it('e texto continua texto', () => {
    expect(asString('a1b2c3')).toEqual({ stringValue: 'a1b2c3' });
  });

  /** A volta pela REST devolve string ISO nos dois casos — é o que `provision` já lia no fingerprint. */
  it('a leitura entende as duas formas, para o que já está gravado', () => {
    expect(decodeValue({ timestampValue: '2026-08-21T11:04:07.412Z' })).toBe('2026-08-21T11:04:07.412Z');
    expect(decodeValue({ stringValue: '2026-08-21T11:04:07.412Z' })).toBe('2026-08-21T11:04:07.412Z');
  });
});

describe('o carimbo de backendState', () => {
  const provision = source('console/provision.ts');

  it('grava appliedAt como data, e não como texto', () => {
    expect(provision).toContain('appliedAt: asTimestamp(appliedAt),');
    expect(provision).not.toContain("const appliedAt = new Date().toISOString();");
  });

  it('e o fingerprint, que é texto, continua texto', () => {
    expect(provision).toContain('fingerprint: asString(fingerprint),');
  });
});
