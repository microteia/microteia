import { createContext, useContext } from 'react';
import type { InstalledExtension, InstalledExtensionSource } from '../domain/entities/InstalledExtension';
import type { ExtensionHistory } from '../domain/entities/ExtensionHistory';
import type { AppliedBackend } from '../domain/entities/AppliedBackend';
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

/**
 * O que quem aplica JÁ ACEITOU. Ausente, a porta recusa a troca que tiraria uma extensão do ar por
 * faixa de versão (`DependencyRangeRefusal`); com `acceptDependencyRanges`, aplica — é a resposta de
 * quem leu a lista e confirmou.
 */
export interface InstallOptions {
  acceptDependencyRanges?: boolean;
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
  /**
   * O que cada extensão já APLICOU neste escritório, por `pluginId` — só o índice, sem os pacotes.
   * Sobrevive à desinstalação de propósito: é ele que permite voltar à última versão que o escritório
   * tinha depois de desinstalar. Ver `ExtensionHistory`.
   */
  histories: ReadonlyMap<string, ExtensionHistory>;
  /**
   * O que o PROJETO Firebase tem aplicado de backend de extensão (`backend_state/applied`), ou `null`
   * quando o Console nunca o gravou. Toda pergunta de pendência de backend o recebe: a cópia instalada
   * depois do último `provision`, exigindo o que o projeto já roda, não está pendente. Ver
   * `extensionBackendState`.
   */
  appliedBackend: AppliedBackend | null;
  /** Copia (fielmente) o pacote para o tenant; preserva `active` de uma instalação existente. */
  install: (input: InstallExtensionInput, options?: InstallOptions) => Promise<void>;
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
  /**
   * Reaplica uma versão do histórico. Passa pela MESMA `install`, com o pacote lido da entrada — e
   * por isso não cria item novo no histórico: aquela revisão já está lá.
   */
  restore: (id: string, revision: string, options?: InstallOptions) => Promise<void>;
}

export const InstalledExtensionStoreContext = createContext<InstalledExtensionStoreValue | null>(null);

export const useInstalledExtensions = (): InstalledExtensionStoreValue => {
  const ctx = useContext(InstalledExtensionStoreContext);
  if (!ctx) throw new Error('useInstalledExtensions must be used within InstalledExtensionStoreProvider');
  return ctx;
};
