import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { TenantExtensionStoreContext } from './useTenantExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import type { TenantExtension } from '../domain/entities/TenantExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

export const TenantExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { tenantExtensionRepository } = useDI();

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
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await tenantExtensionRepository.upsert(currentTenant.id, extension);
    setExtensions((prev) =>
      existing ? prev.map((e) => (e.id === id ? extension : e)) : [...prev, extension],
    );
  }, [currentTenant, user, extensions, tenantExtensionRepository]);

  const setActive = useCallback(async (id: string, active: boolean) => {
    if (!currentTenant) return;
    await tenantExtensionRepository.setActive(currentTenant.id, id, active);
    setExtensions((prev) => prev.map((e) => (e.id === id ? { ...e, active } : e)));
  }, [currentTenant, tenantExtensionRepository]);

  const removeExtension = useCallback(async (id: string) => {
    if (!currentTenant) return;
    await tenantExtensionRepository.delete(currentTenant.id, id);
    setExtensions((prev) => prev.filter((e) => e.id !== id));
  }, [currentTenant, tenantExtensionRepository]);

  const value = useMemo(
    () => ({ extensions, isLoading, saveExtension, setActive, removeExtension, extensionOf }),
    [extensions, isLoading, saveExtension, setActive, removeExtension, extensionOf],
  );

  return <TenantExtensionStoreContext.Provider value={value}>{children}</TenantExtensionStoreContext.Provider>;
};
