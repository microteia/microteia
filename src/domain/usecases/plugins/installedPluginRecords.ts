import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { PluginInstallation } from '../../entities/PluginInstallation';
import type { PluginRecord } from '../../../kernel';
import { makeExtensionViewRef } from './extensionViewRef';

/**
 * Traduz o que o escritório tem INSTALADO E HABILITADO em `PluginRecord`s para o host de tenant.
 * As contribuições de UI de um plugin instalado não são persistidas: são derivadas de
 * `(instalação habilitada ∩ catálogo)` a cada mudança, então ativar/desativar um plugin liga/desliga
 * seu menu e suas páginas ao vivo.
 *
 * **Confiança = pertencer ao catálogo.** O catálogo é `publicados ∪ embutidos` — ambos canais de
 * SYSTEM/bundle. Uma instalação avulsa (`.json` importado, nunca publicado) não está no catálogo,
 * então é ignorada aqui: seus dados materializados existem, mas suas contribuições/views NÃO são
 * carregadas. É esse filtro que impede um pacote não publicado de executar código.
 *
 * Plugin **sem `views`** continua `trusted: false` — páginas `widget`/`workflow` seguem funcionando
 * sem privilégio de código. Plugin **com `views`** (só possível vindo do catálogo confiável) é
 * `trusted: true` e recebe uma tabela `implementations` de marcadores `ExtensionViewRef`, que a
 * apresentação avalia sob demanda. O Kernel nunca vê o componente, só a chave.
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
    .map((plugin) => {
      const views = plugin.views ?? [];
      if (views.length === 0) return { manifest: plugin.manifest, trusted: false };
      const implementations = Object.fromEntries(
        views.map((view) => [view.key, makeExtensionViewRef(plugin.manifest.id, view.key, view.source)]),
      );
      return { manifest: plugin.manifest, trusted: true, implementations };
    });
};
