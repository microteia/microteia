import { createContext, useContext } from 'react';
import type { PublicExtension } from '../domain/entities/PublicExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

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
}

export const PublicExtensionStoreContext = createContext<PublicExtensionStoreValue | null>(null);

export const usePublicExtensions = (): PublicExtensionStoreValue => {
  const ctx = useContext(PublicExtensionStoreContext);
  if (!ctx) throw new Error('usePublicExtensions must be used within PublicExtensionStoreProvider');
  return ctx;
};
