/**
 * O segundo fator de UMA pessoa — `mfaFactors/{uid}`, na raiz, e fechado a todo cliente nas regras: o
 * segredo e os hashes dos códigos de recuperação só existem para o servidor.
 *
 * É da pessoa, e não do escritório: o aplicativo autenticador dela vale em todo escritório de que ela
 * participa. Quem decide se um escritório o EXIGE é a política dele (`memberMfaPolicies`).
 */
export interface MfaFactor {
  /** Base32. `null` enquanto o cadastro não foi confirmado. */
  secret: string | null;
  enrolledAt: Date | null;
  /** O segredo sorteado, à espera do primeiro código — que é a prova de que ele chegou ao aplicativo. */
  pending: { secret: string; expiresAt: Date } | null;
  /** SHA-256 de cada código ainda não usado. O código em si nunca é gravado. */
  recoveryCodes: string[];
  /** O último passo TOTP aceito: ele e todo anterior são recusados depois. */
  lastStep: number | null;
  failures: number;
  lockedUntil: Date | null;
  lastVerifiedAt: Date | null;
}

/** `next` ausente: nada a gravar. `null`: apagar. */
export interface MfaFactorChange<T> {
  next?: MfaFactor | null;
  result: T;
}

export interface IMfaFactorRepository {
  get(userId: string): Promise<MfaFactor | null>;
  getMany(userIds: string[]): Promise<Map<string, MfaFactor>>;
  /**
   * Lê e grava NUMA transação. É o que impede duas tentativas simultâneas de aceitarem o mesmo passo, ou
   * de cada uma contar a falha a partir do mesmo número — e passarem do limite sem travar.
   */
  update<T>(userId: string, change: (current: MfaFactor | null) => MfaFactorChange<T>): Promise<T>;
  /** `true` quando havia o que apagar. */
  remove(userId: string): Promise<boolean>;
}

export const emptyMfaFactor = (): MfaFactor => ({
  secret: null,
  enrolledAt: null,
  pending: null,
  recoveryCodes: [],
  lastStep: null,
  failures: 0,
  lockedUntil: null,
  lastVerifiedAt: null,
});
