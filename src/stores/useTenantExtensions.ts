import { createContext, useContext } from 'react';
import type { TenantExtension } from '../domain/entities/TenantExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

export type ImportExtensionResult =
  /** `package` é o que ficou gravado: quem importa para publicar em seguida não o lê de novo. */
  | { ok: true; name: string; package: MarketplacePlugin }
  /** `error` é uma REFERÊNCIA de mensagem; `errorParams` traz os valores que a frase interpola. */
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface TenantExtensionStoreValue {
  extensions: TenantExtension[];
  isLoading: boolean;
  /**
   * Grava o que a tela "Criar extensão" montou (origem `authored`); preserva `active`/autoria. Lança
   * `LocalizedError` quando o id é de uma extensão importada — essa não se edita.
   */
  saveExtension: (pkg: MarketplacePlugin) => Promise<void>;
  /**
   * Faz parse + valida um `.json` e o grava em Minhas Extensões com origem `imported`. Recusa quando o
   * id é de uma extensão montada aqui: importar trocaria a fonte do escritório por uma cópia fechada.
   */
  importExtension: (text: string) => Promise<ImportExtensionResult>;
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
