import { describe, expect, it } from 'vitest';
import { portalTenantOf } from './portalPaths';

describe('o escritório de um caminho do portal', () => {
  it('é o primeiro segmento depois de /portal — para a entrada mostrar os provedores DELE', () => {
    expect(portalTenantOf('/portal/salva%20dor/companies?record=1')).toBe('salva dor');
    expect(portalTenantOf('/portal/salvador')).toBe('salvador');
  });

  it('fora do portal, ou na própria entrada, não há escritório', () => {
    expect(portalTenantOf('/admin')).toBeNull();
    expect(portalTenantOf('/portal/signin')).toBeNull();
    expect(portalTenantOf(null)).toBeNull();
  });
});
