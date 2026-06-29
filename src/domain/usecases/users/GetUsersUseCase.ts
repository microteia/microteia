import type { AppUser } from '../../entities';
import type { IUserRepository } from '../../repositories/IUserRepository';

export type GetUsersUseCase = {
  execute: () => Promise<AppUser[]>;
};

export const makeGetUsersUseCase = (repo: IUserRepository): GetUsersUseCase => ({
  execute: () => repo.getUsers(),
});
