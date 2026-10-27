import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IMemberMfaRepository } from '../../domain/repositories/IMemberMfaRepository';
import type {
  MemberMfaOverview,
  MemberMfaPolicy,
  SecondFactorEnrollment,
  SecondFactorSession,
  SecondFactorStatus,
} from '../../domain/schema/memberMfa';

type SelfRequest =
  | { tenantId: string; op: 'status' }
  | { tenantId: string; op: 'enroll'; issuer: string }
  | { tenantId: string; op: 'confirm' | 'verify'; code: string }
  | { tenantId: string; op: 'recovery-codes' };

type ManageRequest =
  | { tenantId: string; op: 'overview' }
  | { tenantId: string; op: 'save'; policy: MemberMfaPolicy }
  | { tenantId: string; op: 'reset'; userId: string };

const self = async <T>(request: SelfRequest): Promise<T> =>
  (await httpsCallable<SelfRequest, T>(functions, 'secondFactor')(request)).data;

const manage = async (request: ManageRequest): Promise<MemberMfaOverview> =>
  (await httpsCallable<ManageRequest, MemberMfaOverview>(functions, 'manageMemberMfa')(request)).data;

export class FirebaseMemberMfaRepository implements IMemberMfaRepository {
  status(tenantId: string): Promise<SecondFactorStatus> {
    return self({ tenantId, op: 'status' });
  }

  enroll(tenantId: string, issuer: string): Promise<SecondFactorEnrollment> {
    return self({ tenantId, op: 'enroll', issuer });
  }

  confirm(tenantId: string, code: string): Promise<SecondFactorSession> {
    return self({ tenantId, op: 'confirm', code });
  }

  verify(tenantId: string, code: string): Promise<SecondFactorSession> {
    return self({ tenantId, op: 'verify', code });
  }

  async regenerateRecoveryCodes(tenantId: string): Promise<string[]> {
    return (await self<{ recoveryCodes: string[] }>({ tenantId, op: 'recovery-codes' })).recoveryCodes;
  }

  overview(tenantId: string): Promise<MemberMfaOverview> {
    return manage({ tenantId, op: 'overview' });
  }

  savePolicy(tenantId: string, policy: MemberMfaPolicy): Promise<MemberMfaOverview> {
    return manage({ tenantId, op: 'save', policy });
  }

  reset(tenantId: string, userId: string): Promise<MemberMfaOverview> {
    return manage({ tenantId, op: 'reset', userId });
  }
}
