import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PublicExtensionStoreContext, type PublishPublicResult } from './usePublicExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { extensionHasCode, initialPublicStatus, isVersionGreater } from '../domain/usecases/plugins/publicExtension';
import { isValidSemVer } from '../domain/schema/plugin/semver';
import type { PublicExtension } from '../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

export const PublicExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { publicExtensionRepository } = useDI();

  const [publicExtensions, setPublicExtensions] = useState<PublicExtension[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // isLoading já inicia true; a assinatura zera ao chegar o primeiro snapshot (setState em callback,
    // não no corpo do efeito — evita renders em cascata).
    const unsubscribe = publicExtensionRepository.subscribe((list) => {
      setPublicExtensions(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [publicExtensionRepository]);

  const publicOf = useCallback(
    (domain: string) => publicExtensions.find((p) => p.domain === domain),
    [publicExtensions],
  );

  const publish = useCallback(async (pkg: MarketplacePlugin): Promise<PublishPublicResult> => {
    if (!currentTenant || !user) return { ok: false, error: 'Sem escritório ou usuário.' };
    const domain = pkg.manifest.id;
    const version = pkg.manifest.version;
    if (!isValidSemVer(version)) return { ok: false, error: `A versão "${version}" não é válida.` };

    const existing = publicExtensions.find((p) => p.domain === domain);
    if (existing) {
      if (existing.ownerTenantId !== currentTenant.id) {
        return { ok: false, error: 'Este domínio já foi publicado por outro escritório.' };
      }
      if (!isVersionGreater(version, existing.version)) {
        return { ok: false, error: `A versão ${version} precisa ser maior que a publicada (${existing.version}). Suba a versão em Editar antes de publicar.` };
      }
    }

    const status = initialPublicStatus(pkg);
    await publicExtensionRepository.publish({
      package: pkg,
      ownerTenantId: currentTenant.id,
      ownerName: user.displayName,
      ownerPhotoURL: user.photoURL,
      version,
      status,
      hasCode: extensionHasCode(pkg),
      publishedBy: user.id,
    });
    return { ok: true, status };
  }, [currentTenant, user, publicExtensions, publicExtensionRepository]);

  const approve = useCallback((domain: string) => publicExtensionRepository.setStatus(domain, 'approved'), [publicExtensionRepository]);
  const deprecate = useCallback((domain: string) => publicExtensionRepository.setStatus(domain, 'deprecated'), [publicExtensionRepository]);
  const unpublish = useCallback((domain: string) => publicExtensionRepository.delete(domain), [publicExtensionRepository]);

  const value = useMemo(
    () => ({ publicExtensions, isLoading, publish, approve, deprecate, unpublish, publicOf }),
    [publicExtensions, isLoading, publish, approve, deprecate, unpublish, publicOf],
  );

  return <PublicExtensionStoreContext.Provider value={value}>{children}</PublicExtensionStoreContext.Provider>;
};
