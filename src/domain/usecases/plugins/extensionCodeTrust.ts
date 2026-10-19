import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { extensionCodeOf, isCodeTrusted } from '../../schema/plugin/codeTrust';

export type { ExtensionCodeTrust } from '../../entities/InstalledExtension';

/**
 * Confiança de CÓDIGO de extensão.
 *
 * Uma extensão sem `views`/`startup` instala telas, campos e workflows sem executar nada — não passa
 * por aqui. Com código, a regra é procedência OU gesto explícito:
 *
 * - veio do catálogo público (`source: 'public'`, aprovado por SYSTEM) ou do catálogo embutido no
 *   bundle (`source: 'builtin'`, o próprio código da aplicação) → roda;
 * - fora dele (um `.json` importado, seu ou de terceiro) → só roda depois de um admin abrir a fonte
 *   e confiar, e a confiança vale para AQUELE código.
 *
 * O vínculo é por HASH do conteúdo, não pela versão: um pacote montado à mão pode manter `1.0.0` e
 * trocar o código, e uma confiança presa à versão passaria a valer para código nunca revisado.
 */
/** A serialização do código mora no schema compartilhado: o servidor a aplica igual. */
export { extensionCodeOf };

export const extensionHasCode = (pkg: MarketplacePlugin): boolean => extensionCodeOf(pkg) !== null;

export const hashExtensionCode = async (pkg: MarketplacePlugin): Promise<string | null> => {
  const code = extensionCodeOf(pkg);
  if (code === null) return null;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/** Cópia vinda do catálogo público: a aprovação por SYSTEM já é a revisão. */
export const isFromPublicCatalog = (extension: InstalledExtension): boolean =>
  extension.source === 'public';

/**
 * A procedência dispensa o gesto de revisão: catálogo público (revisado na publicação) ou catálogo
 * EMBUTIDO, cujo código é o da própria aplicação — pedir a um admin que revise o código que já veio
 * no bundle não acrescentaria garantia nenhuma.
 */
export const hasTrustedProvenance = (extension: InstalledExtension): boolean =>
  isFromPublicCatalog(extension) || extension.source === 'builtin';

/**
 * A extensão pode executar código? Sem código, a pergunta não se aplica e a resposta é `true` — quem
 * chama usa isto só para decidir `trusted`, e um pacote sem código não recebe implementações.
 */
export const isExtensionCodeTrusted = (
  extension: InstalledExtension,
  currentHash: string | null,
): boolean => isCodeTrusted(extension, extensionHasCode(extension.package), currentHash);
