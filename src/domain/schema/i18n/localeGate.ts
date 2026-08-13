import type { LocaleCode } from './localeNegotiation';
import { normalizeLocale } from './localeNegotiation';
import type { MessageCatalog } from './messages';
import { emptyCatalog } from './messages';

/**
 * O idioma CORRENTE como contexto de módulo — o mesmo mecanismo de `data/utils/recordRulesGate.ts`,
 * e pelo mesmo motivo: `src/utils/formatters.ts` é API pública congelada (viaja até as extensões como
 * `@microteia/format`), então não pode ganhar um parâmetro de idioma sem quebrar toda extensão
 * instalada. O idioma chega por empurrão de quem o conhece, e as funções continuam com a assinatura
 * que sempre tiveram.
 *
 * No front quem empurra é o `LocaleProvider`; no backend, quem resolveu a configuração do escritório
 * antes de executar a automação.
 */

/**
 * O idioma em que este sistema falava antes de existir idioma nenhum.
 *
 * Enquanto NINGUÉM tiver configurado um idioma, a formatação continua exatamente como era — data em
 * `dd/mm/aaaa`, moeda em `R$`. Sem esta âncora, publicar o motor viraria uma troca silenciosa de
 * formato para todo escritório existente, o que um release de infraestrutura não tem o direito de
 * fazer. É dívida deliberada e datada: sai quando o pacote `pt-BR` passar a ser instalado por padrão
 * nos escritórios existentes, na virada de major.
 */
export const LEGACY_LOCALE: LocaleCode = 'pt-BR';

let ambient: LocaleCode | null = null;
let catalog: MessageCatalog = emptyCatalog();

/** O idioma configurado, ou `null` enquanto ninguém configurou nenhum. */
export const configuredLocale = (): LocaleCode | null => ambient;

/** O idioma a usar para FORMATAR. Nunca `null`: quem formata precisa de uma resposta. */
export const ambientLocale = (): LocaleCode => ambient ?? LEGACY_LOCALE;

export const setAmbientLocale = (locale: LocaleCode | null): void => {
  ambient = locale === null ? null : normalizeLocale(locale) || null;
};

/** O catálogo corrente, para quem traduz fora de um componente React (repositório, serviço, gate). */
export const ambientCatalog = (): MessageCatalog => catalog;

export const setAmbientCatalog = (next: MessageCatalog): void => {
  catalog = next;
};

/** Devolve o gate ao estado inicial. Existe para os testes não vazarem idioma de um caso para outro. */
export const resetAmbientLocale = (): void => {
  ambient = null;
  catalog = emptyCatalog();
};
