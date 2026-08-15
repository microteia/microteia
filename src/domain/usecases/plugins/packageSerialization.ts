import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';

/** Serializa o pacote para download — JSON indentado, estável para versionar e reimportar. */
export const serializePackage = (pkg: MarketplacePlugin): string => JSON.stringify(pkg, null, 2);

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
};

/**
 * Identidade de CONTEÚDO do pacote: serialização com chaves ordenadas, para comparar duas cópias do
 * mesmo pacote independentemente da ordem em que as propriedades chegaram.
 *
 * A ordem importa porque a cópia instalada dá uma volta pelo Firestore, que guarda mapas com as
 * chaves ordenadas e descarta `undefined` — um `JSON.stringify` direto contra o pacote em memória
 * NUNCA bate, e quem compara os dois conclui que há atualização a cada render.
 */
export const packageFingerprint = (pkg: MarketplacePlugin): string => JSON.stringify(canonical(pkg));

export type ParsePackageResult =
  | { ok: true; package: MarketplacePlugin }
  | { ok: false; error: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Faz o parse de um `.json` importado e confere a forma mínima de um `MarketplacePlugin` — sem
 * validar integridade referencial nem o manifest, que ficam a cargo de `validatePackage` e
 * `validatePluginManifest` (a MESMA checagem do lado da autoria). Nunca lança: todo problema
 * vira `error` legível.
 */
export const parsePackage = (text: string): ParsePackageResult => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: '@core.marketplace/issue.package.not-json' };
  }
  if (!isObject(parsed)) return { ok: false, error: '@core.marketplace/issue.package.not-object' };
  if (!isObject(parsed.manifest) || typeof parsed.manifest.id !== 'string') {
    return { ok: false, error: '@core.marketplace/issue.package.no-manifest' };
  }
  if (!Array.isArray(parsed.workflows)) {
    return { ok: false, error: '@core.marketplace/issue.package.no-workflows' };
  }
  if (typeof parsed.summary !== 'string') {
    return { ok: false, error: '@core.marketplace/issue.package.no-summary' };
  }
  return { ok: true, package: parsed as unknown as MarketplacePlugin };
};
