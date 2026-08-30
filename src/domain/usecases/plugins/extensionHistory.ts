import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { ExtensionHistory, ExtensionHistoryEntry } from '../../entities/ExtensionHistory';
import { packageFingerprint } from './packageSerialization';

/**
 * Quantas versões o histórico de uma extensão guarda por escritório.
 *
 * Cada entrada carrega o pacote INTEIRO — até 800 KB pelo limite de importação —, então um histórico
 * sem teto acumularia dezenas de MB por extensão sem nada que avisasse: um pacote de tradução
 * atualizado toda semana chegaria lá em um ano. Dez cobre o arrependimento real e mantém o custo
 * previsível.
 */
export const EXTENSION_HISTORY_LIMIT = 10;

/**
 * A impressão do CONTEÚDO do pacote — a identidade de uma entrada do histórico, e o id do documento
 * que guarda o pacote dela. É o `packageFingerprint` reduzido a SHA-256 porque o fingerprint é o JSON
 * canônico inteiro: serve para comparar duas cópias em memória, não para nomear um documento.
 */
export const packageRevision = async (pkg: MarketplacePlugin): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(packageFingerprint(pkg)));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * O histórico já conhece esta revisão? É a pergunta que impede o item duplicado: reaplicar uma versão
 * que veio do próprio histórico não acrescenta nada — a entrada já está lá, com a data em que foi
 * aplicada pela primeira vez.
 */
export const historyHasRevision = (
  history: ExtensionHistory | null | undefined,
  revision: string,
): boolean => (history?.entries ?? []).some((entry) => entry.revision === revision);

/** O que fica no histórico e o que sai dele quando uma entrada nova chega. */
export interface PrunedHistory {
  entries: ExtensionHistoryEntry[];
  /** As que passaram do limite. O pacote de cada uma é apagado junto — senão o teto seria só da lista. */
  dropped: ExtensionHistoryEntry[];
}

/**
 * Acrescenta a entrada nova no topo e corta no limite. A ordem é a de aplicação, e não a das versões:
 * quem volta para a 1.2.0 depois da 2.0.0 quer encontrar a 2.0.0 no lugar de onde saiu.
 */
export const pruneHistory = (
  entries: readonly ExtensionHistoryEntry[],
  limit: number = EXTENSION_HISTORY_LIMIT,
): PrunedHistory => ({
  entries: entries.slice(0, limit),
  dropped: entries.slice(limit),
});
