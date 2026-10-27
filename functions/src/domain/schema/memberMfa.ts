// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/memberMfa.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import { grantsAny } from './access/memberPermissions';

/**
 * SEGUNDO FATOR DE MEMBRO (EV-07).
 *
 * Três decisões organizam o resto, e cada uma tem o seu porquê:
 *
 * 1. **O fator é da PESSOA; a exigência é do ESCRITÓRIO.** O aplicativo autenticador está no bolso de
 *    alguém, e vale para todo escritório de que ela participa (`mfaFactors/{uid}`). Quem decide se ela
 *    precisa dele para entrar num escritório é a política daquele escritório
 *    (`memberMfaPolicies/{tenantId}`), por perfil ou por permissão.
 * 2. **A prova é da SESSÃO, e não da conta.** Conferido o código, o servidor abre uma sessão nova
 *    (`createCustomToken`) com a claim `MFA_SESSION_CLAIM` = o instante da verificação. Claim de usuário
 *    (`setCustomUserClaims`) valeria para TODAS as sessões dele, inclusive a de quem só roubou a senha —
 *    e é exatamente essa que o segundo fator existe para barrar. A claim de sessão não tem nenhuma das
 *    restrições que tiraram as custom claims do RBAC: é um número só, e só a sessão que provou o fator
 *    o carrega.
 * 3. **A exigência é MATERIALIZADA no documento de membro** (`members/{uid}.mfa`), pela mesma rotina que
 *    materializa as permissões — e pelo mesmo motivo: as Security Rules já leem aquele documento, então
 *    a pergunta custa zero leituras a mais. Sem o campo, nada muda: é o que mantém intacto quem nunca
 *    ligou a política.
 *
 * Entrar e agir são perguntas diferentes (`mfaSessionIssue`): para LER basta a sessão ter provado o
 * fator; para GRAVAR, ou chamar uma callable, a prova precisa ser mais recente que `reverifyMinutes`. É o
 * que permite pedir o código de novo sem derrubar a tela de quem está trabalhando — as assinaturas de
 * leitura continuam vivas enquanto a pessoa confirma.
 */

export const MEMBER_MFA_POLICY_COLLECTION = 'memberMfaPolicies';

export const MFA_FACTOR_COLLECTION = 'mfaFactors';

/** Segundos desde a época, gravados na sessão pelo servidor. O `firestore.rules` lê o mesmo nome. */
export const MFA_SESSION_CLAIM = 'mfaAt';

/** A entidade das linhas de Auditoria do segundo fator. */
export const MFA_AUDIT_ENTITY = 'memberMfa';

export const MFA_REVERIFY_MIN_MINUTES = 5;

/** Uma semana. Além disso a exigência deixa de ser "de novo de tempos em tempos" e vira "uma vez". */
export const MFA_REVERIFY_MAX_MINUTES = 10080;

/** Um expediente. */
export const DEFAULT_MFA_REVERIFY_MINUTES = 480;

/** Perfis e permissões numa política. Acima disso a política não está escolhendo, está listando tudo. */
export const MFA_POLICY_LIST_MAX = 100;

export const TOTP_DIGITS = 6;

export const TOTP_PERIOD_SECONDS = 30;

/** Um passo para cada lado: o relógio do celular de alguém sempre está um pouco adiantado ou atrasado. */
export const TOTP_SKEW_STEPS = 1;

/** 160 bits, o tamanho que a RFC 4226 recomenda para o segredo do HMAC-SHA1. */
export const MFA_SECRET_BYTES = 20;

/** Quanto tempo o segredo sorteado espera pela confirmação antes de ser descartado. */
export const MFA_ENROLLMENT_TTL_SECONDS = 600;

/**
 * Quão recente a prova precisa ser para MEXER no próprio fator — trocar o aplicativo, sortear códigos
 * novos. É independente do `reverifyMinutes` do escritório: quem deixou a sessão aberta numa mesa não
 * pode, por isso, trocar o celular que recebe o código.
 */
export const MFA_STEP_UP_SECONDS = 900;

/** Tentativas erradas seguidas antes de o fator travar — o código tem só seis dígitos. */
export const MFA_MAX_FAILURES = 5;

export const MFA_LOCK_SECONDS = 900;

export const RECOVERY_CODE_COUNT = 10;

/** Sem `0/o`, `1/l/i`: o código é lido de um papel e digitado. */
export const RECOVERY_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export const RECOVERY_CODE_LENGTH = 10;

export interface MemberMfaPolicy {
  enabled: boolean;
  /** Todo membro, independente de perfil ou permissão. */
  everyone: boolean;
  /** Quem tem UM destes perfis. */
  roleIds: string[];
  /** Quem detém UMA destas permissões, inclusive por dependência — é o conjunto EFETIVO que se olha. */
  permissions: string[];
  reverifyMinutes: number;
}

export const DEFAULT_MEMBER_MFA_POLICY: MemberMfaPolicy = {
  enabled: false,
  everyone: false,
  roleIds: [],
  permissions: [],
  reverifyMinutes: DEFAULT_MFA_REVERIFY_MINUTES,
};

/** O que o documento de membro carrega quando a política o alcança. Ausente = não exigido. */
export interface MemberMfaRequirement {
  maxAgeSeconds: number;
}

const recordOf = (value: unknown): Record<string, unknown> =>
  (typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

const isIntegerBetween = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

export const isMfaReverifyMinutes = (value: unknown): value is number =>
  isIntegerBetween(value, MFA_REVERIFY_MIN_MINUTES, MFA_REVERIFY_MAX_MINUTES);

const identifiersOf = (value: unknown): string[] =>
  (Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== ''))].sort()
    : []);

/**
 * A política a partir do que está gravado. TOLERANTE no que é forma, e fechada no que é exigência: um
 * documento ilegível vira "desligada" só quando `enabled` não é `true`; ligada e malformada, ela vale
 * para TODOS — exigir de mais trava a porta; exigir de menos a deixa aberta.
 */
export const memberMfaPolicyOf = (raw: unknown): MemberMfaPolicy => {
  const stored = recordOf(raw);
  const enabled = stored.enabled === true;
  const roleIds = identifiersOf(stored.roleIds);
  const permissions = identifiersOf(stored.permissions);
  const scoped = stored.everyone === true || roleIds.length > 0 || permissions.length > 0;
  return {
    enabled,
    everyone: stored.everyone === true || (enabled && !scoped),
    roleIds,
    permissions,
    reverifyMinutes: isMfaReverifyMinutes(stored.reverifyMinutes) ? stored.reverifyMinutes : DEFAULT_MFA_REVERIFY_MINUTES,
  };
};

const isIdentifierList = (value: unknown): value is string[] =>
  Array.isArray(value)
  && value.length <= MFA_POLICY_LIST_MAX
  && value.every((item) => typeof item === 'string' && item.trim() !== '');

/**
 * A recusa de uma política que alguém quer GRAVAR — a referência de mensagem, ou `null`. Estrita, ao
 * contrário de `memberMfaPolicyOf`: na gravação, o erro volta para quem pode corrigi-lo.
 */
export const memberMfaPolicyIssue = (raw: unknown): string | null => {
  const policy = recordOf(raw);
  if (typeof policy.enabled !== 'boolean' || typeof policy.everyone !== 'boolean') {
    return '@core.access/mfa.policy.invalid';
  }
  if (!isIdentifierList(policy.roleIds) || !isIdentifierList(policy.permissions)) {
    return '@core.access/mfa.policy.invalid';
  }
  if (!isMfaReverifyMinutes(policy.reverifyMinutes)) return '@core.access/mfa.policy.reverify-range';
  if (policy.enabled && !policy.everyone && policy.roleIds.length === 0 && policy.permissions.length === 0) {
    return '@core.access/mfa.policy.scope-empty';
  }
  return null;
};

export interface MfaMemberFacts {
  roleIds: readonly string[];
  /** O conjunto EFETIVO — o do dono é o curinga, e o curinga detém toda permissão. */
  permissions: readonly string[];
}

/**
 * A exigência de UM membro. Por permissão olha o conjunto EFETIVO, e é de propósito: quem recebe a
 * permissão por dependência pode exatamente o mesmo que quem a recebe marcada. Pelo mesmo motivo o
 * dono entra em toda política por permissão — o curinga dele detém todas.
 */
export const memberMfaRequirementOf = (
  policy: MemberMfaPolicy,
  member: MfaMemberFacts,
): MemberMfaRequirement | null => {
  if (!policy.enabled) return null;
  const required = policy.everyone
    || policy.roleIds.some((roleId) => member.roleIds.includes(roleId))
    || (policy.permissions.length > 0 && grantsAny(member.permissions, policy.permissions));
  return required ? { maxAgeSeconds: policy.reverifyMinutes * 60 } : null;
};

/** A exigência como o documento de membro a guarda — `null` para ausente ou ilegível. */
export const memberMfaRequirementFrom = (raw: unknown): MemberMfaRequirement | null => {
  const stored = recordOf(raw);
  return isIntegerBetween(stored.maxAgeSeconds, MFA_REVERIFY_MIN_MINUTES * 60, MFA_REVERIFY_MAX_MINUTES * 60)
    ? { maxAgeSeconds: stored.maxAgeSeconds }
    : null;
};

export const sameMfaRequirement = (a: MemberMfaRequirement | null, b: MemberMfaRequirement | null): boolean =>
  (a === null || b === null ? a === b : a.maxAgeSeconds === b.maxAgeSeconds);

/** O instante da verificação na sessão, ou `null` quando ela não provou fator nenhum. */
export const mfaVerifiedAtOf = (claims: Record<string, unknown> | null | undefined): number | null => {
  const value = claims?.[MFA_SESSION_CLAIM];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/** `missing`: a sessão nunca provou o fator. `expired`: provou, mas há mais tempo que o permitido para agir. */
export type MfaSessionIssue = 'missing' | 'expired';

/**
 * A MESMA pergunta que `sessionSatisfiesMfa` faz no `firestore.rules` e que `requirePermission` faz nas
 * callables. `acting` separa LER (basta ter provado) de GRAVAR ou chamar o servidor (a prova precisa
 * ser recente).
 */
export const mfaSessionIssue = (
  requirement: MemberMfaRequirement | null,
  verifiedAt: number | null,
  nowSeconds: number,
  acting: boolean,
): MfaSessionIssue | null => {
  if (requirement === null) return null;
  if (verifiedAt === null) return 'missing';
  if (!acting) return null;
  return nowSeconds < verifiedAt + requirement.maxAgeSeconds ? null : 'expired';
};

/** Quando a prova da sessão deixa de valer para agir, em segundos — `null` se não há o que vencer. */
export const mfaSessionExpiresAt = (
  requirement: MemberMfaRequirement | null,
  verifiedAt: number | null,
): number | null => (requirement === null || verifiedAt === null ? null : verifiedAt + requirement.maxAgeSeconds);

/** Seis dígitos; espaços no meio são tolerados, porque é assim que os aplicativos os mostram. */
export const totpCodeOf = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const code = input.replace(/\s+/g, '');
  return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code) ? code : null;
};

/** O código de recuperação como foi impresso (`abcde-fghjk`), em qualquer caixa e com ou sem o hífen. */
export const recoveryCodeOf = (input: unknown): string | null => {
  if (typeof input !== 'string') return null;
  const code = input.toLowerCase().replace(/[\s-]+/g, '');
  if (code.length !== RECOVERY_CODE_LENGTH) return null;
  return [...code].every((char) => RECOVERY_CODE_ALPHABET.includes(char)) ? code : null;
};

export const formatRecoveryCode = (code: string): string =>
  `${code.slice(0, RECOVERY_CODE_LENGTH / 2)}-${code.slice(RECOVERY_CODE_LENGTH / 2)}`;

/** O rótulo que o aplicativo autenticador mostra. Curto e sem `:`, que separa emissor de conta na URI. */
export const mfaIssuerOf = (raw: unknown): string => {
  const issuer = typeof raw === 'string' ? raw.replace(/[:\s]+/g, ' ').trim().slice(0, 64) : '';
  return issuer === '' ? 'Microteia' : issuer;
};

/** A URI `otpauth://` do Key URI Format — a que o QR carrega e que o celular abre direto. */
export const otpauthUri = (issuer: string, account: string, secretBase32: string): string => {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = [
    `secret=${secretBase32}`,
    `issuer=${encodeURIComponent(issuer)}`,
    'algorithm=SHA1',
    `digits=${TOTP_DIGITS}`,
    `period=${TOTP_PERIOD_SECONDS}`,
  ].join('&');
  return `otpauth://totp/${label}?${query}`;
};

/** O estado do segundo fator de quem pergunta, num escritório. */
export interface SecondFactorStatus {
  required: boolean;
  reverifyMinutes: number | null;
  enrolled: boolean;
  enrolledAt: string | null;
  recoveryCodesLeft: number;
  lockedUntil: string | null;
}

/** O segredo sorteado, que só sai do servidor uma vez — no cadastro. */
export interface SecondFactorEnrollment {
  secret: string;
  uri: string;
  expiresAt: string;
}

/** A sessão aberta pelo servidor depois de o código conferir. */
export interface SecondFactorSession {
  token: string;
  verifiedAt: number;
  recoveryCodesLeft: number;
  usedRecoveryCode: boolean;
  /** Só no cadastro e na troca dos códigos: a única vez que eles aparecem. */
  recoveryCodes?: string[];
}

/** Um membro na tela de Segurança. */
export interface MemberMfaEntry {
  userId: string;
  displayName: string;
  email: string;
  required: boolean;
  enrolled: boolean;
  enrolledAt: string | null;
  lastVerifiedAt: string | null;
}

export interface MemberMfaOverview {
  policy: MemberMfaPolicy;
  members: MemberMfaEntry[];
}
