import type { MarketplacePlugin } from './MarketplacePlugin';

/**
 * Uma extensão AUTORAL do escritório — criada na tela "Criar extensão" e gravada em
 * `tenants/{tenantId}/extensions/{id}` (id = `package.manifest.id`, o domínio). É a fonte de verdade
 * editável do dono (diferente da cópia publicada, imutável, no registro global). Nasce privada e
 * inativa; `active` liga suas contribuições no PRÓPRIO tenant. Como o código é do próprio autor, ele
 * roda no tenant dele sem aprovação (self-trust); a aprovação do SYSTEM só é exigida para publicar.
 */
export interface TenantExtension {
  /** = package.manifest.id (domínio, DNS reverso). */
  id: string;
  tenantId: string;
  /** Ligada no próprio escritório: registra nav/páginas/telas de código no Kernel do tenant. */
  active: boolean;
  package: MarketplacePlugin;
  /** Presente quando esta extensão é uma CÓPIA instalada de uma pública (domínio de origem). Uma
   *  extensão autoral ("Minha") não tem este campo; uma "Instalada" tem. Cópias não são editáveis. */
  sourcePluginId?: string;
  /** Versão da pública no momento da instalação/atualização — detecta "há atualização disponível". */
  sourceVersion?: string;
  createdBy: string;
  /** Nome e foto do criador, denormalizados para exibição na lista (modelo dos Workflows Públicos). */
  createdByName?: string;
  createdByPhotoURL?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
