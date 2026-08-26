import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

declare global {
  interface Window {
    __MICROTEIA_EXTENSIONS__?: unknown;
  }
}

/**
 * As extensões da INSTALAÇÃO, carimbadas por `microteia deploy` num arquivo ao lado do
 * `firebase-config.js`.
 *
 * Existem porque a tela de entrada roda ACIMA do escritório: não há tenant, então não há como ler o
 * que um escritório instalou — e era esse o vão que deixava o SSO fora de alcance. O que se pode ler
 * antes do login é o que veio carimbado na instalação, e quem carimba é quem instala.
 *
 * A leitura é DESCONFIADA de ponta a ponta. O arquivo é gerado pelo nosso Console, mas um deploy
 * interrompido, uma edição à mão ou um cache antigo produzem exatamente o mesmo tipo de arquivo pela
 * metade — e este é o primeiro código que roda na página: aqui, uma exceção é a tela branca.
 */
const isPackage = (value: unknown): value is MarketplacePlugin => {
  if (!value || typeof value !== 'object') return false;
  const manifest = (value as { manifest?: unknown }).manifest;
  if (!manifest || typeof manifest !== 'object') return false;
  const { id, version, contributes } = manifest as Record<string, unknown>;
  return typeof id === 'string' && id !== ''
    && typeof version === 'string' && version !== ''
    && Array.isArray(contributes);
};

/**
 * Separada da leitura do `window` de propósito: é aqui que está toda a decisão, e é aqui que ela
 * precisa ser testável sem um navegador. `readStampedExtensions` é só de onde o valor vem.
 */
export const parseStampedExtensions = (stamped: unknown): MarketplacePlugin[] =>
  Array.isArray(stamped) ? stamped.filter(isPackage) : [];

export const readStampedExtensions = (): MarketplacePlugin[] =>
  parseStampedExtensions(typeof window === 'undefined' ? undefined : window.__MICROTEIA_EXTENSIONS__);
