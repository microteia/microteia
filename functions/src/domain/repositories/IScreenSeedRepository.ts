import type { ExtensionSeedState, ScreenSeedEntry, ScreenSeedFailure } from '../schema/screenSeed';

/** A cópia instalada de uma extensão, como a semeadura a lê. */
export interface SeedInstalledExtension {
  package: unknown;
  active: boolean;
}

/** Uma tela do escritório pelo id universal — é por ele, e não pela chave instalada, que a semente a acha. */
export interface SeedInstalledScreen {
  sourceId: string;
  collection: string;
}

export interface IScreenSeedRepository {
  readInstalled(tenantId: string, pluginId: string): Promise<SeedInstalledExtension | null>;
  /** Lido do banco na hora: a passada corre segundos depois de a instalação gravar as telas. */
  installedScreens(tenantId: string): Promise<SeedInstalledScreen[]>;
  isCollectionEmpty(tenantId: string, collection: string): Promise<boolean>;
  readState(tenantId: string, pluginId: string): Promise<ExtensionSeedState>;
  /**
   * Reserva a extensão para UMA passada, em transação. `null` quando outra passada já a reservou e a
   * reserva não venceu — é aqui que duas entregas do mesmo gatilho se encontram.
   */
  claim(tenantId: string, pluginId: string, now: number, leaseMs: number): Promise<ExtensionSeedState | null>;
  release(tenantId: string, pluginId: string): Promise<void>;
  /** A decisão da tela (`planned`) e as recusas desta passada. Não toca em `delivered`. */
  saveScreen(
    tenantId: string,
    pluginId: string,
    sourceId: string,
    entry: ScreenSeedEntry,
    failures: ScreenSeedFailure[],
  ): Promise<void>;
  /**
   * Uma chave a mais em `delivered`, gravada logo depois do registro. Por semente, e não no fim da
   * tela: uma passada que cai no meio deixa entregue exatamente o que foi criado, e a retomada não
   * duplica o catálogo.
   */
  markDelivered(tenantId: string, pluginId: string, sourceId: string, key: string): Promise<void>;
}
