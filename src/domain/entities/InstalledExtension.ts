import type { MarketplacePlugin } from './MarketplacePlugin';

/**
 * Gesto explícito de um admin do escritório autorizando o CÓDIGO desta cópia a executar. O vínculo é
 * pelo `hash` do conteúdo, e não pela versão: um pacote montado à mão pode manter a mesma versão e
 * trocar o código, e uma confiança presa à versão passaria a valer para código nunca revisado.
 */
export interface ExtensionCodeTrust {
  hash: string;
  trustedBy: string;
  trustedByName: string;
  trustedAt: Date;
}

/**
 * De onde a cópia instalada veio:
 * - `public` — catálogo público, aprovada por um SYSTEM;
 * - `private` — extensão privada do próprio escritório;
 * - `builtin` — CATÁLOGO EMBUTIDO, que viaja no bundle da aplicação (extensões de primeira parte).
 *
 * `public` e `builtin` têm procedência confiável — a primeira porque passou pela revisão da
 * publicação, a segunda porque é o próprio código da aplicação. Ver `extensionCodeTrust`.
 */
export type InstalledExtensionSource = 'public' | 'private' | 'builtin';

/**
 * Uma extensão INSTALADA no escritório — cópia fiel de TODOS os dados de uma extensão (pública ou
 * privada), gravada em `tenants/{tenantId}/installed_extensions/{id}` (id = `package.manifest.id`).
 * É independente da fonte: se o autor apagar/obsoletar a origem, esta cópia continua funcionando. O
 * usuário só pode Desinstalar; Baixar é permitido apenas se ele mesmo for o autor original. Quando a
 * fonte (privada mais recente, senão pública) tiver versão maior que `installedVersion`, a tela
 * oferece "Atualizar", que recopia todos os dados.
 */
/**
 * O que o Microteia Console já APLICOU no projeto Firebase para esta extensão. Gravado por
 * `microteia provision`, nunca pela aplicação.
 *
 * O vínculo é pelo `fingerprint` do que a extensão EXIGE, não pela versão dela — mesma razão do
 * `ExtensionCodeTrust`: uma versão nova que passe a pedir uma Cloud Function nova volta a ficar
 * pendente sozinha, sem código de migração.
 */
export interface ExtensionBackendState {
  fingerprint: string;
  appliedAt: Date;
}

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
  /**
   * Ausente quando o pacote não tem código, ou quando o código ainda não foi revisado. Cópia vinda do
   * catálogo público dispensa o gesto — a aprovação por SYSTEM já é a revisão.
   */
  codeTrust?: ExtensionCodeTrust | null;
  /**
   * Ausente quando a extensão não exige nada do backend — o caso da grande maioria. Presente e batendo
   * com o exigido, a extensão entra no boot; ausente ou divergente, ela fica pendente do Console.
   */
  backendState?: ExtensionBackendState | null;
  installedAt: Date;
  updatedAt: Date;
}
