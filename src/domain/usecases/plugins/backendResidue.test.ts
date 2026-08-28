import { describe, expect, it } from 'vitest';
import { backendResidueCount, hasBackendResidue } from './backendResidue';
import type { BackendResidue } from '../../entities/BackendResidue';

/**
 * A tarja da RETIRADA — o par do selo "Backend pendente", que é o da instalação. O que ela decide é uma
 * coisa só: se sobrou artefato no projeto. E o caso que importa não é o de sobrar, é o de NÃO sobrar
 * mais: uma tarja que fica depois de o `--prune` já ter resolvido é uma tarja que se aprende a ignorar.
 */
const residue = (overrides: Partial<BackendResidue> = {}): BackendResidue => ({
  scannedAt: new Date('2026-08-28T12:00:00.000Z'),
  consoleVersion: '2.15.0',
  tenants: 3,
  extensions: 7,
  orphanFunctions: [],
  orphanIndexes: [],
  ...overrides,
});

describe('o resíduo de backend', () => {
  it('não há tarja quando o Console nunca rodou neste projeto', () => {
    expect(hasBackendResidue(null)).toBe(false);
    expect(backendResidueCount(null)).toBe(0);
  });

  it('não há tarja quando a varredura aconteceu e não achou nada', () => {
    expect(hasBackendResidue(residue())).toBe(false);
  });

  it('a function órfã sozinha já vale a tarja', () => {
    const found = residue({ orphanFunctions: [{ name: 'acmeSync', owner: 'com.acme.crm' }] });
    expect(hasBackendResidue(found)).toBe(true);
    expect(backendResidueCount(found)).toBe(1);
  });

  /**
   * O índice órfão não é apagado por comando nenhum — a API que remove pede o id GERADO dele. Ele custa
   * escrita nas coleções que cobre, e por isso conta como resíduo igual à function.
   */
  it('o índice órfão sozinho também vale, e ele é o que nenhum comando apaga', () => {
    expect(hasBackendResidue(residue({ orphanIndexes: ['auditLogs: tenantId ASC'] }))).toBe(true);
  });

  it('conta as duas coisas juntas, que é o número que a tarja diz', () => {
    expect(backendResidueCount(residue({
      orphanFunctions: [{ name: 'a', owner: null }, { name: 'b', owner: 'com.x.y' }],
      orphanIndexes: ['auditLogs: tenantId ASC'],
    }))).toBe(3);
  });
});
