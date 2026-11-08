import type { RegistrationPolicy } from '../../schema/registration';
import type { IRegistrationPolicyRepository } from '../../repositories/IRegistrationPolicyRepository';

export type GetRegistrationPolicyUseCase = {
  execute: () => Promise<RegistrationPolicy>;
};

export const makeGetRegistrationPolicyUseCase = (repo: IRegistrationPolicyRepository): GetRegistrationPolicyUseCase => ({
  execute: () => repo.getPolicy(),
});
