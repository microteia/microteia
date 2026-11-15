import type { MarketplacePlugin } from './MarketplacePlugin';
import type { PublicationProof } from '../schema/plugin/publicationProof';

export type PublicExtensionStatus = 'pending' | 'approved' | 'deprecated';

/**
 * Uma extensão PUBLICADA no catálogo global (`public_extensions/{domain}`, id = domínio = manifest.id).
 * Modelo npm/VS Code: domínio único global, versão imutável (republicar exige subir a versão),
 * "obsoleta" em vez de apagar. Publicar é o gesto de quem já pode aprovar, então toda publicação nova
 * nasce `approved`: extensão **com código** só o SYSTEM publica; **sem código**, quem administra o
 * escritório dono. Quem escreve é só a callable `publishExtension`, e o que ela publica é a cópia
 * INSTALADA, completa, no escritório dono — `proof` é o registro disso. Instalar copia o `package`
 * para o tenant.
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
  /**
   * A prova de que ESTE conteúdo estava instalado por completo quando foi publicado. `null` só nas
   * entradas anteriores à regra — até o dono comprová-las, elas continuam instaláveis como sempre.
   */
  proof: PublicationProof | null;
}
