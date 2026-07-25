import type { PluginManifest } from '../schema/plugin/pluginManifest';
import type { WorkflowDefinition } from './Workflow';
import type { Script } from './Script';
import type { ActionDefinition } from './Action';
import type { FieldDefinition, ScreenListAction } from './entitySchemas';

/**
 * Uma tela (entidade) que a extensão instala no escritório. É uma ScreenDefinition autoral: a
 * `key` é de TEMPLATE (namespaced na instalação) e as referências entre telas do mesmo pacote
 * (`refEntity`, `parentEntity`, `aggregation.from`) usam essas keys de template, reescritas na
 * materialização. `viewActionIds`/`cardActionIds` referenciam `templateId`s de actions do pacote.
 * Referência a coleção fixa (`persons`) fica intacta.
 */
export interface ScreenModuleTemplate {
  key: string;
  /** Id UNIVERSAL de origem da tela — deduplica a mesma tela entre extensões na instalação. */
  sourceId?: string;
  /** Revisão de origem (epoch ms do `updatedAt` no autor) — decide se a atualização reescreve a tela. */
  sourceRev?: number | null;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  fields: FieldDefinition[];
  titleFieldKey: string;
  hasNotes?: boolean;
  hasDocuments?: boolean;
  hasTags?: boolean;
  listActions?: ScreenListAction[];
  sidebarOrder?: number;
  enabled?: boolean;
  /** Mantém a tela fora do menu (entidade de topo sem entrada automática). Ver `ScreenDefinition`. */
  hideFromSidebar?: boolean;
  parentEntity?: string | null;
  parentFieldKey?: string | null;
  viewActionIds?: string[];
  cardActionIds?: string[];
}

/**
 * Um workflow do pacote. `templateId` é o id estável pelo qual actions (`workflowId`) e outros
 * workflows (`step.configuration.targetWorkflowId`) o referenciam — remapeado para o id gerado na
 * instalação. Os demais campos são a WorkflowDefinition sem o que só existe depois de gravada.
 */
export type WorkflowModuleTemplate = { templateId: string } & Omit<
  WorkflowDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'ownerPluginId' | 'enabled'
>;

/** Uma action do pacote. `workflowId` referencia o `templateId` de um workflow do pacote. */
export type ActionModuleTemplate = { templateId: string } & Omit<
  ActionDefinition,
  'id' | 'tenantId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'updatedByName' | 'updatedByPhotoURL' | 'ownerPluginId'
>;

/** Um script do pacote, referenciado por `step.configuration.scriptId` de workflows via `templateId`. */
export type ScriptModuleTemplate = { templateId: string } & Omit<
  Script,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'ownerPluginId'
>;

/**
 * Uma VIEW DE CÓDIGO de uma extensão trusted: um componente React entregue como fonte (TSX/TS
 * serializável, viaja no `.json`). O Kernel não interpreta a fonte — o runtime do browser a compila
 * (`sucrase`) e a avalia contra a API CURADA do host, registrando o componente sob `key`. Uma
 * contribuição `ui.page` com `impl: { kind: 'code', key }` no `manifest.contributes` a expõe como
 * aba do workspace. Código só é avaliado quando a extensão vem de fonte confiável — publicada no
 * registro por um SYSTEM ou embutida no bundle; um `.json` importado avulso instala dados, mas a
 * view não executa.
 */
export interface ViewModuleTemplate {
  key: string;
  title: string;
  icon: string;
  source: string;
}

/**
 * Um plugin do Marketplace: o manifest (metadata declarativa) mais os artefatos que ele instala —
 * telas, workflows, actions e scripts. Um plugin pode ser qualquer subconjunto (só um workflow, só
 * uma action, etc.). As referências entre artefatos são por `key`/`templateId` de template,
 * remapeadas na instalação.
 */
export interface MarketplacePlugin {
  manifest: PluginManifest;
  summary: string;
  workflows: WorkflowModuleTemplate[];
  screens?: ScreenModuleTemplate[];
  actions?: ActionModuleTemplate[];
  scripts?: ScriptModuleTemplate[];
  /** Views de código (extensões trusted). Cada `key` casa com uma contribuição `ui.page` code. */
  views?: ViewModuleTemplate[];
  /**
   * Descrição rica da extensão, em Widget DSL — renderizada pelo Kernel na tela de detalhes. É
   * serializável (viaja no manifest até o registro) e não carrega código do plugin. `unknown`
   * porque o tipo `WidgetSpec` vive na camada de apresentação; o renderizador valida.
   */
  overview?: unknown;
}
