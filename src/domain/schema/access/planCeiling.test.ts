import { describe, it, expect } from 'vitest';
import { buildPermissionCatalog } from './resolvePermissions';
import { applyPlanCeiling, deniedByPlan, planDeniedClosure } from './planCeiling';
import { UNRESTRICTED_PERMISSION, grants, grantsAll, grantsAny } from './memberPermissions';
import { matchesPermission } from './permissionPattern';

const catalog = buildPermissionCatalog(
  [
    { source: 'core', permission: { id: 'extensions.read', name: 'See' } },
    { source: 'core', permission: { id: 'extensions.manage', name: 'Manage', requires: ['extensions.read'] } },
    { source: 'core', permission: { id: 'extensions.publish', name: 'Publish', requires: ['extensions.manage'] } },
    { source: 'core', permission: { id: 'screens.manage', name: 'Design' } },
  ],
  [{ id: 'pets', name: 'Pets', deriveCrud: true }],
);

describe('planDeniedClosure — o que cai junto com a negada', () => {
  it('sem negação, nada cai', () => {
    expect(planDeniedClosure(catalog, [])).toEqual([]);
  });

  it('toda permissão cujo fecho alcança a negada cai junto, em qualquer profundidade', () => {
    expect(planDeniedClosure(catalog, ['extensions.read'])).toEqual([
      'extensions.manage',
      'extensions.publish',
      'extensions.read',
    ]);
  });

  it('negar a de cima não derruba a de baixo', () => {
    expect(planDeniedClosure(catalog, ['extensions.manage'])).toEqual(['extensions.manage', 'extensions.publish']);
  });

  it('a negada que o catálogo não conhece continua na lista — o plano é global', () => {
    expect(planDeniedClosure(catalog, ['finance.write'])).toEqual(['finance.write']);
  });
});

describe('applyPlanCeiling — o conjunto sob o teto', () => {
  it('o curinga ganha as exceções do plano', () => {
    const owner = applyPlanCeiling([UNRESTRICTED_PERMISSION], ['screens.manage']);
    expect(owner).toEqual(['*', '!screens.manage']);
    expect(grants(owner, 'screens.manage')).toBe(false);
    expect(grants(owner, 'pets.delete')).toBe(true);
    expect(deniedByPlan(owner, 'screens.manage')).toBe(true);
  });

  it('a negada sai do conjunto de quem a recebeu por perfil', () => {
    expect(applyPlanCeiling(['pets.read', 'screens.manage'], ['screens.manage'])).toEqual(['pets.read', '!screens.manage']);
  });

  it('sem negação, o conjunto passa intacto — e reaplicar não acumula entradas velhas', () => {
    expect(applyPlanCeiling(['pets.read'], [])).toEqual(['pets.read']);
    expect(applyPlanCeiling(['*', '!screens.manage'], [])).toEqual(['*']);
  });

  it('grantsAny e grantsAll respeitam a negação mesmo com o curinga', () => {
    const owner = applyPlanCeiling([UNRESTRICTED_PERMISSION], ['screens.manage']);
    expect(grantsAny(owner, ['screens.manage'])).toBe(false);
    expect(grantsAny(owner, ['screens.manage', 'pets.read'])).toBe(true);
    expect(grantsAll(owner, ['screens.manage', 'pets.read'])).toBe(false);
  });
});

describe('matchesPermission sob o teto do plano', () => {
  it('o identificador exato negado responde não, mesmo para o dono', () => {
    const owner = ['*', '!pets.delete'];
    expect(matchesPermission(owner, 'pets.delete')).toBe(false);
    expect(matchesPermission(owner, '<entity>.delete', 'pets')).toBe(false);
    expect(matchesPermission(owner, 'pets.read')).toBe(true);
  });

  it('o curinga do padrão nunca casa com uma entrada de negação', () => {
    expect(matchesPermission(['pets.read', '!pets.delete'], '*.delete')).toBe(false);
    expect(matchesPermission(['pets.read', '!pets.delete'], 'pets.*')).toBe(true);
  });
});
