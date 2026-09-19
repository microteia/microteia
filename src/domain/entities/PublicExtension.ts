import type { MarketplacePlugin } from './MarketplacePlugin';

export type PublicExtensionStatus = 'pending' | 'approved' | 'deprecated';

/**
 * Uma extensão PUBLICADA no catálogo global (`public_extensions/{domain}`, id = domínio = manifest.id).
 * Modelo npm/VS Code: domínio único global, versão imutável (republicar exige subir a versão),
 * "obsoleta" em vez de apagar. Publicar é o gesto de quem já pode aprovar, então toda publicação nova
 * nasce `approved`: extensão **com código** só o SYSTEM publica; **sem código**, quem administra o
 * escritório dono. As Firestore Rules garantem esses invariantes — ver `firestore.rules`
 * (`public_extensions`). Instalar copia o `package` para o tenant.
 *
 * `pending` é ESTADO LEGADO: veio de quando o admin do escritório enfileirava código para curadoria.
 * Nenhuma publicação nova o produz, e o SYSTEM ainda aprova ou rejeita o que ficou na fila.
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
