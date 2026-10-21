import { describe, expect, it } from 'vitest';
import { PORTAL_USERS_COLLECTION } from './portal';
import { RESERVED_COLLECTIONS } from './screenEntity';

describe('coleções do portal', () => {
  // Importado PRIMEIRO pelo portal.ts: com o ciclo de volta a screenEntity.ts, o navegador estourava
  // "before initialization" e o Vitest deixava `undefined` calado no conjunto reservado.
  it('estão reservadas mesmo quando portal.ts é o primeiro a carregar', () => {
    expect(PORTAL_USERS_COLLECTION).toBe('portalUsers');
    expect(RESERVED_COLLECTIONS.has('portalUsers')).toBe(true);
    expect(RESERVED_COLLECTIONS.has('portalRecords')).toBe(true);
    expect(RESERVED_COLLECTIONS.has(undefined as unknown as string)).toBe(false);
  });
});
