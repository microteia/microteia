import type { DefaultCatalogSide } from '../schema/plugin/defaultExtensions';

/** O que a criação de um escritório lê e grava para planejar as extensões padrão dele. */
export interface IDefaultExtensionOnboardingRepository {
  /** `system/registration.defaultExtensions` — a intenção do `SYSTEM`. */
  readDefaults(): Promise<string[]>;
  /** As entradas do catálogo destes ids, só na parte que o plano lê. */
  readCatalog(ids: readonly string[]): Promise<DefaultCatalogSide[]>;
  /** Grava a lista do que o escritório tem a instalar, na ordem. */
  stage(tenantId: string, pending: readonly string[]): Promise<void>;
}
