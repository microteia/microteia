import { describe, expect, it } from 'vitest';
import { CONTAINED_ACTIONS, containedPermissionIds } from './access';
import {
  PLAN_ACCESS_UPGRADES,
  pendingPlanAccessUpgrades,
  planDefinitionOf,
  upgradePlanDenied,
} from './plans';

describe('ações contidas em outra da mesma coleção (#41)', () => {
  it('negar editar a coleção alcança anexar, anotar e etiquetar nela', () => {
    expect(containedPermissionIds('pets.update')).toEqual(['pets.attach', 'pets.annotate', 'pets.tag']);
  });

  it('as outras ações não contêm nada', () => {
    expect(containedPermissionIds('pets.create')).toEqual([]);
    expect(containedPermissionIds('pets.read')).toEqual([]);
    expect(Object.keys(CONTAINED_ACTIONS)).toEqual(['update']);
  });

  it('a permissão do núcleo que termina em `.update` não é coleção, e não ganha negação fantasma', () => {
    expect(containedPermissionIds('tenant.update')).toEqual([]);
  });

  it('id que não é de permissão é ignorado', () => {
    expect(containedPermissionIds('*')).toEqual([]);
  });
});

describe('conversão única dos planos (#41)', () => {
  it('o plano que nega editar passa a negar também as ações contidas', () => {
    const pending = pendingPlanAccessUpgrades([]);
    expect(upgradePlanDenied(pending, ['pets.create', 'pets.update'])).toEqual([
      'pets.annotate', 'pets.attach', 'pets.create', 'pets.tag', 'pets.update',
    ]);
  });

  it('nada muda quando o plano não nega editar — a marca é gravada mesmo assim', () => {
    expect(upgradePlanDenied(pendingPlanAccessUpgrades([]), ['pets.create', 'tenant.update'])).toBeNull();
    expect(upgradePlanDenied(pendingPlanAccessUpgrades([]), [])).toBeNull();
  });

  it('o plano já convertido não recebe de novo: a liberação do SYSTEM fica', () => {
    expect(pendingPlanAccessUpgrades([...PLAN_ACCESS_UPGRADES])).toEqual([]);
    expect(upgradePlanDenied([], ['pets.update'])).toBeNull();
  });

  it('o plano gravado antes da conversão lê como pendente', () => {
    const plan = planDefinitionOf('starter', { name: 'Starter', deniedPermissions: ['pets.update'] });
    expect(plan.accessUpgrades).toEqual([]);
    expect(pendingPlanAccessUpgrades(plan.accessUpgrades)).toEqual([...PLAN_ACCESS_UPGRADES]);
  });

  it('marca ilegível no documento não converte duas vezes nem quebra a leitura', () => {
    const plan = planDefinitionOf('starter', { name: 'Starter', accessUpgrades: ['contained-record-actions', 3] });
    expect(plan.accessUpgrades).toEqual(['contained-record-actions']);
  });
});
