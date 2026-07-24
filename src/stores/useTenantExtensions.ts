import { createContext, useContext } from 'react';
import type { TenantExtension } from '../domain/entities/TenantExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

export interface TenantExtensionStoreValue {
  extensions: TenantExtension[];
  isLoading: boolean;
  /** Cria ou atualiza a extensão autoral (id = package.manifest.id); preserva `active`/autoria. */
  saveExtension: (pkg: MarketplacePlugin) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  removeExtension: (id: string) => Promise<void>;
  extensionOf: (id: string) => TenantExtension | undefined;
}

export const TenantExtensionStoreContext = createContext<TenantExtensionStoreValue | null>(null);

export const useTenantExtensions = (): TenantExtensionStoreValue => {
  const ctx = useContext(TenantExtensionStoreContext);
  if (!ctx) throw new Error('useTenantExtensions must be used within TenantExtensionStoreProvider');
  return ctx;
};
