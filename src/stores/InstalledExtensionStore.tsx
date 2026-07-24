import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { InstalledExtensionStoreContext, type InstallExtensionInput } from './useInstalledExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { applyPackageArtifacts, releasePackageArtifacts, type ArtifactDeps } from '../domain/usecases/plugins/MarketplaceInstallUseCases';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import type { InstalledExtension } from '../domain/entities/InstalledExtension';

// Telas usam refresh por evento (não assinam onSnapshot ao vivo como workflows/actions/scripts).
// Sem estes emits, uma tela materializada na instalação não aparece no Form Design nem no menu.
const notifyArtifactStores = (): void => {
  storeEvents.emit(StoreEvents.SCREEN_DEFINITIONS_UPDATED);
  storeEvents.emit(StoreEvents.ACTIONS_UPDATED);
};

export const InstalledExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const {
    installedExtensionRepository,
    screenDefinitionRepository,
    workflowDefinitionRepository,
    scriptRepository,
    actionRepository,
  } = useDI();

  const artifactDeps = useMemo<ArtifactDeps>(
    () => ({
      screenRepository: screenDefinitionRepository,
      workflowRepository: workflowDefinitionRepository,
      scriptRepository,
      actionRepository,
    }),
    [screenDefinitionRepository, workflowDefinitionRepository, scriptRepository, actionRepository],
  );

  const [installed, setInstalled] = useState<InstalledExtension[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar estado local na troca de tenant é exigência arquitetural
      setInstalled([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = installedExtensionRepository.subscribe(currentTenant.id, (list) => {
      setInstalled(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, installedExtensionRepository]);

  const installedOf = useCallback(
    (id: string) => installed.find((extension) => extension.id === id),
    [installed],
  );

  const install = useCallback(async (input: InstallExtensionInput) => {
    if (!currentTenant || !user) return;
    const id = input.package.manifest.id;
    const existing = installed.find((extension) => extension.id === id);
    // Cópia independente e fiel: preserva apenas o estado local `active`; todo o resto vem da fonte.
    const extension: InstalledExtension = {
      id,
      tenantId: currentTenant.id,
      active: existing?.active ?? true,
      package: input.package,
      source: input.source,
      installedVersion: input.version,
      authorId: input.authorId,
      authorName: input.authorName,
      authorPhotoURL: input.authorPhotoURL,
      installedBy: existing?.installedBy ?? user.id,
      installedAt: existing?.installedAt ?? new Date(),
      updatedAt: new Date(),
    };
    // Materializa os artefatos de DADOS (telas/actions/workflows/scripts) da cópia no tenant, antes de
    // gravar o registro — se falhar, nada fica "instalado". Idempotente: reinstalar/atualizar reusa por
    // sourceId. Código-only (ex.: Kanban) = no-op barato. As telas/menus surgem via os stores de dados.
    await applyPackageArtifacts(artifactDeps, input.package, { tenantId: currentTenant.id, userId: user.id, now: new Date() });
    await installedExtensionRepository.upsert(currentTenant.id, extension);
    notifyArtifactStores();
    setInstalled((prev) =>
      existing ? prev.map((e) => (e.id === id ? extension : e)) : [...prev, extension],
    );
  }, [currentTenant, user, installed, installedExtensionRepository, artifactDeps]);

  const setActive = useCallback(async (id: string, active: boolean) => {
    if (!currentTenant) return;
    await installedExtensionRepository.setActive(currentTenant.id, id, active);
    setInstalled((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
  }, [currentTenant, installedExtensionRepository]);

  const uninstall = useCallback(async (id: string) => {
    if (!currentTenant || !user) return;
    // Libera (refcount) os artefatos de dados: só apaga o que nenhuma outra extensão usa. Os registros
    // das telas removidas ficam órfãos (estrutura some, dados ficam). Depois remove o registro da cópia.
    await releasePackageArtifacts(artifactDeps, id, { tenantId: currentTenant.id, userId: user.id, now: new Date() });
    await installedExtensionRepository.delete(currentTenant.id, id);
    notifyArtifactStores();
    setInstalled((prev) => prev.filter((e) => e.id !== id));
  }, [currentTenant, user, installedExtensionRepository, artifactDeps]);

  const value = useMemo(
    () => ({ installed, isLoading, install, setActive, uninstall, installedOf }),
    [installed, isLoading, install, setActive, uninstall, installedOf],
  );

  return <InstalledExtensionStoreContext.Provider value={value}>{children}</InstalledExtensionStoreContext.Provider>;
};
