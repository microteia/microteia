import { useMemo } from 'react';
import type { PluginManifest } from '../../../domain/schema/plugin/pluginManifest';
import { packageMessageCatalog } from '../../../domain/schema/i18n/extensionPoints';
import type { MessageCatalog } from '../../../domain/schema/i18n/messages';
import { catalogWithFallback } from '../../../domain/schema/i18n/messages';
import { useOptionalLocale } from '../../../stores/useLocale';

/** Qualquer coisa que carregue um manifest — pacote de extensão, cópia instalada, tema do sistema. */
export interface PackageWithManifest {
  manifest: PluginManifest;
}

/**
 * O catálogo corrente com os textos que os PRÓPRIOS PACOTES declaram por baixo dele.
 *
 * Uma tela que lista extensões as mostra antes de instalá-las, e é aí que o motor de idioma não tinha
 * a quem perguntar: as contribuições `i18n.messages` de um pacote só chegam ao catálogo global depois
 * de instalado e ativo, então a lista exibia a chave crua no lugar do nome. O texto sempre esteve ali
 * — dentro do pacote —, e ler dali é o que fecha a lacuna.
 *
 * A precedência é deliberada: o catálogo do escritório VENCE, e o do pacote é só fallback. Assim um
 * pacote de tradução instalado continua sobrepondo os textos da extensão que ele traduz, em vez de
 * perder para o que a extensão embarcou.
 */
export const usePackageCatalog = (packages: PackageWithManifest[]): MessageCatalog => {
  const { catalog } = useOptionalLocale();
  return useMemo(() => {
    const contributions = packages.flatMap((pkg) => pkg.manifest.contributes ?? []);
    if (contributions.length === 0) return catalog;
    return catalogWithFallback(catalog, packageMessageCatalog(contributions, catalog.locale));
  }, [packages, catalog]);
};
