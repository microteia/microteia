import type { MarketplacePlugin } from './MarketplacePlugin';

/** De onde a cópia instalada veio: do catálogo público ou de uma extensão privada do próprio autor. */
export type InstalledExtensionSource = 'public' | 'private';

/**
 * Uma extensão INSTALADA no escritório — cópia fiel de TODOS os dados de uma extensão (pública ou
 * privada), gravada em `tenants/{tenantId}/installed_extensions/{id}` (id = `package.manifest.id`).
 * É independente da fonte: se o autor apagar/obsoletar a origem, esta cópia continua funcionando. O
 * usuário só pode Desinstalar; Baixar é permitido apenas se ele mesmo for o autor original. Quando a
 * fonte (privada mais recente, senão pública) tiver versão maior que `installedVersion`, a tela
 * oferece "Atualizar", que recopia todos os dados.
 */
export interface InstalledExtension {
  /** = package.manifest.id (domínio). Imutável. */
  id: string;
  tenantId: string;
  /** Ligada no escritório: registra nav/páginas/telas de código no Kernel do tenant. */
  active: boolean;
  package: MarketplacePlugin;
  source: InstalledExtensionSource;
  /** Versão copiada — comparada com a fonte para detectar "há atualização disponível". */
  installedVersion: string;
  /** Id do autor ORIGINAL (permite Baixar quando o usuário atual é o próprio autor). */
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  installedBy: string;
  installedAt: Date;
  updatedAt: Date;
}
