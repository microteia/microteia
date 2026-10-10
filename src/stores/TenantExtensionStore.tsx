import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { TenantExtensionStoreContext, type ImportExtensionResult } from './useTenantExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { parsePackage } from '../domain/usecases/plugins/packageSerialization';
import { validatePluginPackage } from '../sdk/validate';
import type { TenantExtension, TenantExtensionOrigin } from '../domain/entities/TenantExtension';
import { authoringRefusal, importRefusal } from '../domain/usecases/plugins/extensionOrigin';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

export const TenantExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { tenantExtensionRepository, extensionHistoryRepository } = useDI();

  const [extensions, setExtensions] = useState<TenantExtension[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- limpar estado local na troca de tenant é exigência arquitetural
      setExtensions([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = tenantExtensionRepository.subscribe(currentTenant.id, (list) => {
      setExtensions(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, tenantExtensionRepository]);

  const extensionOf = useCallback(
    (id: string) => extensions.find((extension) => extension.id === id),
    [extensions],
  );

  /**
   * A gravação das duas portas de entrada. A origem é de QUEM chama — a tela de autoria grava
   * `authored`, a importação `imported` —, e cada porta recusa antes o que a outra deixou ali.
   */
  const write = useCallback(async (pkg: MarketplacePlugin, origin: TenantExtensionOrigin) => {
    if (!currentTenant || !user) return;
    const id = pkg.manifest.id;
    const existing = extensions.find((extension) => extension.id === id);
    const extension: TenantExtension = {
      id,
      tenantId: currentTenant.id,
      active: existing?.active ?? false,
      package: pkg,
      origin,
      createdBy: existing?.createdBy ?? user.id,
      createdByName: existing?.createdByName ?? user.displayName,
      createdByPhotoURL: existing?.createdByPhotoURL ?? user.photoURL,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await tenantExtensionRepository.upsert(currentTenant.id, extension);
    setExtensions((prev) =>
      existing ? prev.map((e) => (e.id === id ? extension : e)) : [...prev, extension],
    );
  }, [currentTenant, user, extensions, tenantExtensionRepository]);

  const saveExtension = useCallback(async (pkg: MarketplacePlugin) => {
    const refusal = authoringRefusal(extensions.find((extension) => extension.id === pkg.manifest.id));
    if (refusal) throw refusal;
    await write(pkg, 'authored');
  }, [extensions, write]);

  const importExtension = useCallback(async (text: string): Promise<ImportExtensionResult> => {
    const parsed = parsePackage(text);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const pkg = parsed.package;
    const [issue] = validatePluginPackage(pkg);
    if (issue) return { ok: false, error: issue.message, errorParams: issue.messageParams };
    const refusal = importRefusal(extensions.find((extension) => extension.id === pkg.manifest.id));
    if (refusal) return { ok: false, error: refusal.message, errorParams: refusal.messageParams };
    await write(pkg, 'imported');
    return { ok: true, name: pkg.manifest.name || pkg.manifest.id, package: pkg };
  }, [extensions, write]);

  const setActive = useCallback(async (id: string, active: boolean) => {
    if (!currentTenant) return;
    await tenantExtensionRepository.setActive(currentTenant.id, id, active);
    setExtensions((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
  }, [currentTenant, tenantExtensionRepository]);

  /**
   * EXCLUIR é o fim da extensão, e o histórico de versões aplicadas morre com ela — não sobra a quem
   * servir. É o oposto de DESINSTALAR, que só retira a cópia do escritório e preserva o histórico:
   * é dele que sai a última versão instalada, para quem se arrependeu de ter desinstalado.
   */
  const removeExtension = useCallback(async (id: string) => {
    if (!currentTenant) return;
    await extensionHistoryRepository.deleteAll(currentTenant.id, id);
    await tenantExtensionRepository.delete(currentTenant.id, id);
    setExtensions((prev) => prev.filter((e) => e.id !== id));
  }, [currentTenant, tenantExtensionRepository, extensionHistoryRepository]);

  const value = useMemo(
    () => ({ extensions, isLoading, saveExtension, importExtension, setActive, removeExtension, extensionOf }),
    [extensions, isLoading, saveExtension, importExtension, setActive, removeExtension, extensionOf],
  );

  return <TenantExtensionStoreContext.Provider value={value}>{children}</TenantExtensionStoreContext.Provider>;
};
