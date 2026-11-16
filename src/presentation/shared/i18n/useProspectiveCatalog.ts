import { useMemo } from 'react';
import { I18N_MESSAGES_POINT, messageBundlesOf } from '../../../domain/schema/i18n/extensionPoints';
import { DEFAULT_LOCALE, negotiateFromCandidates } from '../../../domain/schema/i18n/localeNegotiation';
import { buildMessageCatalog, localesOf, type MessageCatalog } from '../../../domain/schema/i18n/messages';
import { useOptionalLocale } from '../../../stores/useLocale';
import { useContributions } from '../../../stores/useKernel';
import type { PackageWithManifest } from './usePackageCatalog';

/**
 * O catálogo como ele ficará DEPOIS de estes pacotes serem instalados — com o idioma renegociado.
 *
 * `usePackageCatalog` não basta quando o pacote é o que TRAZ o idioma. O escritório novo nasce com
 * `i18n.locale` escolhido, mas o idioma em vigor é negociado contra o que está instalado: sem o pacote
 * de tradução, ele é o idioma-fonte, e acrescentar o pacote como fallback só acrescenta textos nesse
 * mesmo idioma. A tela que espera a instalação dele falaria inglês justamente enquanto o instala.
 *
 * O catálogo é REMONTADO, e não só completado: o idioma em vigor pode já ser o escolhido — basta um
 * texto qualquer nele viajar no bundle, como o dos Termos de Uso — com o resto preenchido pelo
 * idioma-fonte, e completar esse catálogo deixava o inglês do preenchimento vencer o português que
 * chegava. Remontado, vale a regra de `buildMessageCatalog`: o idioma mais específico sobrepõe, e no
 * mesmo idioma o do escritório vem antes e vence — um pacote de tradução já instalado continua
 * sobrepondo os textos da extensão que ele traduz, como em `usePackageCatalog`.
 */
export const useProspectiveCatalog = (packages: readonly PackageWithManifest[]): MessageCatalog => {
  const { catalog, preferred } = useOptionalLocale();
  const contributions = useContributions(I18N_MESSAGES_POINT);
  return useMemo(() => {
    const incoming = messageBundlesOf(packages
      .flatMap((pkg) => pkg.manifest.contributes ?? [])
      .filter((contribution) => contribution?.point === I18N_MESSAGES_POINT));
    if (incoming.length === 0) return catalog;
    const bundles = [...messageBundlesOf(contributions), ...incoming];
    const locale = negotiateFromCandidates(
      [preferred ?? catalog.locale],
      [...localesOf(bundles), DEFAULT_LOCALE],
      catalog.locale,
    );
    return buildMessageCatalog(bundles, locale);
  }, [packages, contributions, catalog, preferred]);
};
