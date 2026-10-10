import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { LocalizedIssue } from './pluginReferences';

/**
 * O teto da imagem da extensão, medido sobre o `data:` URI inteiro — que é o que ocupa o pacote.
 * Um logotipo de lista não precisa de mais, e o pacote todo cabe num documento do Firestore.
 */
export const EXTENSION_IMAGE_MAX_BYTES = 64 * 1024;

const IMAGE_DATA_URI = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

export const isExtensionImage = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= EXTENSION_IMAGE_MAX_BYTES && IMAGE_DATA_URI.test(value);

/**
 * Recusa a imagem que a tela não desenharia. SVG entra porque ela é desenhada por `<img>`, onde o
 * navegador não executa script nenhum do arquivo.
 */
export const packageImageIssues = (pkg: MarketplacePlugin): LocalizedIssue[] => {
  const image: unknown = pkg.manifest?.image;
  if (image === undefined) return [];
  if (typeof image !== 'string' || !IMAGE_DATA_URI.test(image)) {
    return [{ message: '@core.marketplace/issue.package.image.invalid' }];
  }
  if (image.length > EXTENSION_IMAGE_MAX_BYTES) {
    return [{
      message: '@core.marketplace/issue.package.image.too-large',
      messageParams: {
        size: String(Math.ceil(image.length / 1024)),
        limit: String(EXTENSION_IMAGE_MAX_BYTES / 1024),
      },
    }];
  }
  return [];
};
