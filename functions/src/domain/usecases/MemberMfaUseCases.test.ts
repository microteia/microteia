import { createHash, createHmac, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeManageMemberMfaUseCase, makeSecondFactorUseCase, memberMfaPolicyChangeLogs } from './MemberMfaUseCases';
import type { MfaActor } from './MemberMfaUseCases';
import type { CreateAuditLogInput } from './CreateAuditLogUseCase';
import type { MemberAccess } from '../repositories/ITenantMemberRepository';
import { FakeMemberMfaPolicyRepository, FakeMfaFactorRepository, FakeMfaSessionMinter } from '../repositories/fakeMfa';
import { base32Decode, hotp, totpStep } from '../services/totp';
import { DomainError } from '../errors/DomainError';
import {
  DEFAULT_MEMBER_MFA_POLICY,
  MFA_ENROLLMENT_TTL_SECONDS,
  MFA_LOCK_SECONDS,
  MFA_MAX_FAILURES,
  MFA_STEP_UP_SECONDS,
} from '../schema/memberMfa';
import type { MemberMfaPolicy } from '../schema/memberMfa';

const hmac = (key: Uint8Array, message: Uint8Array): Uint8Array =>
  new Uint8Array(createHmac('sha1', key).update(message).digest());
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const random = (size: number): Uint8Array => new Uint8Array(randomBytes(size));

const ANA: MfaActor = { userId: 'ana', userName: 'Ana', photoURL: '' };

const member = (userId: string, extra: Partial<MemberAccess> = {}): MemberAccess => ({
  userId,
  displayName: userId,
  email: `${userId}@x.com`,
  roleIds: [],
  permissions: [],
  mfa: null,
  ...extra,
});

const refusal = async (promise: Promise<unknown>): Promise<DomainError> => {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('esperava recusa, e a chamada passou');
};

const setup = () => {
  const clock = { now: new Date('2026-10-26T12:00:00Z') };
  const factors = new FakeMfaFactorRepository();
  const policies = new FakeMemberMfaPolicyRepository();
  const sessions = new FakeMfaSessionMinter();
  const members = new Map<string, MemberAccess>([['t1:ana', member('ana')], ['t1:bia', member('bia')]]);
  const logs: CreateAuditLogInput[] = [];
  const audit = { execute: vi.fn(async (input: CreateAuditLogInput) => { logs.push(input); }) };
  const memberRepo = {
    getMemberAccess: async (tenantId: string, userId: string) => members.get(`${tenantId}:${userId}`) ?? null,
    listMemberAccess: async (tenantId: string) =>
      [...members.entries()].filter(([key]) => key.startsWith(`${tenantId}:`)).map(([, value]) => value),
  };
  const now = () => clock.now;
  const self = makeSecondFactorUseCase({ factors, members: memberRepo, sessions, hmac, random, sha256, now, audit });
  const tenantIds = new Map<string, string[]>([['ana', ['t1']], ['bia', ['t1', 't2']]]);
  const materialize = vi.fn(async () => 0);
  const manage = makeManageMemberMfaUseCase({
    policies,
    factors,
    members: memberRepo,
    tenantIdsOf: async (userId) => tenantIds.get(userId) ?? [],
    roleNames: async (_tenantId, ids) => ids.map((id) => `Role ${id}`),
    materialize,
    now,
    audit,
  });
  const seconds = () => Math.floor(clock.now.getTime() / 1000);
  const codeFor = (secret: string, offset = 0) => hotp(base32Decode(secret), totpStep(seconds()) + offset, hmac);
  const advance = (secondsToAdd: number) => { clock.now = new Date(clock.now.getTime() + secondsToAdd * 1000); };

  const enrolled = async () => {
    const enrollment = await self.enroll({ tenantId: 't1', actor: ANA, account: 'ana@x.com', issuer: 'app.example', sessionVerifiedAt: null });
    const session = await self.confirm({ tenantId: 't1', actor: ANA, code: codeFor(enrollment.secret) });
    advance(30);
    return { secret: enrollment.secret, session };
  };

  return { clock, factors, policies, sessions, members, logs, self, manage, materialize, tenantIds, seconds, codeFor, advance, enrolled };
};

describe('SecondFactorUseCase', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => { s = setup(); });

  it('recusa quem não é membro do escritório', async () => {
    const error = await refusal(s.self.status({ tenantId: 't1', userId: 'intruso' }));
    expect(error.code).toBe('permission-denied');
  });

  it('cadastra: o segredo vai na URI otpauth, e o primeiro código confere, abre a sessão e devolve os códigos', async () => {
    const enrollment = await s.self.enroll({ tenantId: 't1', actor: ANA, account: 'ana@x.com', issuer: 'app.example', sessionVerifiedAt: null });
    expect(enrollment.uri).toBe(`otpauth://totp/app.example:ana%40x.com?secret=${enrollment.secret}&issuer=app.example&algorithm=SHA1&digits=6&period=30`);
    expect((await s.self.status({ tenantId: 't1', userId: 'ana' })).enrolled).toBe(false);

    const session = await s.self.confirm({ tenantId: 't1', actor: ANA, code: s.codeFor(enrollment.secret) });

    expect(session.token).toBe(`token:ana:${s.seconds()}`);
    expect(session.verifiedAt).toBe(s.seconds());
    expect(session.recoveryCodes).toHaveLength(10);
    expect(session.recoveryCodes?.every((code) => /^[a-z2-9]{5}-[a-z2-9]{5}$/.test(code))).toBe(true);
    const stored = s.factors.stored.get('ana')!;
    expect(stored.secret).toBe(enrollment.secret);
    expect(stored.pending).toBeNull();
    // O código de recuperação nunca é gravado — só o hash dele.
    expect(stored.recoveryCodes.some((hash) => session.recoveryCodes!.some((code) => hash.includes(code.replace('-', ''))))).toBe(false);
    expect(s.logs.map((log) => [log.title, log.severity])).toEqual([['@core.access/mfa.audit.enrolled.title', 'LOW']]);
  });

  it('o segredo sorteado vence: confirmar depois do prazo é recusado', async () => {
    const enrollment = await s.self.enroll({ tenantId: 't1', actor: ANA, account: 'ana@x.com', issuer: '', sessionVerifiedAt: null });
    s.advance(MFA_ENROLLMENT_TTL_SECONDS + 1);
    const error = await refusal(s.self.confirm({ tenantId: 't1', actor: ANA, code: s.codeFor(enrollment.secret) }));
    expect(error.message).toBe('@core.access/mfa.enrollment.expired');
  });

  it('prova pelo código do aplicativo, e o mesmo código não serve duas vezes', async () => {
    const { secret } = await s.enrolled();
    const code = s.codeFor(secret);

    const session = await s.self.verify({ tenantId: 't1', actor: ANA, code: `${code.slice(0, 3)} ${code.slice(3)}` });
    expect(session.usedRecoveryCode).toBe(false);
    expect(s.logs.at(-1)?.title).toBe('@core.access/mfa.audit.verified.title');

    const replay = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code }));
    expect(replay.message).toBe('@core.access/mfa.code.invalid');
  });

  it('o código de recuperação vale UMA vez, em qualquer caixa, e fica na Auditoria como HIGH', async () => {
    const { session } = await s.enrolled();
    const code = session.recoveryCodes![0].toUpperCase();

    const used = await s.self.verify({ tenantId: 't1', actor: ANA, code });
    expect(used.usedRecoveryCode).toBe(true);
    expect(used.recoveryCodesLeft).toBe(9);
    expect(s.logs.at(-1)).toMatchObject({ severity: 'HIGH', title: '@core.access/mfa.audit.recovery-used.title', textParams: { left: '9' } });

    const again = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code }));
    expect(again.message).toBe('@core.access/mfa.code.invalid');
  });

  it('trava depois de tentativas erradas seguidas, audita a trava, e recusa até o código certo enquanto travado', async () => {
    const { secret } = await s.enrolled();
    for (let attempt = 1; attempt < MFA_MAX_FAILURES; attempt += 1) {
      const error = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: '000000' }));
      expect(error.params).toEqual({ attempts: String(MFA_MAX_FAILURES - attempt) });
    }
    const locked = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: '000000' }));
    expect(locked.message).toBe('@core.access/mfa.locked');
    expect(s.logs.at(-1)).toMatchObject({ severity: 'HIGH', title: '@core.access/mfa.audit.locked.title' });

    const stillLocked = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: s.codeFor(secret) }));
    expect(stillLocked.message).toBe('@core.access/mfa.locked');
    expect((await s.self.status({ tenantId: 't1', userId: 'ana' })).lockedUntil).not.toBeNull();

    s.advance(MFA_LOCK_SECONDS + 1);
    await expect(s.self.verify({ tenantId: 't1', actor: ANA, code: s.codeFor(secret) })).resolves.toMatchObject({ usedRecoveryCode: false });
  });

  it('trocar o aplicativo de quem já tem um exige prova recente; feita, o segredo antigo para de valer', async () => {
    const { secret } = await s.enrolled();
    const stale = s.seconds() - MFA_STEP_UP_SECONDS - 1;
    const refused = await refusal(s.self.enroll({ tenantId: 't1', actor: ANA, account: 'a', issuer: '', sessionVerifiedAt: stale }));
    expect(refused.message).toBe('@core.access/mfa.step-up-required');

    const next = await s.self.enroll({ tenantId: 't1', actor: ANA, account: 'a', issuer: '', sessionVerifiedAt: s.seconds() });
    // Até a confirmação, o aplicativo antigo continua valendo: quem desistiu no meio não fica sem fator.
    await expect(s.self.verify({ tenantId: 't1', actor: ANA, code: s.codeFor(secret) })).resolves.toBeDefined();
    s.advance(30);
    await s.self.confirm({ tenantId: 't1', actor: ANA, code: s.codeFor(next.secret) });
    expect(s.logs.at(-1)).toMatchObject({ severity: 'HIGH', title: '@core.access/mfa.audit.replaced.title' });

    s.advance(30);
    const old = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: s.codeFor(secret) }));
    expect(old.message).toBe('@core.access/mfa.code.invalid');
  });

  it('códigos novos exigem prova recente e aposentam os anteriores', async () => {
    const { session } = await s.enrolled();
    const refused = await refusal(s.self.regenerateRecoveryCodes({ tenantId: 't1', actor: ANA, sessionVerifiedAt: null }));
    expect(refused.message).toBe('@core.access/mfa.step-up-required');

    const { recoveryCodes } = await s.self.regenerateRecoveryCodes({ tenantId: 't1', actor: ANA, sessionVerifiedAt: s.seconds() });
    expect(recoveryCodes).toHaveLength(10);
    const old = await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: session.recoveryCodes![0] }));
    expect(old.message).toBe('@core.access/mfa.code.invalid');
    await expect(s.self.verify({ tenantId: 't1', actor: ANA, code: recoveryCodes[0] })).resolves.toMatchObject({ usedRecoveryCode: true });
  });

  it('recusa provar sem fator cadastrado, e recusa o que não é código', async () => {
    expect((await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: '123456' }))).message).toBe('@core.access/mfa.not-enrolled');
    expect((await refusal(s.self.verify({ tenantId: 't1', actor: ANA, code: 'abc' }))).message).toBe('@core.access/mfa.code.format');
  });

  it('o estado diz se o escritório exige, e de quanto em quanto tempo', async () => {
    s.members.set('t1:ana', member('ana', { mfa: { maxAgeSeconds: 3600 } }));
    await expect(s.self.status({ tenantId: 't1', userId: 'ana' })).resolves.toMatchObject({ required: true, reverifyMinutes: 60, enrolled: false });
  });
});

describe('ManageMemberMfaUseCase', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => { s = setup(); });

  const policy = (extra: Partial<MemberMfaPolicy>): MemberMfaPolicy => ({ ...DEFAULT_MEMBER_MFA_POLICY, enabled: true, ...extra });

  it('recusa a política ligada sem dizer quem precisa', async () => {
    const error = await refusal(s.manage.save({
      tenantId: 't1', actor: ANA, actorAccess: member('ana'), actorVerifiedAt: null,
      policy: { ...policy({}), everyone: false },
    }));
    expect(error.message).toBe('@core.access/mfa.policy.scope-empty');
  });

  it('quem liga uma política que o alcança precisa ter provado o fator nesta sessão', async () => {
    const actorAccess = member('ana', { permissions: ['*'] });
    const refused = await refusal(s.manage.save({
      tenantId: 't1', actor: ANA, actorAccess, actorVerifiedAt: null, policy: policy({ permissions: ['dte.issue'] }),
    }));
    expect(refused.message).toBe('@core.access/mfa.policy.verify-first');
    expect(s.materialize).not.toHaveBeenCalled();

    await s.manage.save({ tenantId: 't1', actor: ANA, actorAccess, actorVerifiedAt: s.seconds(), policy: policy({ permissions: ['dte.issue'] }) });
    expect(s.policies.stored.get('t1')?.permissions).toEqual(['dte.issue']);
    expect(s.materialize).toHaveBeenCalledWith('t1');
    expect(s.logs.at(-1)).toMatchObject({ severity: 'LOW', title: '@core.access/mfa.audit.policy-enabled.title' });
  });

  it('a política que NÃO alcança quem a grava não exige prova dele, nem do administrador global', async () => {
    await s.manage.save({ tenantId: 't1', actor: ANA, actorAccess: member('ana'), actorVerifiedAt: null, policy: policy({ roleIds: ['fiscal'] }) });
    await s.manage.save({ tenantId: 't1', actor: ANA, actorAccess: null, actorVerifiedAt: null, policy: policy({ everyone: true }) });
    expect(s.policies.stored.get('t1')?.everyone).toBe(true);
  });

  it('desligar é CRITICAL; estreitar é HIGH; apertar é LOW', () => {
    const before = policy({ roleIds: ['a', 'b'], reverifyMinutes: 60 });
    expect(memberMfaPolicyChangeLogs('t1', ANA, before, { ...before, enabled: false }, [])[0].severity).toBe('CRITICAL');
    expect(memberMfaPolicyChangeLogs('t1', ANA, before, { ...before, roleIds: ['a'] }, [])[0].severity).toBe('HIGH');
    expect(memberMfaPolicyChangeLogs('t1', ANA, before, { ...before, reverifyMinutes: 120 }, [])[0].severity).toBe('HIGH');
    expect(memberMfaPolicyChangeLogs('t1', ANA, before, { ...before, reverifyMinutes: 30, roleIds: ['a', 'b', 'c'] }, [])[0].severity).toBe('LOW');
    expect(memberMfaPolicyChangeLogs('t1', ANA, before, before, [])).toEqual([]);
  });

  it('quem a política alcança escolhe a FRASE da Auditoria, e os perfis entram pelo nome', () => {
    const off = { ...DEFAULT_MEMBER_MFA_POLICY };
    const [everyone] = memberMfaPolicyChangeLogs('t1', ANA, off, policy({ everyone: true }), []);
    expect(everyone.text).toBe('@core.access/mfa.audit.policy-enabled.everyone.text');
    expect(everyone.textParams).toEqual({ minutes: String(DEFAULT_MEMBER_MFA_POLICY.reverifyMinutes) });

    const [selected] = memberMfaPolicyChangeLogs('t1', ANA, off, policy({ roleIds: ['fiscal'], permissions: ['dte.issue'] }), ['Fiscal']);
    expect(selected.text).toBe('@core.access/mfa.audit.policy-enabled.text');
    expect(selected.textParams).toMatchObject({ roles: 'Fiscal', permissions: 'dte.issue' });
  });

  it('o administrador do escritório zera o fator de quem só é dele, e a Auditoria registra', async () => {
    await s.enrolled();
    const overview = await s.manage.reset({ tenantId: 't1', actor: { ...ANA, userId: 'admin' }, actorIsSystem: false, userId: 'ana' });
    expect(s.factors.stored.has('ana')).toBe(false);
    expect(overview.members.find((entry) => entry.userId === 'ana')?.enrolled).toBe(false);
    expect(s.logs.at(-1)).toMatchObject({ severity: 'HIGH', title: '@core.access/mfa.audit.reset.title', entityId: 'ana' });
  });

  it('não zera o fator de quem participa de OUTRO escritório — só o administrador global', async () => {
    s.factors.stored.set('bia', { ...(await s.enrolled(), s.factors.stored.get('ana')!) });
    const refused = await refusal(s.manage.reset({ tenantId: 't1', actor: ANA, actorIsSystem: false, userId: 'bia' }));
    expect(refused.message).toBe('@core.access/mfa.reset.other-organizations');
    expect(s.factors.stored.has('bia')).toBe(true);

    await s.manage.reset({ tenantId: 't1', actor: ANA, actorIsSystem: true, userId: 'bia' });
    expect(s.factors.stored.has('bia')).toBe(false);
  });

  it('a visão geral lista os membros com quem precisa e quem já cadastrou', async () => {
    await s.enrolled();
    s.members.set('t1:bia', member('bia', { mfa: { maxAgeSeconds: 600 } }));
    const { members } = await s.manage.overview('t1');
    expect(members.map((entry) => [entry.userId, entry.required, entry.enrolled])).toEqual([['ana', false, true], ['bia', true, false]]);
  });
});
