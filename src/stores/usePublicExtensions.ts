import { createContext, useContext } from 'react';
import type { PublicExtension } from '../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { ExtensionStats } from '../domain/entities/ExtensionReputation';

export type PublishPublicResult =
  | { ok: true }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz os valores que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface PublicExtensionStoreValue {
  publicExtensions: PublicExtension[];
  isLoading: boolean;
  /** Publica no catálogo global; republicar exige versão maior, e código exige SYSTEM. */
  publish: (pkg: MarketplacePlugin) => Promise<PublishPublicResult>;
  approve: (domain: string) => Promise<void>;
  deprecate: (domain: string) => Promise<void>;
  unpublish: (domain: string) => Promise<void>;
  publicOf: (domain: string) => PublicExtension | undefined;
  /** O agregado público por extensão — instalações e votos. Ausente em quem ninguém instalou nem votou. */
  statsById: ReadonlyMap<string, ExtensionStats>;
  /** Os escritórios publicadores verificados pela equipe global. */
  verifiedPublishers: ReadonlySet<string>;
  /** O voto de quem está logado, ou `null` se ainda não votou. Lido sob demanda: só o modal pergunta. */
  myRatingOf: (pluginId: string) => Promise<number | null>;
  /** Vota em nome do escritório atual — as Rules exigem que ele tenha a extensão instalada. */
  rate: (pluginId: string, stars: number) => Promise<void>;
  clearRating: (pluginId: string) => Promise<void>;
  /** Concede ou retira o selo de publicador verificado. Só o SYSTEM — as Rules recusam os demais. */
  setPublisherVerified: (ownerTenantId: string, verified: boolean) => Promise<void>;
}

export const PublicExtensionStoreContext = createContext<PublicExtensionStoreValue | null>(null);

export const usePublicExtensions = (): PublicExtensionStoreValue => {
  const ctx = useContext(PublicExtensionStoreContext);
  if (!ctx) throw new Error('usePublicExtensions must be used within PublicExtensionStoreProvider');
  return ctx;
};
