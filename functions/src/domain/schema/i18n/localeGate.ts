// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/i18n/localeGate.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { LocaleCode } from './localeNegotiation';
import { DEFAULT_LOCALE, normalizeLocale } from './localeNegotiation';
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

let ambient: LocaleCode | null = null;
let catalog: MessageCatalog = emptyCatalog();

/** O idioma em vigor, ou `null` antes de o provedor ter empurrado o primeiro. */
export const configuredLocale = (): LocaleCode | null => ambient;

/**
 * O idioma a usar para FORMATAR. Nunca `null`: quem formata precisa de uma resposta.
 *
 * O fallback é o IDIOMA-FONTE. Já foi `pt-BR` — uma âncora hardcoded para que escritórios
 * existentes não trocassem de formato ao subir o motor de idioma —, e ela saiu quando o provedor
 * passou a negociar com o idioma do NAVEGADOR: um escritório brasileiro chega a `pt-BR` porque o
 * navegador dele diz `pt-BR`, e não porque o código decidiu por ele.
 */
export const ambientLocale = (): LocaleCode => ambient ?? DEFAULT_LOCALE;

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
