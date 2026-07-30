import { createContext, useContext } from 'react';
import type { InstalledExtension, InstalledExtensionSource } from '../domain/entities/InstalledExtension';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';

/** Dados para instalar/atualizar uma cópia: pacote completo + versão + atribuição do autor original. */
export interface InstallExtensionInput {
  package: MarketplacePlugin;
  source: InstalledExtensionSource;
  version: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
}

export interface InstalledExtensionStoreValue {
  installed: InstalledExtension[];
  isLoading: boolean;
  /** Copia (fielmente) o pacote para o tenant; preserva `active` de uma instalação existente. */
  install: (input: InstallExtensionInput) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  /** Registra a revisão do código desta cópia: grava quem confiou, quando, e o hash do que foi revisado. */
  trustCode: (id: string) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  installedOf: (id: string) => InstalledExtension | undefined;
}

export const InstalledExtensionStoreContext = createContext<InstalledExtensionStoreValue | null>(null);

export const useInstalledExtensions = (): InstalledExtensionStoreValue => {
  const ctx = useContext(InstalledExtensionStoreContext);
  if (!ctx) throw new Error('useInstalledExtensions must be used within InstalledExtensionStoreProvider');
  return ctx;
};
