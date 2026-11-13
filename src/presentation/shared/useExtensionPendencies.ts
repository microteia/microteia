import { useMemo } from 'react';
import { useInstalledExtensions } from '../../stores/useInstalledExtensions';
import { usePublicExtensions } from '../../stores/usePublicExtensions';
import { useTenantExtensions } from '../../stores/useTenantExtensions';
import { useInstalledCodeTrust } from '../../stores/useExtensionCodeTrust';
import { usePluginDiagnostics } from '../../stores/useKernel';
import { useHttpConnections } from '../../stores/useHttpConnections';
import { useOptionalSettings } from '../../stores/useSettings';
import { HTTP_ALLOWED_HOSTS_SETTING } from '../../domain/schema/httpRequestSpec';
import { httpConnectionStatusesOf, officeHostsOf } from '../../domain/schema/httpConnectionRequirement';
import { hasExtensionUpdate } from '../../domain/usecases/plugins/extensionUpdates';
import { extensionHasCode } from '../../domain/usecases/plugins/extensionCodeTrust';
import { isExtensionBackendPending } from '../../domain/usecases/plugins/extensionBackendState';
import { isExtensionMigrationPending } from '../../domain/usecases/plugins/extensionMigrationState';
import { extensionPendencies, type ExtensionPendency } from '../../domain/usecases/plugins/extensionPendencies';
import { MARKETPLACE_CATALOG } from '../../plugins/marketplace/catalog';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';

/** Índice do catálogo embutido — as extensões de primeira parte que viajam no bundle. */
const BUILTIN_BY_ID = new Map<string, MarketplacePlugin>(
  MARKETPLACE_CATALOG.map((plugin) => [plugin.manifest.id, plugin]),
);

const NONE: readonly ExtensionPendency[] = [];

export interface ExtensionPendencies {
  /**
   * As origens da resposta já carregaram — as três da atualização e o hash da confiança de código.
   * Antes disso não há como distinguir "nada pendente" de "ainda não sei", e quem decide algo com base
   * na contagem precisa da diferença.
   */
  ready: boolean;
  /** Ids das cópias instaladas com atualização à espera — ativas ou não. É o gesto "Atualizar" da linha. */
  updateIds: ReadonlySet<string>;
  /** As pendências de uma cópia instalada; vazio para quem não deve nada (ou nem está instalada). */
  pendenciesOf: (id: string) => readonly ExtensionPendency[];
  /** Quantas cópias têm ao menos uma pendência. É o número do selo e o da aba "Pendentes". */
  pendingCount: number;
}

/**
 * O que as extensões instaladas neste escritório estão devendo — atualização, falha de carga, backend
 * que o Console ainda não criou, credencial de integração que falta, migração de dados, código à espera de revisão.
 *
 * O selo da barra lateral e o do alto da tela precisam da resposta ANTES de alguém abrir Extensões —
 * era esse o problema: a pendência existia e só quem entrasse na tela ficava sabendo. E o selo só
 * contava atualização: a extensão que não carregou por falta de dependência sumia do menu sem que
 * nada apontasse para onde consertá-la. Todas as origens já são providas acima do layout, então a
 * conta é derivada, sem consulta própria e sem contador a manter sincronizado.
 */
export const useExtensionPendencies = (): ExtensionPendencies => {
  const { installed, migrationStates, appliedBackend, isLoading: loadingInstalled } = useInstalledExtensions();
  const { extensions, isLoading: loadingAuthored } = useTenantExtensions();
  const { publicExtensions, isLoading: loadingPublic } = usePublicExtensions();
  const codeTrust = useInstalledCodeTrust();
  const diagnostics = usePluginDiagnostics();
  const { connections, known: connectionsKnown } = useHttpConnections();
  const storedOfficeHosts = useOptionalSettings()?.values.tenant[HTTP_ALLOWED_HOSTS_SETTING];

  const ready = !loadingInstalled && !loadingAuthored && !loadingPublic && codeTrust.ready;

  return useMemo(() => {
    const officeHosts = officeHostsOf(storedOfficeHosts);
    const authoredById = new Map(extensions.map((extension) => [extension.id, extension]));
    const approvedById = new Map(
      publicExtensions
        .filter((extension) => extension.status === 'approved')
        .map((extension) => [extension.domain, extension]),
    );
    const failedIds = new Set(
      diagnostics.flatMap((diagnostic) =>
        (diagnostic.severity === 'error' && diagnostic.pluginId ? [diagnostic.pluginId] : [])),
    );

    const updateIds = new Set<string>();
    const byId = new Map<string, ExtensionPendency[]>();

    for (const copy of installed) {
      const offeredVersions: string[] = [];
      const authored = authoredById.get(copy.id);
      if (authored) offeredVersions.push(authored.package.manifest.version);
      const approved = approvedById.get(copy.id);
      if (approved) offeredVersions.push(approved.version);

      const updateAvailable = hasExtensionUpdate(copy.installedVersion, copy.package, {
        offeredVersions,
        builtin: BUILTIN_BY_ID.get(copy.id) ?? null,
      });
      if (updateAvailable) updateIds.add(copy.id);

      const pendencies = extensionPendencies({
        active: copy.active,
        loadFailed: failedIds.has(copy.id),
        backendPending: isExtensionBackendPending(copy, appliedBackend),
        connectionPending: connectionsKnown && httpConnectionStatusesOf(
          copy.id, copy.package.manifest.contributes, connections, officeHosts,
        ).some((status) => status.state !== 'ok'),
        migrationPending: isExtensionMigrationPending(copy, migrationStates),
        // Enquanto o hash não termina, o conjunto de confiáveis é vazio por falha fechada — e não por
        // falta de revisão. Contar isso acenderia o selo em toda extensão com código a cada carga.
        codeAwaitingReview: codeTrust.ready
          && extensionHasCode(copy.package)
          && !codeTrust.trustedIds.has(copy.id),
        updateAvailable,
      });
      if (pendencies.length > 0) byId.set(copy.id, pendencies);
    }

    return {
      ready,
      updateIds,
      pendenciesOf: (id: string) => byId.get(id) ?? NONE,
      pendingCount: byId.size,
    };
  }, [installed, migrationStates, appliedBackend, extensions, publicExtensions, diagnostics, codeTrust, ready, connections, connectionsKnown, storedOfficeHosts]);
};
