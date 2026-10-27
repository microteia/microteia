import { createHmac, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateRecoveryCodes, hotp, totpStep, verifyTotp } from './totp';
import { RECOVERY_CODE_ALPHABET, RECOVERY_CODE_COUNT, RECOVERY_CODE_LENGTH, recoveryCodeOf } from '../schema/memberMfa';

const hmac = (key: Uint8Array, message: Uint8Array): Uint8Array =>
  new Uint8Array(createHmac('sha1', key).update(message).digest());

const RFC_SECRET = new TextEncoder().encode('12345678901234567890');

describe('totp', () => {
  it('reproduz os vetores HOTP da RFC 4226 (apêndice D)', () => {
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
    expected.forEach((code, counter) => expect(hotp(RFC_SECRET, counter, hmac)).toBe(code));
  });

  it('reproduz os vetores TOTP SHA-1 da RFC 6238 (apêndice B), em oito dígitos', () => {
    const vectors: Array<[number, string]> = [
      [59, '94287082'],
      [1111111109, '07081804'],
      [1111111111, '14050471'],
      [1234567890, '89005924'],
      [2000000000, '69279037'],
      [20000000000, '65353130'],
    ];
    for (const [time, code] of vectors) expect(hotp(RFC_SECRET, totpStep(time), hmac, 8)).toBe(code);
  });

  it('base32 vai e volta, sem padding, e bate com a RFC 4648', () => {
    expect(base32Encode(new TextEncoder().encode('foobar'))).toBe('MZXW6YTBOI');
    expect(new TextDecoder().decode(base32Decode('MZXW6YTBOI'))).toBe('foobar');
    const secret = randomBytes(20);
    expect(base32Decode(base32Encode(secret))).toEqual(new Uint8Array(secret));
    expect(base32Encode(secret)).toHaveLength(32);
    expect(() => base32Decode('1NVALID')).toThrow();
  });

  it('aceita o passo corrente e um para cada lado, e devolve o passo que conferiu', () => {
    const now = 1_800_000_000;
    const step = totpStep(now);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step, hmac), now, null, hmac)).toBe(step);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1, hmac), now, null, hmac)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1, hmac), now, null, hmac)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2, hmac), now, null, hmac)).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 2, hmac), now, null, hmac)).toBeNull();
  });

  it('recusa o código de um passo já usado, e o de qualquer passo anterior a ele', () => {
    const now = 1_800_000_000;
    const step = totpStep(now);
    const code = hotp(RFC_SECRET, step, hmac);
    expect(verifyTotp(RFC_SECRET, code, now, step, hmac)).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step - 1, hmac), now, step, hmac)).toBeNull();
    expect(verifyTotp(RFC_SECRET, hotp(RFC_SECRET, step + 1, hmac), now, step, hmac)).toBe(step + 1);
  });

  it('recusa código de outro segredo', () => {
    const now = 1_800_000_000;
    const other = new TextEncoder().encode('09876543210987654321');
    expect(verifyTotp(RFC_SECRET, hotp(other, totpStep(now), hmac), now, null, hmac)).toBeNull();
  });

  it('sorteia dez códigos de recuperação distintos, do alfabeto, que a normalização reconhece', () => {
    const codes = generateRecoveryCodes((size) => new Uint8Array(randomBytes(size)));
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) {
      expect(code).toHaveLength(RECOVERY_CODE_LENGTH);
      expect([...code].every((char) => RECOVERY_CODE_ALPHABET.includes(char))).toBe(true);
      expect(recoveryCodeOf(`${code.slice(0, 5).toUpperCase()}-${code.slice(5)}`)).toBe(code);
    }
  });

  it('descarta o byte fora do múltiplo do alfabeto em vez de enviesar o sorteio', () => {
    let calls = 0;
    const biased = (size: number): Uint8Array => {
      calls += 1;
      return new Uint8Array(size).fill(calls === 1 ? 255 : 0);
    };
    const [code] = generateRecoveryCodes(biased, 1);
    expect(code).toBe(RECOVERY_CODE_ALPHABET[0].repeat(RECOVERY_CODE_LENGTH));
  });
});
