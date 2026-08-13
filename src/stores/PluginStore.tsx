import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PluginStoreContext } from './usePluginStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { MARKETPLACE_CATALOG } from '../plugins/marketplace/catalog';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { PluginInstallation } from '../domain/entities/PluginInstallation';
import type { PublishedPlugin } from '../domain/repositories/IPluginRegistryRepository';
import type { PluginDiagnostic } from '../domain/schema/plugin/diagnostics';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';
import { mergeCatalog, pluginSourceOf } from '../domain/usecases/plugins/mergeCatalog';
import { makePublishPluginUseCase } from '../domain/usecases/plugins/PublishPluginUseCase';
import { useKernel } from './useKernel';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { parsePackage } from '../domain/usecases/plugins/packageSerialization';
import { packageSizeIssues, validatePackage } from '../domain/usecases/plugins/pluginReferences';
import { validatePluginManifest } from '../domain/schema/plugin/pluginManifest';
import type { ImportPackageResult, PluginSource } from './usePluginStore';
import type { LifecycleActor } from '../domain/services/pluginLifecycle';
import {
  makeInstallMarketplacePluginUseCase,
  makeUninstallMarketplacePluginUseCase,
  makeUpgradeMarketplacePluginUseCase,
} from '../domain/usecases/plugins/MarketplaceInstallUseCases';
import {
  makeDisablePluginUseCase,
  makeEnablePluginUseCase,
} from '../domain/usecases/plugins/PluginLifecycleUseCases';

export const PluginStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, userRole } = useAuth();
  const { host } = useKernel();
  const {
    workflowDefinitionRepository,
    pluginInstallationRepository,
    pluginRegistryRepository,
    screenDefinitionRepository,
    actionRepository,
    scriptRepository,
    lookupDefinitionRepository,
    lookupRepository,
    tagDefinitionRepository,
  } = useDI();

  const [installations, setInstallations] = useState<PluginInstallation[]>([]);
  const [published, setPublished] = useState<PublishedPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const canPublish = userRole === 'SYSTEM';

  const uc = useMemo(() => {
    const deps = {
      workflowRepository: workflowDefinitionRepository,
      installationRepository: pluginInstallationRepository,
      screenRepository: screenDefinitionRepository,
      actionRepository,
      scriptRepository,
      lookupDefinitionRepository,
      lookupRepository,
      tagDefinitionRepository,
    };
    return {
      install: makeInstallMarketplacePluginUseCase(deps),
      upgrade: makeUpgradeMarketplacePluginUseCase(deps),
      uninstall: makeUninstallMarketplacePluginUseCase(deps),
      enable: makeEnablePluginUseCase(pluginInstallationRepository),
      disable: makeDisablePluginUseCase(pluginInstallationRepository),
    };
  }, [workflowDefinitionRepository, pluginInstallationRepository, screenDefinitionRepository, actionRepository, scriptRepository, lookupDefinitionRepository, lookupRepository, tagDefinitionRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar estado local na troca de tenant é exigência arquitetural
      setInstallations([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = pluginInstallationRepository.subscribe(currentTenant.id, (list) => {
      setInstallations(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, pluginInstallationRepository]);

  useEffect(() => {
    const unsubscribe = pluginRegistryRepository.subscribe(setPublished);
    return () => unsubscribe();
  }, [pluginRegistryRepository]);

  const actorNow = useCallback((): LifecycleActor | null => {
    if (!currentTenant || !user) return null;
    return { tenantId: currentTenant.id, userId: user.id, now: new Date() };
  }, [currentTenant, user]);

  const install = useCallback(
    async (plugin: MarketplacePlugin) => {
      const actor = actorNow();
      if (!actor) return null;
      const result = await uc.install.execute(plugin, actor);
      if (result.ok) {
        storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
        storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
      }
      return result.ok ? null : result.error;
    },
    [actorNow, uc.install],
  );

  const uninstall = useCallback(
    async (pluginId: string) => {
      const actor = actorNow();
      if (!actor) return null;
      const result = await uc.uninstall.execute(pluginId, actor);
      if (!('error' in result)) {
        storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
        storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
      }
      return 'error' in result ? result.error : null;
    },
    [actorNow, uc.uninstall],
  );

  const upgrade = useCallback(
    async (plugin: MarketplacePlugin) => {
      const actor = actorNow();
      if (!actor) return null;
      const result = await uc.upgrade.execute(plugin, actor);
      if (result.ok) {
        storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
        storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
      }
      return result.ok ? null : result.error;
    },
    [actorNow, uc.upgrade],
  );

  const importPackage = useCallback(
    async (text: string): Promise<ImportPackageResult> => {
      const parsed = parsePackage(text);
      if (!parsed.ok) return { ok: false, error: parsed.error };
      const pkg = parsed.package;
      const manifestErrors = validatePluginManifest(pkg.manifest, {
        kernelVersion: KERNEL_VERSION,
        validateContributions: false,
      });
      const refErrors = validatePackage(pkg);
      const sizeErrors = packageSizeIssues(pkg);
      if (manifestErrors.length > 0 || refErrors.length > 0 || sizeErrors.length > 0) {
        return {
          ok: false,
          error: manifestErrors[0]?.message ?? refErrors[0]?.message ?? sizeErrors[0],
        };
      }
      const alreadyInstalled = installations.some((i) => i.pluginId === pkg.manifest.id);
      const error = alreadyInstalled ? await upgrade(pkg) : await install(pkg);
      if (error) return { ok: false, error: error.message };
      // Um pacote importado avulso não entra no catálogo, então suas views de CÓDIGO não executam:
      // só código de fonte confiável (publicado por um SYSTEM, ou embutido) roda. Os dados foram
      // instalados; a tela em código fica inerte até a extensão ser publicada no catálogo.
      const note = (pkg.views?.length ?? 0) > 0
        ? 'Esta extensão traz uma tela em código, que só será executada após ser publicada no catálogo por um administrador do sistema. Os dados foram instalados normalmente.'
        : undefined;
      return { ok: true, name: pkg.manifest.name || pkg.manifest.id, action: alreadyInstalled ? 'upgraded' : 'installed', note };
    },
    [install, upgrade, installations],
  );

  const setEnabled = useCallback(
    async (pluginId: string, enabled: boolean) => {
      const actor = actorNow();
      if (!actor) return null;
      const result = await (enabled ? uc.enable : uc.disable).execute(pluginId, actor);
      return result.ok ? null : result.error;
    },
    [actorNow, uc.enable, uc.disable],
  );

  const installationOf = useCallback(
    (pluginId: string) => installations.find((installation) => installation.pluginId === pluginId),
    [installations],
  );

  // O registro é o que permite adicionar plugin sem deploy; os embutidos vêm no bundle e servem de
  // ponto de partida — publicá-los prova o ciclo publicar → vir do registro. Lógica em mergeCatalog.
  const catalog = useMemo<MarketplacePlugin[]>(
    () => mergeCatalog(published, MARKETPLACE_CATALOG),
    [published],
  );

  const sourceOf = useCallback(
    (pluginId: string): PluginSource => pluginSourceOf(published, pluginId),
    [published],
  );

  const publish = useCallback(
    async (plugin: MarketplacePlugin): Promise<PluginDiagnostic[]> => {
      if (!user) return [];
      const result = await makePublishPluginUseCase(pluginRegistryRepository).execute(plugin, user.id, {
        points: host.points.snapshot(),
        kernelVersion: KERNEL_VERSION,
      });
      return result.ok ? [] : result.errors;
    },
    [pluginRegistryRepository, user, host],
  );

  const unpublish = useCallback(
    (pluginId: string) => pluginRegistryRepository.unpublish(pluginId),
    [pluginRegistryRepository],
  );

  const value = useMemo(
    () => ({
      catalog,
      installations,
      isLoading,
      canPublish,
      installationOf,
      sourceOf,
      install,
      uninstall,
      setEnabled,
      importPackage,
      publish,
      unpublish,
    }),
    [catalog, installations, isLoading, canPublish, installationOf, sourceOf, install, uninstall, setEnabled, importPackage, publish, unpublish],
  );

  return <PluginStoreContext.Provider value={value}>{children}</PluginStoreContext.Provider>;
};
