import type { ExtensionRatingInput, ExtensionStats } from '../entities/ExtensionReputation';

/**
 * A reputação pública das extensões. O agregado só é LIDO daqui — quem o escreve é o backend, a
 * partir dos votos e das instalações; o voto e o selo de publicador verificado são as únicas
 * escritas, e as Rules decidem quem pode fazer cada uma.
 */
export interface IExtensionReputationRepository {
  subscribeStats(onChange: (stats: ExtensionStats[]) => void): () => void;
  /** Os escritórios cujo selo de publicador verificado está concedido. */
  subscribeVerifiedPublishers(onChange: (tenantIds: string[]) => void): () => void;
  getRating(pluginId: string, userId: string): Promise<number | null>;
  rate(input: ExtensionRatingInput): Promise<void>;
  clearRating(pluginId: string, userId: string): Promise<void>;
  setPublisherVerified(tenantId: string, verified: boolean, verifiedBy: string): Promise<void>;
}
