import type { IMfaFactorRepository, MfaFactor, MfaFactorChange } from '../repositories/IMfaFactorRepository';
import { emptyMfaFactor } from '../repositories/IMfaFactorRepository';
import type { IMemberMfaPolicyRepository, IMfaSessionMinter } from '../repositories/IMemberMfaPolicyRepository';
import type { ITenantMemberRepository, MemberAccess } from '../repositories/ITenantMemberRepository';
import type { CreateAuditLogInput, CreateAuditLogUseCase } from './CreateAuditLogUseCase';
import type {
  MemberMfaEntry,
  MemberMfaOverview,
  MemberMfaPolicy,
  SecondFactorEnrollment,
  SecondFactorSession,
  SecondFactorStatus,
} from '../schema/memberMfa';
import {
  MFA_AUDIT_ENTITY,
  MFA_ENROLLMENT_TTL_SECONDS,
  MFA_LOCK_SECONDS,
  MFA_MAX_FAILURES,
  MFA_SECRET_BYTES,
  MFA_STEP_UP_SECONDS,
  formatRecoveryCode,
  memberMfaPolicyIssue,
  memberMfaPolicyOf,
  memberMfaRequirementOf,
  mfaIssuerOf,
  mfaSessionIssue,
  otpauthUri,
  recoveryCodeOf,
  totpCodeOf,
} from '../schema/memberMfa';
import type { HmacSha1, RandomBytes } from '../services/totp';
import { base32Decode, base32Encode, generateRecoveryCodes, verifyTotp } from '../services/totp';
import { failedPrecondition, invalidArgument, notFound, permissionDenied } from '../errors/DomainError';

export interface MfaActor {
  userId: string;
  userName: string;
  photoURL: string;
}

/**
 * Quem, entre estas contas, é o administrador global (`SYSTEM`). A política do escritório não o alcança
 * — as regras e as callables o dispensam na hora da pergunta —, e a tela não pode dizer o contrário.
 */
export type SystemAccountsOf = (userIds: string[]) => Promise<Set<string>>;

export interface SecondFactorDeps {
  factors: IMfaFactorRepository;
  members: Pick<ITenantMemberRepository, 'getMemberAccess'>;
  systemAccounts: SystemAccountsOf;
  sessions: IMfaSessionMinter;
  hmac: HmacSha1;
  random: RandomBytes;
  sha256: (text: string) => string;
  now: () => Date;
  audit: CreateAuditLogUseCase;
  logger: { error: (message: string) => void };
}

interface MemberContext {
  tenantId: string;
  actor: MfaActor;
}

export interface SecondFactorUseCase {
  status(input: { tenantId: string; userId: string }): Promise<SecondFactorStatus>;
  enroll(input: MemberContext & { account: string; issuer: unknown; sessionVerifiedAt: number | null }): Promise<SecondFactorEnrollment>;
  confirm(input: MemberContext & { code: unknown }): Promise<SecondFactorSession>;
  verify(input: MemberContext & { code: unknown }): Promise<SecondFactorSession>;
  regenerateRecoveryCodes(input: MemberContext & { sessionVerifiedAt: number | null }): Promise<{ recoveryCodes: string[] }>;
}

type Attempt =
  | { kind: 'ok'; step: number | null; recovery: boolean; codesLeft: number; codes?: string[]; replaced?: boolean }
  | { kind: 'invalid'; attemptsLeft: number; lockedNow: boolean }
  | { kind: 'locked'; until: Date }
  | { kind: 'not-enrolled' }
  | { kind: 'enrollment-expired' };

const seconds = (date: Date): number => Math.floor(date.getTime() / 1000);

const isLocked = (factor: MfaFactor, now: Date): boolean =>
  factor.lockedUntil !== null && factor.lockedUntil.getTime() > now.getTime();

/**
 * A falha conta no MESMO documento e na mesma transação da tentativa — e ao travar o contador volta a
 * zero, para que a próxima janela comece inteira.
 */
const failed = (factor: MfaFactor, now: Date): MfaFactorChange<Attempt> => {
  const failures = factor.failures + 1;
  if (failures >= MFA_MAX_FAILURES) {
    return {
      next: { ...factor, failures: 0, lockedUntil: new Date(now.getTime() + MFA_LOCK_SECONDS * 1000) },
      result: { kind: 'invalid', attemptsLeft: 0, lockedNow: true },
    };
  }
  return { next: { ...factor, failures }, result: { kind: 'invalid', attemptsLeft: MFA_MAX_FAILURES - failures, lockedNow: false } };
};

/**
 * Cada linha da Auditoria por extenso, e não montada a partir de um pedaço: uma referência composta em
 * tempo de execução é invisível para o `verify-messages`, e a chave que faltasse apareceria crua na tela.
 */
const AUDIT_MESSAGES = {
  enrolled: { title: '@core.access/mfa.audit.enrolled.title', text: '@core.access/mfa.audit.enrolled.text' },
  replaced: { title: '@core.access/mfa.audit.replaced.title', text: '@core.access/mfa.audit.replaced.text' },
  verified: { title: '@core.access/mfa.audit.verified.title', text: '@core.access/mfa.audit.verified.text' },
  'recovery-used': { title: '@core.access/mfa.audit.recovery-used.title', text: '@core.access/mfa.audit.recovery-used.text' },
  'recovery-regenerated': {
    title: '@core.access/mfa.audit.recovery-regenerated.title',
    text: '@core.access/mfa.audit.recovery-regenerated.text',
  },
  locked: { title: '@core.access/mfa.audit.locked.title', text: '@core.access/mfa.audit.locked.text' },
  reset: { title: '@core.access/mfa.audit.reset.title', text: '@core.access/mfa.audit.reset.text' },
  'policy-enabled': { title: '@core.access/mfa.audit.policy-enabled.title', text: '@core.access/mfa.audit.policy-enabled.text' },
  'policy-enabled-everyone': {
    title: '@core.access/mfa.audit.policy-enabled.title',
    text: '@core.access/mfa.audit.policy-enabled.everyone.text',
  },
  'policy-disabled': { title: '@core.access/mfa.audit.policy-disabled.title', text: '@core.access/mfa.audit.policy-disabled.text' },
  'policy-changed': { title: '@core.access/mfa.audit.policy-changed.title', text: '@core.access/mfa.audit.policy-changed.text' },
  'policy-changed-everyone': {
    title: '@core.access/mfa.audit.policy-changed.title',
    text: '@core.access/mfa.audit.policy-changed.everyone.text',
  },
} as const;

type AuditMessage = keyof typeof AUDIT_MESSAGES;

const auditLine = (
  tenantId: string,
  actor: MfaActor,
  entityId: string,
  message: AuditMessage,
  severity: CreateAuditLogInput['severity'],
  textParams?: Record<string, string>,
): CreateAuditLogInput => ({
  tenantId,
  ...actor,
  action: 'UPDATE',
  type: 'AUDIT',
  entity: MFA_AUDIT_ENTITY,
  entityId,
  severity,
  ...AUDIT_MESSAGES[message],
  ...(textParams ? { textParams } : {}),
});

/**
 * A porta da PESSOA para o próprio segundo fator: cadastrar, confirmar, provar e renovar os códigos de
 * recuperação. Ela não pede permissão nenhuma — é justamente por onde passa quem ainda não pode nada —,
 * e por isso tudo aqui exige só PERTENCER ao escritório, que é onde a prova será usada e auditada.
 */
export const makeSecondFactorUseCase = (deps: SecondFactorDeps): SecondFactorUseCase => {
  const memberOf = async (tenantId: string, userId: string): Promise<MemberAccess> => {
    const access = await deps.members.getMemberAccess(tenantId, userId);
    if (!access) throw permissionDenied('@core.access/mfa.not-a-member');
    return access;
  };

  const hashOf = (userId: string, code: string): string => deps.sha256(`${userId}:${code}`);

  const requireStepUp = (sessionVerifiedAt: number | null): void => {
    const issue = mfaSessionIssue({ maxAgeSeconds: MFA_STEP_UP_SECONDS }, sessionVerifiedAt, seconds(deps.now()), true);
    if (issue) throw failedPrecondition('@core.access/mfa.step-up-required');
  };

  const refuse = async (tenantId: string, actor: MfaActor, attempt: Exclude<Attempt, { kind: 'ok' }>): Promise<never> => {
    if (attempt.kind === 'not-enrolled') throw failedPrecondition('@core.access/mfa.not-enrolled');
    if (attempt.kind === 'enrollment-expired') throw failedPrecondition('@core.access/mfa.enrollment.expired');
    if (attempt.kind === 'locked') {
      throw failedPrecondition('@core.access/mfa.locked', { until: attempt.until.toISOString() });
    }
    if (attempt.lockedNow) {
      await deps.audit.execute(auditLine(tenantId, actor, actor.userId, 'locked', 'HIGH', { minutes: String(MFA_LOCK_SECONDS / 60) }));
      throw failedPrecondition('@core.access/mfa.locked', {
        until: new Date(deps.now().getTime() + MFA_LOCK_SECONDS * 1000).toISOString(),
      });
    }
    throw invalidArgument('@core.access/mfa.code.invalid', { attempts: String(attempt.attemptsLeft) });
  };

  /**
   * A sessão é assinada ANTES de qualquer gravação. Assinada depois, a instalação sem
   * `iam.serviceAccounts.signBlob` confirmava o fator, sorteava os códigos e só então falhava: a pessoa
   * via "tente de novo", nunca via os códigos, e o fator ficava cadastrado com um aplicativo que ela já
   * tinha apagado. O token que sobra de uma tentativa recusada nunca sai daqui.
   */
  const signSession = async (userId: string, verifiedAt: Date): Promise<string> => {
    try {
      return await deps.sessions.mint(userId, seconds(verifiedAt));
    } catch (cause) {
      deps.logger.error(`session signing failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      throw failedPrecondition('@core.access/mfa.signing.unavailable');
    }
  };

  const sessionFor = (token: string, attempt: Extract<Attempt, { kind: 'ok' }>, verifiedAt: Date): SecondFactorSession => {
    const at = seconds(verifiedAt);
    return {
      token,
      verifiedAt: at,
      recoveryCodesLeft: attempt.codesLeft,
      usedRecoveryCode: attempt.recovery,
      ...(attempt.codes ? { recoveryCodes: attempt.codes.map(formatRecoveryCode) } : {}),
    };
  };

  return {
    status: async ({ tenantId, userId }) => {
      const [access, factor] = await Promise.all([memberOf(tenantId, userId), deps.factors.get(userId)]);
      const requirement = access.mfa && !(await deps.systemAccounts([userId])).has(userId) ? access.mfa : null;
      const now = deps.now();
      return {
        required: requirement !== null,
        reverifyMinutes: requirement ? requirement.maxAgeSeconds / 60 : null,
        enrolled: factor?.secret != null,
        enrolledAt: factor?.enrolledAt?.toISOString() ?? null,
        recoveryCodesLeft: factor?.secret ? factor.recoveryCodes.length : 0,
        lockedUntil: factor && isLocked(factor, now) ? factor.lockedUntil!.toISOString() : null,
      };
    },

    enroll: async ({ tenantId, actor, account, issuer, sessionVerifiedAt }) => {
      await memberOf(tenantId, actor.userId);
      const current = await deps.factors.get(actor.userId);
      // Trocar o aplicativo de quem JÁ tem um exige a prova recente: senão bastaria a senha para pôr o
      // próprio celular no lugar do da vítima. O primeiro cadastro não tem o que provar.
      if (current?.secret) requireStepUp(sessionVerifiedAt);
      // Sem poder assinar a sessão, a confirmação nunca terminaria — e o QR já estaria no aplicativo.
      await signSession(actor.userId, deps.now());

      const secret = base32Encode(deps.random(MFA_SECRET_BYTES));
      const expiresAt = new Date(deps.now().getTime() + MFA_ENROLLMENT_TTL_SECONDS * 1000);
      await deps.factors.update(actor.userId, (stored) => ({
        next: { ...(stored ?? emptyMfaFactor()), pending: { secret, expiresAt } },
        result: undefined,
      }));
      return { secret, uri: otpauthUri(mfaIssuerOf(issuer), account, secret), expiresAt: expiresAt.toISOString() };
    },

    confirm: async ({ tenantId, actor, code }) => {
      await memberOf(tenantId, actor.userId);
      const totp = totpCodeOf(code);
      if (!totp) throw invalidArgument('@core.access/mfa.code.format');
      const now = deps.now();
      const token = await signSession(actor.userId, now);

      const attempt = await deps.factors.update<Attempt>(actor.userId, (stored) => {
        if (!stored?.pending || stored.pending.expiresAt.getTime() <= now.getTime()) {
          return { result: { kind: 'enrollment-expired' } };
        }
        if (isLocked(stored, now)) return { result: { kind: 'locked', until: stored.lockedUntil! } };
        const step = verifyTotp(base32Decode(stored.pending.secret), totp, seconds(now), null, deps.hmac);
        if (step === null) return failed(stored, now);

        const codes = generateRecoveryCodes(deps.random);
        return {
          next: {
            secret: stored.pending.secret,
            enrolledAt: now,
            pending: null,
            recoveryCodes: codes.map((item) => hashOf(actor.userId, item)),
            lastStep: step,
            failures: 0,
            lockedUntil: null,
            lastVerifiedAt: now,
          },
          result: { kind: 'ok', step, recovery: false, codesLeft: codes.length, codes, replaced: stored.secret !== null },
        };
      });

      if (attempt.kind !== 'ok') return refuse(tenantId, actor, attempt);
      await deps.audit.execute(auditLine(tenantId, actor, actor.userId, attempt.replaced ? 'replaced' : 'enrolled', attempt.replaced ? 'HIGH' : 'LOW'));
      return sessionFor(token, attempt, now);
    },

    verify: async ({ tenantId, actor, code }) => {
      await memberOf(tenantId, actor.userId);
      const totp = totpCodeOf(code);
      const recovery = totp ? null : recoveryCodeOf(code);
      if (!totp && !recovery) throw invalidArgument('@core.access/mfa.code.format');
      const now = deps.now();
      const token = await signSession(actor.userId, now);

      const attempt = await deps.factors.update<Attempt>(actor.userId, (stored) => {
        if (!stored?.secret) return { result: { kind: 'not-enrolled' } };
        if (isLocked(stored, now)) return { result: { kind: 'locked', until: stored.lockedUntil! } };
        const settled = { failures: 0, lockedUntil: null, lastVerifiedAt: now };

        if (totp) {
          const step = verifyTotp(base32Decode(stored.secret), totp, seconds(now), stored.lastStep, deps.hmac);
          if (step === null) return failed(stored, now);
          return {
            next: { ...stored, ...settled, lastStep: step },
            result: { kind: 'ok', step, recovery: false, codesLeft: stored.recoveryCodes.length },
          };
        }

        const hash = hashOf(actor.userId, recovery!);
        if (!stored.recoveryCodes.includes(hash)) return failed(stored, now);
        const recoveryCodes = stored.recoveryCodes.filter((item) => item !== hash);
        return {
          next: { ...stored, ...settled, recoveryCodes },
          result: { kind: 'ok', step: null, recovery: true, codesLeft: recoveryCodes.length },
        };
      });

      if (attempt.kind !== 'ok') return refuse(tenantId, actor, attempt);
      await deps.audit.execute(attempt.recovery
        ? auditLine(tenantId, actor, actor.userId, 'recovery-used', 'HIGH', { left: String(attempt.codesLeft) })
        : auditLine(tenantId, actor, actor.userId, 'verified', 'LOW'));
      return sessionFor(token, attempt, now);
    },

    regenerateRecoveryCodes: async ({ tenantId, actor, sessionVerifiedAt }) => {
      await memberOf(tenantId, actor.userId);
      requireStepUp(sessionVerifiedAt);
      const codes = generateRecoveryCodes(deps.random);
      const enrolled = await deps.factors.update(actor.userId, (stored) => (stored?.secret
        ? { next: { ...stored, recoveryCodes: codes.map((item) => hashOf(actor.userId, item)) }, result: true }
        : { result: false }));
      if (!enrolled) throw failedPrecondition('@core.access/mfa.not-enrolled');
      await deps.audit.execute(auditLine(tenantId, actor, actor.userId, 'recovery-regenerated', 'LOW'));
      return { recoveryCodes: codes.map(formatRecoveryCode) };
    },
  };
};

export interface ManageMemberMfaDeps {
  policies: IMemberMfaPolicyRepository;
  factors: IMfaFactorRepository;
  members: Pick<ITenantMemberRepository, 'getMemberAccess' | 'listMemberAccess'>;
  systemAccounts: SystemAccountsOf;
  /** Os escritórios de que a pessoa participa — `users/{uid}.tenantIds`. */
  tenantIdsOf: (userId: string) => Promise<string[]>;
  roleNames: (tenantId: string, roleIds: string[]) => Promise<string[]>;
  /** Recalcula `members/{uid}.mfa` do escritório inteiro, na mesma rotina das permissões. */
  materialize: (tenantId: string) => Promise<unknown>;
  now: () => Date;
  audit: CreateAuditLogUseCase;
}

export interface ManageMemberMfaUseCase {
  overview(tenantId: string): Promise<MemberMfaOverview>;
  save(input: {
    tenantId: string;
    actor: MfaActor;
    /** `null` para o administrador global, que não é alcançado por política de escritório. */
    actorAccess: MemberAccess | null;
    actorVerifiedAt: number | null;
    policy: unknown;
  }): Promise<MemberMfaOverview>;
  reset(input: { tenantId: string; actor: MfaActor; actorIsSystem: boolean; userId: unknown }): Promise<MemberMfaOverview>;
}

const narrowed = (before: MemberMfaPolicy, after: MemberMfaPolicy): boolean =>
  (before.everyone && !after.everyone)
  || before.roleIds.some((roleId) => !after.roleIds.includes(roleId))
  || before.permissions.some((permission) => !after.permissions.includes(permission))
  || after.reverifyMinutes > before.reverifyMinutes;

const samePolicy = (a: MemberMfaPolicy, b: MemberMfaPolicy): boolean =>
  a.enabled === b.enabled
  && a.everyone === b.everyone
  && a.reverifyMinutes === b.reverifyMinutes
  && a.roleIds.join('\n') === b.roleIds.join('\n')
  && a.permissions.join('\n') === b.permissions.join('\n');

/**
 * O que a mudança de política deixa na Auditoria. A severidade é a do que ela TIRA, como na retenção:
 * desligar é `CRITICAL` (aparece no badge de todo leitor); estreitar quem precisa, ou alargar o
 * intervalo, é `HIGH`; ligar e apertar são `LOW`.
 */
export const memberMfaPolicyChangeLogs = (
  tenantId: string,
  actor: MfaActor,
  before: MemberMfaPolicy,
  after: MemberMfaPolicy,
  roleNames: string[],
): CreateAuditLogInput[] => {
  if (samePolicy(before, after) || (!before.enabled && !after.enabled)) return [];
  if (!after.enabled) return [auditLine(tenantId, actor, tenantId, 'policy-disabled', 'CRITICAL')];
  const scope: Record<string, string> = after.everyone
    ? { minutes: String(after.reverifyMinutes) }
    : {
      roles: roleNames.join(', ') || '—',
      permissions: after.permissions.join(', ') || '—',
      minutes: String(after.reverifyMinutes),
    };
  // Quem a política alcança muda a FRASE, e não um parâmetro: "todos" dentro de uma frase seria uma
  // palavra nossa gravada no log, fora do alcance da tradução.
  const message: AuditMessage = before.enabled
    ? (after.everyone ? 'policy-changed-everyone' : 'policy-changed')
    : (after.everyone ? 'policy-enabled-everyone' : 'policy-enabled');
  const severity = before.enabled && narrowed(before, after) ? 'HIGH' : 'LOW';
  return [auditLine(tenantId, actor, tenantId, message, severity, scope)];
};

/**
 * A porta do ESCRITÓRIO: a política e quem já cadastrou o fator. A permissão (`mfa.manage`) é cobrada
 * pela callable; aqui mora o que vale para qualquer chamador — inclusive as duas travas que impedem
 * alguém de trancar o escritório por engano ou de abrir o fator de outra pessoa.
 */
export const makeManageMemberMfaUseCase = (deps: ManageMemberMfaDeps): ManageMemberMfaUseCase => {
  const overview = async (tenantId: string): Promise<MemberMfaOverview> => {
    const [policy, members] = await Promise.all([deps.policies.get(tenantId), deps.members.listMemberAccess(tenantId)]);
    const [factors, system] = await Promise.all([
      deps.factors.getMany(members.map((member) => member.userId)),
      deps.systemAccounts(members.filter((member) => member.mfa !== null).map((member) => member.userId)),
    ]);
    const entries: MemberMfaEntry[] = members.map((member) => {
      const factor = factors.get(member.userId);
      return {
        userId: member.userId,
        displayName: member.displayName,
        email: member.email,
        required: member.mfa !== null && !system.has(member.userId),
        enrolled: factor?.secret != null,
        enrolledAt: factor?.secret ? factor.enrolledAt?.toISOString() ?? null : null,
        lastVerifiedAt: factor?.secret ? factor.lastVerifiedAt?.toISOString() ?? null : null,
      };
    });
    entries.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    return { policy, members: entries };
  };

  return {
    overview,

    save: async ({ tenantId, actor, actorAccess, actorVerifiedAt, policy: raw }) => {
      const issue = memberMfaPolicyIssue(raw);
      if (issue) throw invalidArgument(issue);
      const next = memberMfaPolicyOf(raw);

      // A trava contra trancar a si mesmo: quem liga uma política que o alcança precisa ter provado o
      // fator NESTA sessão. Prova junto que o servidor consegue abrir a sessão — sem a permissão de
      // assinar (`createCustomToken`), ninguém mais entraria, e quem ligou seria o primeiro a saber.
      const requirement = actorAccess ? memberMfaRequirementOf(next, actorAccess) : null;
      if (mfaSessionIssue(requirement, actorVerifiedAt, seconds(deps.now()), true)) {
        throw failedPrecondition('@core.access/mfa.policy.verify-first');
      }

      const before = await deps.policies.get(tenantId);
      await deps.policies.save(tenantId, next, actor.userId);
      await deps.materialize(tenantId);
      const names = next.roleIds.length > 0 ? await deps.roleNames(tenantId, next.roleIds) : [];
      for (const log of memberMfaPolicyChangeLogs(tenantId, actor, before, next, names)) await deps.audit.execute(log);
      return overview(tenantId);
    },

    reset: async ({ tenantId, actor, actorIsSystem, userId }) => {
      if (typeof userId !== 'string' || userId === '') throw invalidArgument('@core.access/mfa.member.not-found');
      const target = await deps.members.getMemberAccess(tenantId, userId);
      if (!target) throw notFound('@core.access/mfa.member.not-found');

      // O fator é da PESSOA e vale em todo escritório dela. Apagá-lo daqui abriria a porta dela num
      // escritório que este administrador não administra — quem tem a senha cadastraria o próprio
      // celular. Só o administrador da instalação responde por quem está em mais de um.
      if (!actorIsSystem) {
        const elsewhere = (await deps.tenantIdsOf(userId)).some((id) => id !== tenantId);
        if (elsewhere) throw failedPrecondition('@core.access/mfa.reset.other-organizations');
      }

      if (await deps.factors.remove(userId)) {
        await deps.audit.execute(auditLine(tenantId, actor, userId, 'reset', 'HIGH', {
          member: target.displayName || target.email || userId,
        }));
      }
      return overview(tenantId);
    },
  };
};
