import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PluginStoreContext } from './usePluginStore';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { MARKETPLACE_CATALOG } from '../plugins/marketplace/catalog';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { PluginInstallation } from '../domain/entities/PluginInstallation';
import type { LifecycleActor } from '../domain/services/pluginLifecycle';
import {
  makeInstallMarketplacePluginUseCase,
  makeUninstallMarketplacePluginUseCase,
} from '../domain/usecases/plugins/MarketplaceInstallUseCases';
import {
  makeDisablePluginUseCase,
  makeEnablePluginUseCase,
} from '../domain/usecases/plugins/PluginLifecycleUseCases';

export const PluginStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { workflowDefinitionRepository, pluginInstallationRepository } = useDI();

  const [installations, setInstallations] = useState<PluginInstallation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => {
    const deps = {
      workflowRepository: workflowDefinitionRepository,
      installationRepository: pluginInstallationRepository,
    };
    return {
      install: makeInstallMarketplacePluginUseCase(deps),
      uninstall: makeUninstallMarketplacePluginUseCase(deps),
      enable: makeEnablePluginUseCase(pluginInstallationRepository),
      disable: makeDisablePluginUseCase(pluginInstallationRepository),
    };
  }, [workflowDefinitionRepository, pluginInstallationRepository]);

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

  const actorNow = useCallback((): LifecycleActor | null => {
    if (!currentTenant || !user) return null;
    return { tenantId: currentTenant.id, userId: user.id, now: new Date() };
  }, [currentTenant, user]);

  const install = useCallback(
    async (plugin: MarketplacePlugin) => {
      const actor = actorNow();
      if (!actor) return null;
      const result = await uc.install.execute(plugin, actor);
      return result.ok ? null : result.error;
    },
    [actorNow, uc.install],
  );

  const uninstall = useCallback(
    async (pluginId: string) => {
      const actor = actorNow();
      if (!actor) return null;
      const result = await uc.uninstall.execute(pluginId, actor);
      return 'error' in result ? result.error : null;
    },
    [actorNow, uc.uninstall],
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

  const value = useMemo(
    () => ({
      catalog: MARKETPLACE_CATALOG,
      installations,
      isLoading,
      installationOf,
      install,
      uninstall,
      setEnabled,
    }),
    [installations, isLoading, installationOf, install, uninstall, setEnabled],
  );

  return <PluginStoreContext.Provider value={value}>{children}</PluginStoreContext.Provider>;
};
