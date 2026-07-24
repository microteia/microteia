import type { TenantExtension } from '../entities/TenantExtension';

/**
 * Persistência das extensões autorais de um escritório em `tenants/{tenantId}/extensions`. `upsert`
 * grava o documento inteiro (id = `extension.id`); `setActive` liga/desliga sem reescrever o pacote.
 */
export interface ITenantExtensionRepository {
  subscribe(tenantId: string, onChange: (items: TenantExtension[]) => void): () => void;
  upsert(tenantId: string, extension: TenantExtension): Promise<void>;
  setActive(tenantId: string, id: string, active: boolean): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
