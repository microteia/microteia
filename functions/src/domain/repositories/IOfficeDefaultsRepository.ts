import type { LocaleCode } from '../schema/i18n/localeNegotiation';
import type { DefaultCatalogSide, DefaultExtensionsOnboarding } from '../schema/plugin/defaultExtensions';

/** O que o `SYSTEM` decidiu que todo escritório novo recebe — `system/registration`. */
export interface OfficeDefaultsIntent {
  locale: LocaleCode | null;
  extensions: string[];
}

/** O que a criação de um escritório lê e grava para que ele nasça com o que a instalação decidiu. */
export interface IOfficeDefaultsRepository {
  readIntent(): Promise<OfficeDefaultsIntent>;
  /** As entradas do catálogo destes ids, só na parte que o plano lê. */
  readCatalog(ids: readonly string[]): Promise<DefaultCatalogSide[]>;
  /** Grava `i18n.locale` nas configurações do escritório. */
  setLocale(tenantId: string, locale: LocaleCode): Promise<void>;
  /** Grava a lista do que o escritório tem a instalar, na ordem. */
  stage(tenantId: string, pending: readonly string[]): Promise<void>;
  /**
   * Marca o começo da instalação (`startedAt`) — uma vez só, e só se ainda há o que instalar (#28).
   * Devolve a lista como ficou, ou `null` se o escritório não tem lista.
   */
  startOnboarding(tenantId: string, now: number): Promise<DefaultExtensionsOnboarding | null>;
}
