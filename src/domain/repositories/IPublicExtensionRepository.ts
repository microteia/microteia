import type { MarketplacePlugin } from '../entities/MarketplacePlugin';
import type { PublicExtension, PublicExtensionStatus } from '../entities/PublicExtension';

export interface PublishPublicExtensionInput {
  package: MarketplacePlugin;
  ownerTenantId: string;
  ownerName: string;
  ownerPhotoURL: string | null;
  version: string;
  status: PublicExtensionStatus;
  hasCode: boolean;
  publishedBy: string;
}

/**
 * Catálogo global `public_extensions`. `publish` grava o pacote inteiro (id = domínio); `setStatus`
 * é a moderação do SYSTEM (aprovar/obsoletar). As Rules garantem domínio único, imutabilidade de
 * versão e o gate de aprovação por código — o repositório só escreve.
 */
export interface IPublicExtensionRepository {
  subscribe(onChange: (items: PublicExtension[]) => void): () => void;
  publish(input: PublishPublicExtensionInput): Promise<void>;
  setStatus(domain: string, status: PublicExtensionStatus): Promise<void>;
  delete(domain: string): Promise<void>;
}
