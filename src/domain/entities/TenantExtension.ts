import type { MarketplacePlugin } from './MarketplacePlugin';

/**
 * De onde veio a extensão de "Minhas extensões":
 * - `authored` — montada AQUI, na tela "Criar extensão", a partir dos artefatos do escritório;
 * - `imported` — trazida de um `.json`. A fonte dela está com quem a escreveu, e por isso aqui ela é
 *   usada e publicada, mas nunca editada nem exportada. Ver `extensionOrigin`.
 */
export type TenantExtensionOrigin = 'authored' | 'imported';

/**
 * Uma extensão PRIVADA do escritório — criada na tela "Criar extensão" e gravada em
 * `tenants/{tenantId}/extensions/{id}` (id = `package.manifest.id`, o domínio, imutável). É a fonte de
 * verdade editável do dono (diferente da cópia publicada no registro global e da cópia instalada). Nasce
 * privada e inativa; `active` liga suas contribuições no PRÓPRIO tenant. Como o código é do próprio autor,
 * ele roda no tenant dele sem aprovação (self-trust); a aprovação do SYSTEM só é exigida para publicar.
 */
export interface TenantExtension {
  /** = package.manifest.id (domínio, DNS reverso). Imutável após a criação. */
  id: string;
  tenantId: string;
  /** Ligada no próprio escritório: registra nav/páginas/telas de código no Kernel do tenant. */
  active: boolean;
  package: MarketplacePlugin;
  origin: TenantExtensionOrigin;
  createdBy: string;
  /** Nome e foto do criador, denormalizados para exibição na lista (modelo dos Workflows Públicos). */
  createdByName?: string;
  createdByPhotoURL?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
