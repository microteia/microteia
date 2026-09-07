import { useMemo } from 'react';
import { useInstalledExtensions } from '../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../stores/usePublicExtensions';
import { useTenantExtensions } from '../../stores/useTenantExtensions';
import { hasExtensionUpdate } from '../../domain/usecases/plugins/extensionUpdates';
import { MARKETPLACE_CATALOG } from '../../plugins/marketplace/catalog';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

/** Índice do catálogo embutido — as extensões de primeira parte que viajam no bundle. */
const BUILTIN_BY_ID = new Map<string, MarketplacePlugin>(
  MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.id, plugin]),
);

export interface ExtensionUpdates {
  /**
   * As três origens da resposta já carregaram. Antes disso não há como distinguir "nada a atualizar"
   * de "ainda não sei", e quem decide algo com base na contagem precisa da diferença.
   */
  ready: boolean;
  /** Ids das cópias instaladas com atualização à espera — ativas ou não. */
  pendingIds: ReadonlySet<string>;
  /**
   * Quantas dessas cópias estão EM USO, isto é, instaladas E ativas. É o número do selo: uma extensão
   * desligada não faz nada no escritório, e cobrar atenção por ela seria pedir um gesto que não muda
   * nada.
   */
  pendingInUse: number;
}

/**
 * As atualizações de extensão à espera neste escritório.
 *
 * O selo da barra lateral e o do alto da tela precisam da resposta ANTES de alguém abrir Extensões —
 * era esse o problema: a atualização existia e só quem entrasse na tela ficava sabendo. As três
 * origens (instaladas, autoria privada, catálogo público) já são providas acima do layout, então a
 * conta é derivada, sem consulta própria e sem contador a manter sincronizado.
 */
export const useExtensionUpdates = (): ExtensionUpdates => {
  const { installed, isLoading: loadingInstalled } = useInstalledExtensions();
  const { extensions, isLoading: loadingAuthored } = useTenantExtensions();
  const { publicExtensions, isLoading: loadingPublic } = usePublicExtensions();

  const ready = !loadingInstalled && !loadingAuthored && !loadingPublic;

  return useMemo(() => {
    const authoredById = new Map(extensions.map((extension) => [extension.id, extension]));
    const approvedById = new Map(
      publicExtensions
        .filter((extension) => extension.status === 'approved')
        .map((extension) => [extension.domain, extension]),
    );

    const pendingIds = new Set<string>();
    let pendingInUse = 0;

    for (const copy of installed) {
      const offeredVersions: string[] = [];
      const authored = authoredById.get(copy.id);
      if (authored) offeredVersions.push(authored.package.manifest.version);
      const approved = approvedById.get(copy.id);
      if (approved) offeredVersions.push(approved.version);

      const pending = hasExtensionUpdate(copy.installedVersion, copy.package, {
        offeredVersions,
        builtin: BUILTIN_BY_ID.get(copy.id) ?? null,
      });
      if (!pending) continue;

      pendingIds.add(copy.id);
      if (copy.active) pendingInUse += 1;
    }

    return { ready, pendingIds, pendingInUse };
  }, [installed, extensions, publicExtensions, ready]);
};
