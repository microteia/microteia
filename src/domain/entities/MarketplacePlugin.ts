import type { PluginManifest } from '../schema/plugin/pluginManifest';
import type { WorkflowDefinition } from './Workflow';

/**
 * O que a instalação materializa como um workflow no tenant. É a WorkflowDefinition sem os campos
 * que só existem depois de gravada (id, tenantId, timestamps) nem a marca de dono (preenchida na
 * instalação). `enabled` fica de fora: a instalação decide (nasce habilitado).
 */
export type WorkflowTemplate = Omit<
  WorkflowDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'ownerPluginId' | 'enabled'
>;

/**
 * Um plugin do Marketplace nesta fatia vertical: o manifest (metadata declarativa) mais os
 * workflows que ele instala. Distribuído hoje embutido no código (catálogo); na Etapa 7 completa
 * virá do registro global no Firestore.
 */
export interface MarketplacePlugin {
  manifest: PluginManifest;
  summary: string;
  workflows: WorkflowTemplate[];
}
