import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PublicExtensionStoreContext, type PublishPublicResult } from './usePublicExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { extensionHasCode, publishRefusal } from '../domain/usecases/plugins/publicExtension';
import type { PublicExtension } from '../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

export const PublicExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, userRole } = useAuth();
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
    if (!currentTenant || !user) {
      return { ok: false, error: '@core.marketplace/publish.no-tenant' };
    }
    const domain = pkg.manifest.id;
    const version = pkg.manifest.version;

    // Upsert: um identificador tem UM registro público. Republicar sobrescreve os dados da mesma
    // extensão (não cria um novo registro), e por isso exige versão maior — quem já instalou só
    // recebe a cópia nova quando a versão sobe.
    const published = publicExtensions.find((p) => p.domain === domain);
    const refusal = publishRefusal({
      pkg,
      isSystem: userRole === 'SYSTEM',
      ownerTenantId: currentTenant.id,
      published,
    });
    if (refusal) {
      return {
        ok: false,
        error: `@core.marketplace/publish.${refusal}`,
        errorParams: { version, published: published?.version ?? '' },
      };
    }

    await publicExtensionRepository.publish({
      package: pkg,
      ownerTenantId: currentTenant.id,
      ownerName: user.displayName,
      ownerPhotoURL: user.photoURL,
      version,
      status: 'approved',
      hasCode: extensionHasCode(pkg),
      publishedBy: user.id,
    });
    return { ok: true };
  }, [currentTenant, user, userRole, publicExtensions, publicExtensionRepository]);

  const approve = useCallback((domain: string) => publicExtensionRepository.setStatus(domain, 'approved'), [publicExtensionRepository]);
  const deprecate = useCallback((domain: string) => publicExtensionRepository.setStatus(domain, 'deprecated'), [publicExtensionRepository]);
  const unpublish = useCallback((domain: string) => publicExtensionRepository.delete(domain), [publicExtensionRepository]);

  const value = useMemo(
    () => ({ publicExtensions, isLoading, publish, approve, deprecate, unpublish, publicOf }),
    [publicExtensions, isLoading, publish, approve, deprecate, unpublish, publicOf],
  );

  return <PublicExtensionStoreContext.Provider value={value}>{children}</PublicExtensionStoreContext.Provider>;
};
