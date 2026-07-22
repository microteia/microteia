import { describe, it, expect } from 'vitest';
import type { PluginInstallation } from '../entities/PluginInstallation';
import {
  planDisable,
  planEnable,
  planInstall,
  planUninstall,
  planUpgrade,
} from './pluginLifecycle';
import type { LifecycleActor } from './pluginLifecycle';

const actor: LifecycleActor = { tenantId: 't1', userId: 'u1', now: new Date('2026-07-22T12:00:00Z') };

const installed = (overrides: Partial<PluginInstallation> = {}): PluginInstallation => ({
  pluginId: 'com.acme.x',
  tenantId: 't1',
  version: '1.2.0',
  enabled: true,
  config: {},
  grantedPermissions: ['data:cases:read'],
  installedAt: new Date('2026-01-01T00:00:00Z'),
  installedBy: 'u0',
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

const input = { pluginId: 'com.acme.x', version: '1.2.0', grantedPermissions: ['data:cases:read'] };

describe('planInstall', () => {
  it('cria a instalação quando não existe', () => {
    const outcome = planInstall(null, input, actor);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value).toMatchObject({
      pluginId: 'com.acme.x',
      version: '1.2.0',
      enabled: true,
      grantedPermissions: ['data:cases:read'],
      installedBy: 'u1',
      installedAt: actor.now,
    });
  });

  it('usa config vazio por padrão', () => {
    const outcome = planInstall(null, input, actor);
    expect(outcome.ok && outcome.value.config).toEqual({});
  });

  it('recusa reinstalar o que já está instalado', () => {
    const outcome = planInstall(installed(), input, actor);
    expect(outcome).toMatchObject({ ok: false, error: { code: 'already-installed' } });
  });

  it('recusa versão que não é semver', () => {
    const outcome = planInstall(null, { ...input, version: '1.x' }, actor);
    expect(outcome).toMatchObject({ ok: false, error: { code: 'invalid-version' } });
  });
});

describe('planEnable / planDisable', () => {
  it('desativa uma instalação ativa', () => {
    const outcome = planDisable(installed({ enabled: true }), actor);
    expect(outcome.ok && outcome.value.enabled).toBe(false);
    expect(outcome.ok && outcome.value.updatedBy).toBe('u1');
  });

  it('reativa uma instalação desativada', () => {
    const outcome = planEnable(installed({ enabled: false }), actor);
    expect(outcome.ok && outcome.value.enabled).toBe(true);
  });

  it('ativar o que já está ativo é no-op idempotente, não erro', () => {
    const outcome = planEnable(installed({ enabled: true }), actor);
    expect(outcome.ok && outcome.value.enabled).toBe(true);
  });

  it('recusa ativar/desativar o que não está instalado', () => {
    expect(planEnable(null, actor)).toMatchObject({ ok: false, error: { code: 'not-installed' } });
    expect(planDisable(null, actor)).toMatchObject({ ok: false, error: { code: 'not-installed' } });
  });
});

describe('planUpgrade', () => {
  it('sobe para uma versão mais recente', () => {
    const outcome = planUpgrade(installed({ version: '1.2.0' }), '1.3.0', actor);
    expect(outcome.ok && outcome.value.version).toBe('1.3.0');
  });

  it('preserva enabled, config e permissões ao atualizar', () => {
    const outcome = planUpgrade(installed({ enabled: false, config: { a: 1 } }), '2.0.0', actor);
    expect(outcome.ok && outcome.value).toMatchObject({ enabled: false, config: { a: 1 } });
  });

  it('recusa versão igual ou anterior', () => {
    expect(planUpgrade(installed({ version: '1.2.0' }), '1.2.0', actor)).toMatchObject({
      ok: false,
      error: { code: 'not-newer-version' },
    });
    expect(planUpgrade(installed({ version: '1.2.0' }), '1.1.9', actor)).toMatchObject({
      ok: false,
      error: { code: 'not-newer-version' },
    });
  });

  it('recusa versão inválida', () => {
    expect(planUpgrade(installed(), 'abc', actor)).toMatchObject({ ok: false, error: { code: 'invalid-version' } });
  });

  it('recusa atualizar o que não está instalado', () => {
    expect(planUpgrade(null, '2.0.0', actor)).toMatchObject({ ok: false, error: { code: 'not-installed' } });
  });
});

describe('planUninstall', () => {
  it('aprova remover uma instalação existente', () => {
    expect(planUninstall(installed()).ok).toBe(true);
  });

  it('recusa remover o que não está instalado', () => {
    expect(planUninstall(null)).toMatchObject({ ok: false, error: { code: 'not-installed' } });
  });
});
