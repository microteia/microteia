import type { IMemberMfaRepository } from '../../repositories/IMemberMfaRepository';
import type {
  MemberMfaOverview,
  MemberMfaPolicy,
  SecondFactorEnrollment,
  SecondFactorSession,
  SecondFactorStatus,
} from '../../schema/memberMfa';

export type GetSecondFactorStatusUseCase = {
  execute: (tenantId: string) => Promise<SecondFactorStatus>;
};

export const makeGetSecondFactorStatusUseCase = (repo: IMemberMfaRepository): GetSecondFactorStatusUseCase => ({
  execute: (tenantId) => repo.status(tenantId),
});

export type EnrollSecondFactorUseCase = {
  execute: (tenantId: string, issuer: string) => Promise<SecondFactorEnrollment>;
};

export const makeEnrollSecondFactorUseCase = (repo: IMemberMfaRepository): EnrollSecondFactorUseCase => ({
  execute: (tenantId, issuer) => repo.enroll(tenantId, issuer),
});

export type ConfirmSecondFactorUseCase = {
  execute: (tenantId: string, code: string) => Promise<SecondFactorSession>;
};

export const makeConfirmSecondFactorUseCase = (repo: IMemberMfaRepository): ConfirmSecondFactorUseCase => ({
  execute: (tenantId, code) => repo.confirm(tenantId, code),
});

export type VerifySecondFactorUseCase = {
  execute: (tenantId: string, code: string) => Promise<SecondFactorSession>;
};

export const makeVerifySecondFactorUseCase = (repo: IMemberMfaRepository): VerifySecondFactorUseCase => ({
  execute: (tenantId, code) => repo.verify(tenantId, code),
});

export type RegenerateRecoveryCodesUseCase = {
  execute: (tenantId: string) => Promise<string[]>;
};

export const makeRegenerateRecoveryCodesUseCase = (repo: IMemberMfaRepository): RegenerateRecoveryCodesUseCase => ({
  execute: (tenantId) => repo.regenerateRecoveryCodes(tenantId),
});

export type GetMemberMfaOverviewUseCase = {
  execute: (tenantId: string) => Promise<MemberMfaOverview>;
};

export const makeGetMemberMfaOverviewUseCase = (repo: IMemberMfaRepository): GetMemberMfaOverviewUseCase => ({
  execute: (tenantId) => repo.overview(tenantId),
});

export type SaveMemberMfaPolicyUseCase = {
  execute: (tenantId: string, policy: MemberMfaPolicy) => Promise<MemberMfaOverview>;
};

export const makeSaveMemberMfaPolicyUseCase = (repo: IMemberMfaRepository): SaveMemberMfaPolicyUseCase => ({
  execute: (tenantId, policy) => repo.savePolicy(tenantId, policy),
});

export type ResetMemberSecondFactorUseCase = {
  execute: (tenantId: string, userId: string) => Promise<MemberMfaOverview>;
};

export const makeResetMemberSecondFactorUseCase = (repo: IMemberMfaRepository): ResetMemberSecondFactorUseCase => ({
  execute: (tenantId, userId) => repo.reset(tenantId, userId),
});
