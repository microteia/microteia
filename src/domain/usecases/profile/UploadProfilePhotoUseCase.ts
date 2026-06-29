import type { IUserProfileRepository } from '../../repositories/IUserProfileRepository';

export type UploadProfilePhotoUseCase = {
  execute: (userId: string, blob: Blob, fileName: string) => Promise<string>;
};

export const makeUploadProfilePhotoUseCase = (repo: IUserProfileRepository): UploadProfilePhotoUseCase => ({
  execute: (userId, blob, fileName) => repo.uploadPhoto(userId, blob, fileName),
});
