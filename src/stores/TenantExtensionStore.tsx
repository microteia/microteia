import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { TenantExtensionStoreContext, type ImportExtensionResult } from './useTenantExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { parsePackage } from '../domain/usecases/plugins/packageSerialization';
import { validatePackage } from '../domain/usecases/plugins/pluginReferences';
import { validatePluginManifest } from '../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';
import type { TenantExtension } from '../domain/entities/TenantExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { PublicExtension } from '../domain/entities/PublicExtension';

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
    const manifestErrors = validatePluginManifest(pkg.manifest, { kernelVersion: KERNEL_VERSION, validateContributions: false });
    const refErrors = validatePackage(pkg);
    if (manifestErrors.length > 0 || refErrors.length > 0) {
      return { ok: false, error: manifestErrors[0]?.message ?? refErrors[0].message };
    }
    await saveExtension(pkg);
    return { ok: true, name: pkg.manifest.name || pkg.manifest.id };
  }, [saveExtension]);

  const installFromPublic = useCallback(async (pub: PublicExtension) => {
    if (!currentTenant || !user) return;
    const existing = extensions.find((e) => e.id === pub.domain);
    // Cópia independente: se o dono depois apagar/obsoletar a pública, esta cópia continua aqui.
    // `createdByName/photo` guardam o AUTOR original (atribuição); `createdBy` é quem instalou.
    const extension: TenantExtension = {
      id: pub.domain,
      tenantId: currentTenant.id,
      active: existing?.active ?? true,
      package: pub.package,
      sourcePluginId: pub.domain,
      sourceVersion: pub.version,
      createdBy: existing?.createdBy ?? user.id,
      createdByName: pub.ownerName,
      createdByPhotoURL: pub.ownerPhotoURL,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await tenantExtensionRepository.upsert(currentTenant.id, extension);
    setExtensions((prev) =>
      existing ? prev.map((e) => (e.id === pub.domain ? extension : e)) : [...prev, extension],
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
    () => ({ extensions, isLoading, saveExtension, importExtension, installFromPublic, setActive, removeExtension, extensionOf }),
    [extensions, isLoading, saveExtension, importExtension, installFromPublic, setActive, removeExtension, extensionOf],
  );

  return <TenantExtensionStoreContext.Provider value={value}>{children}</TenantExtensionStoreContext.Provider>;
};
