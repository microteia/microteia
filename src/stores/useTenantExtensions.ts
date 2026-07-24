import { createContext, useContext } from 'react';
import type { TenantExtension } from '../domain/entities/TenantExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { PublicExtension } from '../domain/entities/PublicExtension';

export type ImportExtensionResult = { ok: true; name: string } | { ok: false; error: string };

export interface TenantExtensionStoreValue {
  extensions: TenantExtension[];
  isLoading: boolean;
  /** Cria ou atualiza a extensão autoral (id = package.manifest.id); preserva `active`/autoria. */
  saveExtension: (pkg: MarketplacePlugin) => Promise<void>;
  /** Faz parse + valida um `.json` e o grava como rascunho privado em Minhas Extensões. */
  importExtension: (text: string) => Promise<ImportExtensionResult>;
  /** Instala/atualiza uma pública como CÓPIA no tenant (sourcePluginId/sourceVersion); preserva `active`. */
  installFromPublic: (pub: PublicExtension) => Promise<void>;
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
