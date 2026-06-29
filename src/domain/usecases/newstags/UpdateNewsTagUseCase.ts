import type { INewsTagRepository } from '../../repositories/INewsTagRepository';

export type UpdateNewsTagUseCase = {
  execute: (id: string, data: { name?: string; color?: string }) => Promise<void>;
};

export const makeUpdateNewsTagUseCase = (repo: INewsTagRepository): UpdateNewsTagUseCase => ({
  execute: (id, data) => repo.updateTag(id, data),
});
