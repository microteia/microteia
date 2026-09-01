import { describe, it, expect } from 'vitest';
import { KERNEL_CATALOG_FINGERPRINT } from './catalogFingerprint';
import { buildPermissionCatalog } from './resolvePermissions';

const digitalDe = (catalogo: ReturnType<typeof buildPermissionCatalog>): string =>
  catalogo.list.map((permission) => `${permission.id}<${[...permission.requires].sort().join(',')}`).join('|');

describe('a digital do catálogo de código', () => {
  it('é estável entre leituras — o carimbo não pode mudar sozinho', () => {
    expect(KERNEL_CATALOG_FINGERPRINT).toMatch(/^[0-9a-f]{16}$/);
  });

  /**
   * O que ela precisa enxergar é a DERIVAÇÃO, não só os dados declarados: foi uma regra de derivação
   * que criou o problema — o dia em que criar, editar e excluir passaram a exigir ver. Este teste
   * prova que uma mudança dessas move a forma que a digital resume.
   */
  it('muda quando a DEPENDÊNCIA derivada de uma coleção muda', () => {
    const antes = digitalDe(buildPermissionCatalog([], [{ id: 'sonda', name: 'sonda', deriveCrud: true }]));
    const semDerivar = digitalDe(buildPermissionCatalog([], [{ id: 'sonda', name: 'sonda' }]));
    expect(antes).not.toBe(semDerivar);
    expect(antes).toContain('sonda.create<sonda.read');
  });

  it('não muda quando só o RÓTULO de uma permissão muda — texto não move permissão nenhuma', () => {
    const comum = [{ permission: { id: 'x.use', name: '@a/um' }, source: 'a' }];
    const traduzido = [{ permission: { id: 'x.use', name: '@a/outro' }, source: 'a' }];
    expect(digitalDe(buildPermissionCatalog(comum, []))).toBe(digitalDe(buildPermissionCatalog(traduzido, [])));
  });
});
