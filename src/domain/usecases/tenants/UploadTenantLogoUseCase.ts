import type { ITenantRepository } from '../../repositories/ITenantRepository';

export type UploadTenantLogoUseCase = {
  /** Envia a imagem e devolve a URL de download — quem a grava no escritório é `updateTenant`. */
  execute: (tenantId: string, image: Blob) => Promise<string>;
};

export const makeUploadTenantLogoUseCase = (repo: ITenantRepository): UploadTenantLogoUseCase => ({
  execute: (tenantId, image) => repo.uploadLogo(tenantId, image, `logo_${Date.now()}.png`),
});
