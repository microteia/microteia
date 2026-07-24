import type { MarketplacePlugin } from './MarketplacePlugin';

export type PublicExtensionStatus = 'pending' | 'approved' | 'deprecated';

/**
 * Uma extensão PUBLICADA no catálogo global (`public_extensions/{domain}`, id = domínio = manifest.id).
 * Modelo npm/VS Code: domínio único global, versão imutável (republicar exige subir a versão),
 * "obsoleta" em vez de apagar. Extensão **com código** entra como `pending` e só vira `approved` por
 * um SYSTEM (curadoria); **sem código** já entra `approved`. As Firestore Rules garantem esses
 * invariantes — ver `firestore.rules` (`public_extensions`). Instalar copia o `package` para o tenant.
 */
export interface PublicExtension {
  domain: string;
  package: MarketplacePlugin;
  ownerTenantId: string;
  ownerName: string;
  ownerPhotoURL: string | null;
  version: string;
  status: PublicExtensionStatus;
  hasCode: boolean;
  publishedAt: Date;
  publishedBy: string;
}
