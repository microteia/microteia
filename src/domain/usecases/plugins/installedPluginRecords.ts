import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import type { PluginRecord } from '../../../kernel';

/**
 * Traduz o que o escritório tem INSTALADO E HABILITADO em `PluginRecord`s para o host de tenant.
 * As contribuições de UI de um plugin instalado não são persistidas: são derivadas de
 * `(instalação habilitada ∩ catálogo)` a cada mudança, então ativar/desativar um plugin liga/desliga
 * seu menu e suas páginas ao vivo.
 *
 * `trusted: false` sempre — plugin instalado é terceiro: o `PluginHost` recusa `impl: code` e só
 * aceita `widget`/`workflow`/`nav`. Instalação cujo manifest sumiu do catálogo (despublicado depois)
 * é ignorada, pois não há como reconstruir suas contribuições.
 */
export const installedPluginRecords = (
  catalog: MarketplacePlugin[],
  installations: PluginInstallation[],
): PluginRecord[] => {
  const enabledIds = new Set(
    installations.filter((installation) => installation.enabled).map((installation) => installation.pluginId),
  );

  return catalog
    .filter((plugin) => enabledIds.has(plugin.manifest.id))
    .map((plugin) => ({ manifest: plugin.manifest, trusted: false }));
};
