import type { UserRole } from '../../entities';
import type { IUserRepository } from '../../repositories/IUserRepository';

export type UpdateUserRoleUseCase = {
  execute: (userId: string, role: UserRole) => Promise<void>;
};

export const makeUpdateUserRoleUseCase = (repo: IUserRepository): UpdateUserRoleUseCase => ({
  execute: (userId, role) => repo.updateUserRole(userId, role),
});
