import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Publicar não é o mesmo que SERVIR.
 *
 * O `index.html` de um SPA aponta para um bundle com hash no nome, e o Firebase o serve com
 * `max-age=3600` quando a configuração não diz nada — então, por uma hora depois de um deploy, um
 * navegador que já esteve no site recebe o HTML ANTIGO, que aponta para o bundle antigo, que está
 * cacheado como `immutable`. O resultado é a aplicação continuar rodando a versão anterior, com o
 * deploy tendo terminado em sucesso: o rodapé mostra uma versão que não é a instalada, e não há nada
 * na saída do deploy que explique isso.
 *
 * A verificação compara o bundle que o pacote instalou com o que a URL de verdade devolve, pelo mesmo
 * caminho do navegador. É a irmã de `callableAccess`: uma confere se o servidor responde, esta confere
 * se o cliente recebe.
 */
export type HostingServed = 'current' | 'stale' | 'unknown';

export interface HostingCheck {
  served: HostingServed;
  packagedBundle: string | null;
  servedBundle: string | null;
  /** `Cache-Control` do HTML. Um `max-age` longo aqui é o que faz um deploy demorar a aparecer. */
  htmlCacheControl: string | null;
}

const BUNDLE_PATTERN = /assets\/index-[A-Za-z0-9_-]+\.js/;

export const bundleReferenceIn = (html: string): string | null => html.match(BUNDLE_PATTERN)?.[0] ?? null;

/**
 * Um `max-age` maior que zero no HTML é o bastante para atrasar a versão nova. `no-cache` e
 * `no-store` são as duas formas de dizer "revalide sempre", e qualquer uma delas está correta.
 */
export const htmlIsRevalidated = (cacheControl: string | null): boolean => {
  if (cacheControl === null) return false;
  const value = cacheControl.toLowerCase();
  if (value.includes('no-cache') || value.includes('no-store')) return true;
  const maxAge = value.match(/max-age=(\d+)/);
  return maxAge !== null && Number.parseInt(maxAge[1], 10) === 0;
};

export const checkHostingServed = async (
  install: string,
  origin: string,
): Promise<HostingCheck> => {
  const packagedBundle = await readFile(join(install, 'hosting', 'index.html'), 'utf8')
    .then(bundleReferenceIn)
    .catch(() => null);

  try {
    const response = await fetch(`${origin}/index.html`, {
      // O objetivo é ver o que a origem serve, então nada de cache intermediário nosso.
      headers: { 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await response.text();
    const servedBundle = bundleReferenceIn(html);
    const htmlCacheControl = response.headers.get('cache-control');

    return {
      served: servedBundle === null || packagedBundle === null
        ? 'unknown'
        : servedBundle === packagedBundle ? 'current' : 'stale',
      packagedBundle,
      servedBundle,
      htmlCacheControl,
    };
  } catch {
    // Rede indisponível ou proxy no caminho: avisa sem acusar, como a verificação das callables.
    return { served: 'unknown', packagedBundle, servedBundle: null, htmlCacheControl: null };
  }
};
