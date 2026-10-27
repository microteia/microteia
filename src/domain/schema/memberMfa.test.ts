import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMBER_MFA_POLICY,
  MFA_SESSION_CLAIM,
  memberMfaPolicyIssue,
  memberMfaPolicyOf,
  memberMfaRequirementFrom,
  memberMfaRequirementOf,
  mfaIssuerOf,
  mfaSessionExpiresAt,
  mfaSessionIssue,
  mfaVerifiedAtOf,
  recoveryCodeOf,
  totpCodeOf,
} from './memberMfa';

const enabled = { ...DEFAULT_MEMBER_MFA_POLICY, enabled: true };

describe('política de segundo fator', () => {
  it('sem documento é a desligada — o que valia antes de ela existir', () => {
    expect(memberMfaPolicyOf(undefined)).toEqual(DEFAULT_MEMBER_MFA_POLICY);
    expect(memberMfaPolicyOf({ enabled: 'sim' }).enabled).toBe(false);
  });

  it('ligada e sem dizer quem, vale para TODOS: exigir de mais tranca, exigir de menos abre', () => {
    expect(memberMfaPolicyOf({ enabled: true }).everyone).toBe(true);
    expect(memberMfaPolicyOf({ enabled: true, roleIds: ['fiscal'] }).everyone).toBe(false);
  });

  it('ordena e tira repetidos e vazios das listas; intervalo fora da faixa cai no padrão', () => {
    const policy = memberMfaPolicyOf({ enabled: true, roleIds: ['b', 'a', 'a', ''], permissions: [3, 'x'], reverifyMinutes: 1 });
    expect(policy.roleIds).toEqual(['a', 'b']);
    expect(policy.permissions).toEqual(['x']);
    expect(policy.reverifyMinutes).toBe(DEFAULT_MEMBER_MFA_POLICY.reverifyMinutes);
  });

  it('a gravação é estrita: recusa forma errada, intervalo fora da faixa e escopo vazio', () => {
    expect(memberMfaPolicyIssue({ ...enabled, everyone: true })).toBeNull();
    expect(memberMfaPolicyIssue({ ...enabled, everyone: 'yes' })).toBe('@core.access/mfa.policy.invalid');
    expect(memberMfaPolicyIssue({ ...enabled, roleIds: [''] })).toBe('@core.access/mfa.policy.invalid');
    expect(memberMfaPolicyIssue({ ...enabled, everyone: true, reverifyMinutes: 4 })).toBe('@core.access/mfa.policy.reverify-range');
    expect(memberMfaPolicyIssue({ ...enabled, everyone: true, reverifyMinutes: 10081 })).toBe('@core.access/mfa.policy.reverify-range');
    expect(memberMfaPolicyIssue(enabled)).toBe('@core.access/mfa.policy.scope-empty');
    expect(memberMfaPolicyIssue(DEFAULT_MEMBER_MFA_POLICY)).toBeNull();
  });
});

describe('exigência de um membro', () => {
  it('desligada não exige de ninguém', () => {
    expect(memberMfaRequirementOf({ ...DEFAULT_MEMBER_MFA_POLICY, everyone: true }, { roleIds: [], permissions: ['*'] })).toBeNull();
  });

  it('por perfil, por permissão efetiva, ou de todos — e o curinga do dono detém toda permissão', () => {
    const byRole = { ...enabled, roleIds: ['fiscal'] };
    expect(memberMfaRequirementOf(byRole, { roleIds: ['fiscal'], permissions: [] })).toEqual({ maxAgeSeconds: 480 * 60 });
    expect(memberMfaRequirementOf(byRole, { roleIds: ['outro'], permissions: ['*'] })).toBeNull();

    const byPermission = { ...enabled, permissions: ['dte.issue'] };
    expect(memberMfaRequirementOf(byPermission, { roleIds: [], permissions: ['dte.read', 'dte.issue'] })).not.toBeNull();
    expect(memberMfaRequirementOf(byPermission, { roleIds: [], permissions: ['*'] })).not.toBeNull();
    expect(memberMfaRequirementOf(byPermission, { roleIds: [], permissions: ['dte.read'] })).toBeNull();

    expect(memberMfaRequirementOf({ ...enabled, everyone: true }, { roleIds: [], permissions: [] })).not.toBeNull();
  });

  it('o documento de membro só vale com um intervalo dentro da faixa', () => {
    expect(memberMfaRequirementFrom({ maxAgeSeconds: 3600 })).toEqual({ maxAgeSeconds: 3600 });
    expect(memberMfaRequirementFrom(null)).toBeNull();
    expect(memberMfaRequirementFrom({ maxAgeSeconds: '3600' })).toBeNull();
  });
});

describe('a sessão', () => {
  const requirement = { maxAgeSeconds: 600 };

  it('lê a claim que o servidor pôs no token, e só um número positivo', () => {
    expect(mfaVerifiedAtOf({ [MFA_SESSION_CLAIM]: 1700000000 })).toBe(1700000000);
    expect(mfaVerifiedAtOf({ [MFA_SESSION_CLAIM]: '1700000000' })).toBeNull();
    expect(mfaVerifiedAtOf({})).toBeNull();
    expect(mfaVerifiedAtOf(undefined)).toBeNull();
  });

  it('ler exige ter provado; agir exige ter provado há menos que o intervalo — a mesma conta das regras', () => {
    expect(mfaSessionIssue(null, null, 1000, true)).toBeNull();
    expect(mfaSessionIssue(requirement, null, 1000, false)).toBe('missing');
    expect(mfaSessionIssue(requirement, 100, 1000, false)).toBeNull();
    expect(mfaSessionIssue(requirement, 500, 1000, true)).toBeNull();
    expect(mfaSessionIssue(requirement, 400, 1000, true)).toBe('expired');
    expect(mfaSessionExpiresAt(requirement, 400)).toBe(1000);
    expect(mfaSessionExpiresAt(null, 400)).toBeNull();
  });
});

describe('o que a pessoa digita', () => {
  it('seis dígitos, com espaço tolerado', () => {
    expect(totpCodeOf('123 456')).toBe('123456');
    expect(totpCodeOf('12345')).toBeNull();
    expect(totpCodeOf('abcdef')).toBeNull();
  });

  it('o código de recuperação em qualquer caixa e com ou sem hífen; fora do alfabeto, não', () => {
    expect(recoveryCodeOf('ABCDE-FGHJK')).toBe('abcdefghjk');
    expect(recoveryCodeOf('abcdefghjk')).toBe('abcdefghjk');
    expect(recoveryCodeOf('abcde-fghi1')).toBeNull();
    expect(recoveryCodeOf('abc')).toBeNull();
  });

  it('o emissor no aplicativo nunca leva ":" e nunca fica vazio', () => {
    expect(mfaIssuerOf('app:exemplo.gov.br')).toBe('app exemplo.gov.br');
    expect(mfaIssuerOf('')).toBe('Microteia');
  });
});
