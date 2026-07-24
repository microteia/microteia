import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PluginRecord } from '../../../kernel';
import { makeExtensionViewRef } from './extensionViewRef';

/**
 * Converte o pacote de uma extensão em um `PluginRecord` do Kernel. Com `views`, é `trusted: true` e
 * recebe os marcadores `ExtensionViewRef` (avaliados sob demanda pela apresentação); sem `views`,
 * `trusted: false` — nav/telas de dados seguem sem código. Base de `installedExtensionRecords`
 * (cópias ativas de fonte confiável: catálogo aprovado ou a privada do próprio autor — self-trust).
 */
export const extensionRecordFrom = (pkg: MarketplacePlugin): PluginRecord => {
  const views = pkg.views ?? [];
  if (views.length === 0) return { manifest: pkg.manifest, trusted: false };
  const implementations = Object.fromEntries(
    views.map((view) => [view.key, makeExtensionViewRef(pkg.manifest.id, view.key, view.source)]),
  );
  return { manifest: pkg.manifest, trusted: true, implementations };
};
