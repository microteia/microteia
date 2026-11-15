import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { PublicExtensionStoreContext } from './usePublicExtensions';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useDI } from '../infrastructure/di/useDI';
import { dependentRefIssues } from '../domain/usecases/plugins/crossExtensionRefs';
import { LocalizedError } from '../domain/errors/LocalizedError';
import type { PublishExtensionOptions, PublishExtensionOutcome } from '../domain/repositories/IPublicExtensionRepository';
import type { PublicExtension } from '../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { ExtensionStats } from '../domain/entities/ExtensionReputation';

export const PublicExtensionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { publicExtensionRepository, extensionReputationRepository } = useDI();

  const [publicExtensions, setPublicExtensions] = useState<PublicExtension[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ExtensionStats[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<string[]>([]);

  useEffect(() => {
    // isLoading já inicia true; a assinatura zera ao chegar o primeiro snapshot (setState em callback,
    // não no corpo do efeito — evita renders em cascata).
    const unsubscribe = publicExtensionRepository.subscribe((list) => {
      setPublicExtensions(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [publicExtensionRepository]);

  useEffect(() => {
    const unsubscribeStats = extensionReputationRepository.subscribeStats(setStats);
    const unsubscribePublishers = extensionReputationRepository.subscribeVerifiedPublishers(setVerifiedIds);
    return () => {
      unsubscribeStats();
      unsubscribePublishers();
    };
  }, [extensionReputationRepository]);

  const statsById = useMemo(() => new Map(stats.map((entry) => [entry.id, entry])), [stats]);
  const verifiedPublishers = useMemo(() => new Set(verifiedIds), [verifiedIds]);

  const myRatingOf = useCallback(
    async (pluginId: string) => (user ? extensionReputationRepository.getRating(pluginId, user.id) : null),
    [user, extensionReputationRepository],
  );

  const rate = useCallback(async (pluginId: string, stars: number) => {
    if (!user || !currentTenant) return;
    await extensionReputationRepository.rate({ pluginId, userId: user.id, tenantId: currentTenant.id, stars });
  }, [user, currentTenant, extensionReputationRepository]);

  const clearRating = useCallback(async (pluginId: string) => {
    if (!user) return;
    await extensionReputationRepository.clearRating(pluginId, user.id);
  }, [user, extensionReputationRepository]);

  const setPublisherVerified = useCallback(async (ownerTenantId: string, verified: boolean) => {
    if (!user) return;
    await extensionReputationRepository.setPublisherVerified(ownerTenantId, verified, user.id);
  }, [user, extensionReputationRepository]);

  const publicOf = useCallback(
    (domain: string) => publicExtensions.find((p) => p.domain === domain),
    [publicExtensions],
  );

  /**
   * O pacote é o da cópia INSTALADA, e só serve ao portão de cá: quem publica é a callable, que lê a
   * cópia do escritório e nunca o que o navegador manda.
   *
   * O portão de cá é o que o servidor não confere — a referência a artefato e o prefixo de evento que
   * uma extensão do catálogo usa desta, e que esta versão deixou de trazer. É a mesma recusa da
   * instalação: publicada assim, quem instalasse as duas do catálogo seria recusado na segunda.
   */
  const publish = useCallback(async (pkg: MarketplacePlugin, options?: PublishExtensionOptions): Promise<PublishExtensionOutcome> => {
    if (!currentTenant) throw new LocalizedError('@core.marketplace/publish.no-tenant');
    const id = pkg.manifest.id;
    const previous = publicExtensions.find((entry) => entry.domain === id);
    const [broken] = dependentRefIssues(
      pkg,
      publicExtensions
        .filter((entry) => entry.domain !== id && entry.status === 'approved')
        .map((entry) => ({ id: entry.domain, package: entry.package })),
      previous?.package,
    );
    if (broken) throw new LocalizedError(broken.message, broken.messageParams);
    return publicExtensionRepository.publish(currentTenant.id, id, options);
  }, [currentTenant, publicExtensions, publicExtensionRepository]);

  const approve = useCallback((domain: string) => publicExtensionRepository.setStatus(domain, 'approved'), [publicExtensionRepository]);
  const deprecate = useCallback((domain: string) => publicExtensionRepository.setStatus(domain, 'deprecated'), [publicExtensionRepository]);
  const unpublish = useCallback((domain: string) => publicExtensionRepository.delete(domain), [publicExtensionRepository]);

  const value = useMemo(
    () => ({
      publicExtensions, isLoading, publish, approve, deprecate, unpublish, publicOf,
      statsById, verifiedPublishers, myRatingOf, rate, clearRating, setPublisherVerified,
    }),
    [
      publicExtensions, isLoading, publish, approve, deprecate, unpublish, publicOf,
      statsById, verifiedPublishers, myRatingOf, rate, clearRating, setPublisherVerified,
    ],
  );

  return <PublicExtensionStoreContext.Provider value={value}>{children}</PublicExtensionStoreContext.Provider>;
};
