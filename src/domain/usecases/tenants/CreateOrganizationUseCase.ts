import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type CreateOrganizationUseCase = {
  execute: (name: string, ownerEmail: string) => Promise<string>;
};

export const makeCreateOrganizationUseCase = (repo: ITenantRepository): CreateOrganizationUseCase => ({
  execute: (name, ownerEmail) => repo.createOrganization(name.trim(), ownerEmail.trim()),
});
