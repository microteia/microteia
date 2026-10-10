/**
 * A reputação pública de uma extensão — `extension_stats/{pluginId}` —, escrita só pelo Admin SDK.
 *
 * O documento agregado mora FORA de `public_extensions` porque o dono reescreve aquele documento
 * inteiro a cada republicação: um contador ali seria um número que o próprio autor escolhe.
 *
 * As instalações são contadas por MARCADOR (`installs/{tenantId}`), e não por incremento: o gatilho
 * do Firestore entrega ao menos uma vez, e um `increment` reentregue contaria a mesma instalação
 * duas vezes. Marcar e recontar é idempotente.
 */
export interface IExtensionStatsRepository {
  setInstallMarker(pluginId: string, tenantId: string, installed: boolean): Promise<void>;
  /** A extensão já teve as instalações anteriores a esta contagem levantadas uma vez. */
  isInstallCountSeeded(pluginId: string): Promise<boolean>;
  /** Os escritórios que têm a extensão instalada de origem contável — a varredura da semeadura. */
  findCatalogInstallTenants(pluginId: string): Promise<string[]>;
  seedInstallMarkers(pluginId: string, tenantIds: string[]): Promise<void>;
  countInstallMarkers(pluginId: string): Promise<number>;
  writeInstallCount(pluginId: string, installs: number): Promise<void>;
  aggregateRatings(pluginId: string): Promise<{ count: number; sum: number }>;
  writeRatings(pluginId: string, count: number, sum: number): Promise<void>;
}
