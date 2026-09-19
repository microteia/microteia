import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { TenantExtensionStoreContext, type ImportExtensionResult } from './useTenantExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { parsePackage } from '../domain/usecases/plugins/packageSerialization';
import { validatePluginPackage } from '../sdk/validate';
import type { TenantExtension } from '../domain/entities/TenantExtension';
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

  const saveExtension = useCallback(async (pkg: MarketplacePlugin) => {
    if (!currentTenant || !user) return;
    const id = pkg.manifest.id;
    const existing = extensions.find((extension) => extension.id === id);
    const extension: TenantExtension = {
      id,
      tenantId: currentTenant.id,
      active: existing?.active ?? false,
      package: pkg,
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

  const importExtension = useCallback(async (text: string): Promise<ImportExtensionResult> => {
    const parsed = parsePackage(text);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    const pkg = parsed.package;
    const [issue] = validatePluginPackage(pkg);
    if (issue) return { ok: false, error: issue.message, errorParams: issue.messageParams };
    await saveExtension(pkg);
    return { ok: true, name: pkg.manifest.name || pkg.manifest.id, package: pkg };
  }, [saveExtension]);

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
