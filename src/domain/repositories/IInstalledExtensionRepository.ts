import type { ExtensionCodeTrust, InstalledExtension } from '../entities/InstalledExtension';

/**
 * Persistência das extensões instaladas de um escritório em `tenants/{tenantId}/installed_extensions`.
 * `upsert` grava o documento inteiro (id = `extension.id`); `setActive` liga/desliga sem reescrever o
 * pacote; `delete` desinstala; `setCodeTrust` grava (ou revoga, com `null`) a revisão do código.
 */
export interface IInstalledExtensionRepository {
  subscribe(tenantId: string, onChange: (items: InstalledExtension[]) => void): () => void;
  upsert(tenantId: string, extension: InstalledExtension): Promise<void>;
  setActive(tenantId: string, id: string, active: boolean): Promise<void>;
  setCodeTrust(tenantId: string, id: string, trust: ExtensionCodeTrust | null): Promise<void>;
  delete(tenantId: string, id: string): Promise<void>;
}
