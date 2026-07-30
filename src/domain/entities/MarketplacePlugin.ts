import type { PluginManifest } from '../schema/plugin/pluginManifest';
import type { WorkflowDefinition } from './Workflow';
import type { Script } from './Script';
import type { ActionDefinition } from './Action';
import type { FieldDefinition, ScreenListAction } from './entitySchemas';

/**
 * Uma tela (entidade) que a extensão instala no escritório. É uma ScreenDefinition autoral: a
 * `key` é a chave DECLARADA (a instalação a reivindica, desambiguando só se o nome estiver
 * ocupado) e as referências entre telas do mesmo pacote
 * (`refEntity`, `parentEntity`, `aggregation.from`) usam essas keys de template, reescritas na
 * materialização. `viewActionIds`/`cardActionIds` referenciam `templateId`s de actions do pacote.
 * Referência a coleção fixa (`persons`) fica intacta.
 */
export type TemplateField = Omit<FieldDefinition, 'origin'>;

export interface ScreenModuleTemplate {
  key: string;
  /** Id UNIVERSAL de origem da tela — deduplica a mesma tela entre extensões na instalação. */
  sourceId?: string;
  /** Revisão de origem (epoch ms do `updatedAt` no autor) — decide se a atualização reescreve a tela. */
  sourceRev?: number | null;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  /** Sem `origin`: a instalação carimba `plugin` em cada campo. */
  fields: TemplateField[];
  titleFieldKey: string;
  hasNotes?: boolean;
  hasDocuments?: boolean;
  hasTags?: boolean;
  tagCollection?: string | null;
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
 * Um COMPLEMENTO de tela: acrescenta campos a uma entidade que JÁ EXISTE no escritório de destino,
 * em vez de instalar uma tela nova. É como uma extensão estende `persons` (kernel) ou uma tela
 * trazida por outra extensão — a estrutura da tela (título, ícone, menu, ações) e o dono dela não
 * são tocados; a extensão passa a ser dona apenas dos CAMPOS que acrescenta.
 *
 * `target` é a coleção do kernel (`persons`) quando `targetKind: 'collection'` — o nome é universal,
 * igual em todo escritório —, ou o `sourceId` UNIVERSAL da tela quando `targetKind: 'sourceId'`, que
 * é o caso de estender uma tela de outra extensão (cuja chave instalada varia por escritório).
 */
export interface ScreenPatchTemplate {
  target: string;
  targetKind?: 'collection' | 'sourceId';
  /** Sem `origin`: a instalação carimba `plugin` e o `ownerPluginId` em cada campo. */
  fields: TemplateField[];
  /** Revisão de origem, no mesmo contrato dos demais artefatos. */
  sourceRev?: number | null;
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
 * registro por um SYSTEM ou embutida no bundle; um `.json` importado avulso instala dados, e a view
 * só executa depois que um admin do escritório revisa o código (ver `extensionCodeTrust`).
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
export interface LookupModuleTemplate {
  collection: string;
  label: string;
}

export interface MarketplacePlugin {
  manifest: PluginManifest;
  summary: string;
  workflows: WorkflowModuleTemplate[];
  screens?: ScreenModuleTemplate[];
  /** Campos que o pacote acrescenta a telas que já existem no destino. Ver `ScreenPatchTemplate`. */
  screenPatches?: ScreenPatchTemplate[];
  /**
   * Listas de opções que as telas do pacote referenciam em `lookupCollection`. Viajam como
   * DECLARAÇÃO (nome + rótulo), nunca com as opções: estas são dado do escritório, e é por isso que
   * desinstalar a extensão não as apaga.
   */
  lookups?: LookupModuleTemplate[];
  /** Conjuntos de etiquetas referenciados pelas telas do pacote, pelo mesmo motivo das listas. */
  tagLists?: LookupModuleTemplate[];
  actions?: ActionModuleTemplate[];
  scripts?: ScriptModuleTemplate[];
  /** Views de código (extensões trusted). Cada `key` casa com uma contribuição `ui.page` code. */
  views?: ViewModuleTemplate[];
  /**
   * Código de INICIALIZAÇÃO (trusted): fonte TS/TSX que exporta como `default` uma função
   * `(host) => cleanup?`. Roda uma vez quando a extensão instalada e ativa é carregada no escritório,
   * recebendo um `host` curado para REGISTRAR SERVIÇOS (comandos ⌘K, etc.). O retorno opcional é o
   * teardown, chamado ao desativar/desinstalar. Só executa de fonte confiável, como as `views`.
   */
  startup?: string;
  /**
   * Descrição rica da extensão, em Widget DSL — renderizada pelo Kernel na tela de detalhes. É
   * serializável (viaja no manifest até o registro) e não carrega código do plugin. `unknown`
   * porque o tipo `WidgetSpec` vive na camada de apresentação; o renderizador valida.
   */
  overview?: unknown;
}
