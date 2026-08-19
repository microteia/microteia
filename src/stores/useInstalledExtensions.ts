import { createContext, useContext } from 'react';
import type { InstalledExtension, InstalledExtensionSource } from '../domain/entities/InstalledExtension';
import type { ExtensionMigrationState } from '../domain/entities/ExtensionMigration';
import type { MarketplacePlugin } from '../domain/entities/MarketplacePlugin';
import type { PluginMigration } from '../domain/schema/plugin/migration';

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
  /**
   * O que cada extensão instalada JÁ MIGROU neste escritório, por `pluginId`. Vive junto das
   * instaladas porque é a mesma pergunta em duas metades: o pacote diz o que a extensão exige do
   * dado, e este mapa diz o que o dado já recebeu. Ver `extensionMigrationState`.
   */
  migrationStates: ReadonlyMap<string, ExtensionMigrationState>;
  /** Copia (fielmente) o pacote para o tenant; preserva `active` de uma instalação existente. */
  install: (input: InstallExtensionInput) => Promise<void>;
  setActive: (id: string, active: boolean) => Promise<void>;
  /** Registra a revisão do código desta cópia: grava quem confiou, quando, e o hash do que foi revisado. */
  trustCode: (id: string) => Promise<void>;
  uninstall: (id: string) => Promise<void>;
  installedOf: (id: string) => InstalledExtension | undefined;
  /** A fila de migração que esta cópia ainda deve. Vazia é o caso da maioria das extensões. */
  pendingMigrationsOf: (id: string) => PluginMigration[];
  /**
   * Roda a fila pendente agora — o gesto de retentar, para quando a migração falhou no meio de uma
   * atualização ou quando uma versão já instalada passou a declarar migração.
   */
  runMigrations: (id: string) => Promise<void>;
}

export const InstalledExtensionStoreContext = createContext<InstalledExtensionStoreValue | null>(null);

export const useInstalledExtensions = (): InstalledExtensionStoreValue => {
  const ctx = useContext(InstalledExtensionStoreContext);
  if (!ctx) throw new Error('useInstalledExtensions must be used within InstalledExtensionStoreProvider');
  return ctx;
};
