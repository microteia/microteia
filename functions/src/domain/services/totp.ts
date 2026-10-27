import {
  RECOVERY_CODE_ALPHABET,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
  TOTP_DIGITS,
  TOTP_PERIOD_SECONDS,
  TOTP_SKEW_STEPS,
} from '../schema/memberMfa';

/** HMAC-SHA1. Injetado: o domínio não importa `node:crypto`, e o teste usa os vetores da RFC. */
export type HmacSha1 = (key: Uint8Array, message: Uint8Array) => Uint8Array;

/** Bytes aleatórios de verdade — nunca `Math.random`, que não é fonte de segredo. */
export type RandomBytes = (size: number) => Uint8Array;

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 da RFC 4648, SEM padding: é a forma que todo aplicativo autenticador aceita na URI. */
export const base32Encode = (bytes: Uint8Array): string => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (text: string): Uint8Array => {
  const clean = text.toUpperCase().replace(/=+$/, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) throw new Error('invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
};

const counterBytes = (counter: number): Uint8Array => {
  const bytes = new Uint8Array(8);
  let rest = counter;
  for (let index = 7; index >= 0; index -= 1) {
    bytes[index] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  return bytes;
};

/** HOTP da RFC 4226 — o código do contador `counter`, com o truncamento dinâmico. */
export const hotp = (secret: Uint8Array, counter: number, hmac: HmacSha1, digits = TOTP_DIGITS): string => {
  const digest = hmac(secret, counterBytes(counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | (digest[offset + 1] << 16)
    | (digest[offset + 2] << 8)
    | digest[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
};

export const totpStep = (nowSeconds: number): number => Math.floor(nowSeconds / TOTP_PERIOD_SECONDS);

/** Comparação em tempo constante: a diferença de tempo entre um prefixo certo e um errado vaza o código. */
const sameCode = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
};

/**
 * O PASSO em que o código confere, ou `null`.
 *
 * Devolver o passo, e não um booleano, é o que fecha a reutilização: quem chama grava o passo aceito, e
 * todo passo igual ou anterior é recusado depois (`lastStep`). Sem isso, o mesmo código, visto por cima
 * do ombro, valeria por até noventa segundos.
 */
export const verifyTotp = (
  secret: Uint8Array,
  code: string,
  nowSeconds: number,
  lastStep: number | null,
  hmac: HmacSha1,
): number | null => {
  const current = totpStep(nowSeconds);
  let matched: number | null = null;
  for (let step = current - TOTP_SKEW_STEPS; step <= current + TOTP_SKEW_STEPS; step += 1) {
    if (lastStep !== null && step <= lastStep) continue;
    if (sameCode(hotp(secret, step, hmac), code) && matched === null) matched = step;
  }
  return matched;
};

/**
 * Códigos de recuperação sorteados por REJEIÇÃO: o byte que não cabe num múltiplo do alfabeto é
 * descartado, para que nenhuma letra saia mais que outra.
 */
export const generateRecoveryCodes = (random: RandomBytes, count = RECOVERY_CODE_COUNT): string[] => {
  const size = RECOVERY_CODE_ALPHABET.length;
  const limit = 256 - (256 % size);
  const codes = new Set<string>();
  while (codes.size < count) {
    let code = '';
    while (code.length < RECOVERY_CODE_LENGTH) {
      for (const byte of random(RECOVERY_CODE_LENGTH * 2)) {
        if (byte < limit && code.length < RECOVERY_CODE_LENGTH) code += RECOVERY_CODE_ALPHABET[byte % size];
      }
    }
    codes.add(code);
  }
  return [...codes];
};
