import type { InstalledExtension } from '../../entities/InstalledExtension';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

export type { ExtensionCodeTrust } from '../../entities/InstalledExtension';

/**
 * Confiança de CÓDIGO de extensão.
 *
 * Uma extensão sem `views`/`startup` instala telas, campos e workflows sem executar nada — não passa
 * por aqui. Com código, a regra é procedência OU gesto explícito:
 *
 * - veio do catálogo público (`source: 'public'`, aprovado por SYSTEM) → roda;
 * - fora dele (um `.json` importado, seu ou de terceiro) → só roda depois de um admin abrir a fonte
 *   e confiar, e a confiança vale para AQUELE código.
 *
 * O vínculo é por HASH do conteúdo, não pela versão: um pacote montado à mão pode manter `1.0.0` e
 * trocar o código, e uma confiança presa à versão passaria a valer para código nunca revisado.
 */
// NUL como separador: não pode aparecer dentro do código, então a serialização é inambígua.
const SEPARATOR = '\u0000';

/**
 * Serialização determinística de TODO o código do pacote. As views são ordenadas por chave para que
 * a mesma extensão produza sempre o mesmo hash, independentemente da ordem no arquivo.
 */
export const extensionCodeOf = (pkg: MarketplacePlugin): string | null => {
  const views = [...(pkg.views ?? [])]
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map((view) => `${view.key}${SEPARATOR}${view.source}`);
  const startup = pkg.startup?.trim() ? [`${SEPARATOR}startup${SEPARATOR}${pkg.startup}`] : [];
  const parts = [...views, ...startup];
  return parts.length > 0 ? parts.join(SEPARATOR) : null;
};

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
 * A extensão pode executar código? Sem código, a pergunta não se aplica e a resposta é `true` — quem
 * chama usa isto só para decidir `trusted`, e um pacote sem código não recebe implementações.
 */
export const isExtensionCodeTrusted = (
  extension: InstalledExtension,
  currentHash: string | null,
): boolean => {
  if (!extensionHasCode(extension.package)) return true;
  if (isFromPublicCatalog(extension)) return true;
  const trust = extension.codeTrust;
  return !!trust && !!currentHash && trust.hash === currentHash;
};
