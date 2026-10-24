import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PORTAL_PROFILE_KEYS, PORTAL_PROFILE_VALUE_MAX } from '../src/domain/schema/portal';

/**
 * O convidado grava o próprio perfil direto no convite, e quem decide o que entra é a regra. Uma chave
 * nova em `PORTAL_PROFILE_KEYS` sem a regra acompanhar faria o portal oferecer um campo que toda
 * gravação recusa — e a recíproca deixaria gravar o que o kernel não lê.
 */
describe('perfil do convidado nas rules', () => {
  const rules = readFileSync(join(process.cwd(), 'firestore.rules'), 'utf8');
  const block = rules.match(/match \/portalUsers\/\{portalUserId\} \{([\s\S]*?)\n {6}\}/)?.[1] ?? '';

  it('a lista de chaves da regra espelha PORTAL_PROFILE_KEYS', () => {
    const keys = block.match(/profile\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)/)?.[1] ?? '';
    expect([...keys.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual([...PORTAL_PROFILE_KEYS].sort());
  });

  it('o limite de tamanho da regra é PORTAL_PROFILE_VALUE_MAX', () => {
    const limits = [...block.matchAll(/\.size\(\) <= (\d+)/g)].map((m) => Number(m[1]));
    expect(limits.length).toBe(PORTAL_PROFILE_KEYS.length);
    expect(new Set(limits)).toEqual(new Set([PORTAL_PROFILE_VALUE_MAX]));
  });
});
