import { parseStampedBrand, type InstallationBrand } from '../../domain/schema/brand';

declare global {
  interface Window {
    __MICROTEIA_BRAND__?: unknown;
  }
}

/**
 * A identidade da INSTALAÇÃO, carimbada por `microteia deploy` em `brand.js`, ao lado do
 * `firebase-config.js`. Lida uma vez: o arquivo é um `<script>` síncrono no `<head>`, então o valor
 * já está no `window` antes do bundle, e não muda enquanto a página está aberta.
 */
let cached: InstallationBrand | null | undefined;

export const readStampedBrand = (): InstallationBrand | null => {
  if (cached === undefined) {
    cached = parseStampedBrand(typeof window === 'undefined' ? undefined : window.__MICROTEIA_BRAND__);
  }
  return cached;
};
