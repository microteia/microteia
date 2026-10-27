import type { IMfaFactorRepository, MfaFactor } from './IMfaFactorRepository';
import type { IMemberMfaPolicyRepository, IMfaSessionMinter } from './IMemberMfaPolicyRepository';
import type { MemberMfaPolicy } from '../schema/memberMfa';
import { DEFAULT_MEMBER_MFA_POLICY } from '../schema/memberMfa';

/** Em memória, para os testes. Copia na entrada e na saída: quem muta o que leu não muda o guardado. */
export class FakeMfaFactorRepository implements IMfaFactorRepository {
  readonly stored = new Map<string, MfaFactor>();

  private static copy(factor: MfaFactor): MfaFactor {
    return { ...factor, recoveryCodes: [...factor.recoveryCodes], pending: factor.pending ? { ...factor.pending } : null };
  }

  async get(userId: string): Promise<MfaFactor | null> {
    const factor = this.stored.get(userId);
    return factor ? FakeMfaFactorRepository.copy(factor) : null;
  }

  async getMany(userIds: string[]): Promise<Map<string, MfaFactor>> {
    const found = new Map<string, MfaFactor>();
    for (const userId of userIds) {
      const factor = this.stored.get(userId);
      if (factor) found.set(userId, FakeMfaFactorRepository.copy(factor));
    }
    return found;
  }

  async update<T>(userId: string, change: (current: MfaFactor | null) => { next?: MfaFactor | null; result: T }): Promise<T> {
    const { next, result } = change(await this.get(userId));
    if (next === null) this.stored.delete(userId);
    else if (next !== undefined) this.stored.set(userId, FakeMfaFactorRepository.copy(next));
    return result;
  }

  async remove(userId: string): Promise<boolean> {
    return this.stored.delete(userId);
  }
}

export class FakeMemberMfaPolicyRepository implements IMemberMfaPolicyRepository {
  readonly stored = new Map<string, MemberMfaPolicy>();

  async get(tenantId: string): Promise<MemberMfaPolicy> {
    return this.stored.get(tenantId) ?? DEFAULT_MEMBER_MFA_POLICY;
  }

  async save(tenantId: string, policy: MemberMfaPolicy): Promise<void> {
    this.stored.set(tenantId, policy);
  }
}

export class FakeMfaSessionMinter implements IMfaSessionMinter {
  readonly minted: Array<{ userId: string; verifiedAt: number }> = [];

  async mint(userId: string, verifiedAt: number): Promise<string> {
    this.minted.push({ userId, verifiedAt });
    return `token:${userId}:${verifiedAt}`;
  }
}
