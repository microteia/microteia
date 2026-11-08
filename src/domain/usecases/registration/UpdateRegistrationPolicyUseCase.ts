import type { RegistrationPolicy } from '../../schema/registration';
import type { IRegistrationPolicyRepository } from '../../repositories/IRegistrationPolicyRepository';

export type UpdateRegistrationPolicyUseCase = {
  execute: (change: Partial<RegistrationPolicy>, updatedBy: string) => Promise<void>;
};

export const makeUpdateRegistrationPolicyUseCase = (repo: IRegistrationPolicyRepository): UpdateRegistrationPolicyUseCase => ({
  execute: (change, updatedBy) => repo.updatePolicy(change, updatedBy),
});
