import type { PluginInstallation } from '../entities/PluginInstallation';

export interface IPluginInstallationRepository {
  getAll(tenantId: string): Promise<PluginInstallation[]>;
  getById(tenantId: string, pluginId: string): Promise<PluginInstallation | null>;
  subscribe(tenantId: string, onUpdate: (installations: PluginInstallation[]) => void): () => void;
  save(installation: PluginInstallation): Promise<void>;
  delete(tenantId: string, pluginId: string): Promise<void>;
}
