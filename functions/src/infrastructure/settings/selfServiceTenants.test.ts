import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v2', () => ({ logger: { error: vi.fn() } }));

import { selfServiceTenantsOf } from './selfServiceTenants';

describe('selfServiceTenantsOf', () => {
  it('vazio e true mantêm o comportamento de sempre', () => {
    expect(selfServiceTenantsOf('')).toBe(true);
    expect(selfServiceTenantsOf(' TRUE ')).toBe(true);
  });

  it('false desliga', () => {
    expect(selfServiceTenantsOf('false')).toBe(false);
    expect(selfServiceTenantsOf('False')).toBe(false);
  });

  it('o valor que não se entende FECHA — quem escreveu "off" quis desligar', () => {
    expect(selfServiceTenantsOf('off')).toBe(false);
    expect(selfServiceTenantsOf('no')).toBe(false);
    expect(selfServiceTenantsOf('0')).toBe(false);
  });
});
