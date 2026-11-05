import type { AuditAction } from './AuditLog';
import type { LookupSeedMode } from '../schema/lookupSeed';
import type { PluginManifest } from '../schema/plugin/pluginManifest';
import type { PluginMigration } from '../schema/plugin/migration';
import type { PackagedBackendSource } from '../schema/plugin/backendSource';
import type { ReportModuleTemplate as ReportModuleTemplateType } from './Report';
import type { WorkflowDefinition } from './Workflow';
import type { Script } from './Script';
import type { ActionDefinition } from './Action';
import type { PortalDeclaration } from '../schema/portal';
import type { EditWindowSpec } from '../schema/editWindow';
import type { CardTemplate } from '../schema/ui/cardTemplate';
import type { MemberVisibilitySpec } from '../schema/memberVisibility';
import type { CustomFieldOption, FieldDefinition, RecordKeySpec, ScreenListAction } from './entitySchemas';

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
  /**
   * Revisão de origem (epoch ms do `updatedAt` no autor). Carimbada na tela materializada e usada na
   * deduplicação entre pacotes. A TELA não é gatilhada por ela: toda aplicação do pacote reescreve a
   * declaração e remescla o que é do escritório (campos acrescentados, ações configuradas). Quem
   * consulta a revisão são os artefatos de id gerado — ver `shouldRewriteContent`.
   */
  sourceRev?: number | null;
  titleSingular: string;
  titlePlural: string;
  icon: string;
  /** Sem `origin`: a instalação carimba `plugin` em cada campo. */
  fields: TemplateField[];
  /**
   * O que não pode se repetir na coleção. Ver `ScreenDefinition.keys`; um campo só é o `unique` do
   * próprio campo, que a resolução desaçucara. A instalação carimba o `ownerPluginId` em cada chave,
   * e é ele que faz a desinstalação levar embora a chave que a extensão trouxe sem tocar nas que o
   * escritório declarou por cima.
   */
  keys?: RecordKeySpec[];
  titleFieldKey: string;
  /** Campo do subtítulo do detalhe e do cartão. Ver `ScreenDefinition.subtitleFieldKey`. */
  subtitleFieldKey?: string | null;
  /** Campo de arquivo cuja imagem substitui o ícone. Ver `ScreenDefinition.imageFieldKey`. */
  imageFieldKey?: string | null;
  hasNotes?: boolean;
  hasDocuments?: boolean;
  hasTags?: boolean;
  tagCollection?: string | null;
  /**
   * Instala a tela sobre uma coleção que já existe no destino, em vez de criar uma coleção própria —
   * o nome universal de uma entidade do kernel (`cases`), igual em todo escritório, como em
   * `ScreenPatchTemplate` com `targetKind: 'collection'`.
   *
   * Aqui `fields` continua sendo a declaração COMPLETA do esquema daquela coleção, e não deve ser
   * omitida: uma tela que herdasse os campos do kernel deixaria de funcionar no dia em que a
   * entidade nativa fosse removida — que é exatamente o destino do projeto. Ver
   * `ScreenDefinition.dataCollection`.
   */
  dataCollection?: string;
  /** Prefixo dos eventos da coleção. Ver `ScreenDefinition.eventPrefix`. */
  eventPrefix?: string | null;
  /**
   * Quais ações desta coleção geram registro de auditoria. Ausente = todas.
   *
   * É a declaração de quem traz uma coleção que a MÁQUINA escreve: uma ingestão que grava por conta
   * própria produziria um log por documento recebido, e afogaria a Auditoria justamente onde ela
   * serve — o gesto humano depois. Ver `ScreenDefinition.auditActions`.
   */
  auditActions?: AuditAction[] | null;
  /** Prefixo da aba que abre um registro. Ver `ScreenDefinition.recordTabPrefix`. */
  recordTabPrefix?: string | null;
  /** Campos que qualquer membro grava. Ver `ScreenDefinition.memberWritableFields`. */
  memberWritableFields?: string[] | null;
  /** O autor exclui o que criou. Ver `ScreenDefinition.authorCanDelete`. */
  authorCanDelete?: boolean | null;
  /** Prazo para alterar (e excluir) o registro depois de criado. Ver `ScreenDefinition.editWindow`. */
  editWindow?: EditWindowSpec | null;
  /** Quem lê cada registro. Ver `ScreenDefinition.memberVisibility`. */
  memberVisibility?: MemberVisibilitySpec | null;
  /** O que a tela expõe no portal. Ver `ScreenDefinition.portal`. */
  portal?: PortalDeclaration | null;
  listActions?: ScreenListAction[];
  sidebarOrder?: number;
  enabled?: boolean;
  /** Mantém a tela fora do menu (entidade de topo sem entrada automática). Ver `ScreenDefinition`. */
  hideFromSidebar?: boolean;
  /** A tela filha não vira aba do pai. Ver `ScreenDefinition.hideFromParentTabs`. */
  hideFromParentTabs?: boolean;
  /** Os registros ficam fora da busca do ⌘K. Ver `ScreenDefinition.hideRecordsFromCommandPalette`. */
  hideRecordsFromCommandPalette?: boolean;
  parentEntity?: string | null;
  parentFieldKey?: string | null;
  /** Posse ou visão sobre o pai. Ver `ScreenDefinition.parentRelation`. */
  parentRelation?: 'owned' | 'related' | null;
  viewActionIds?: string[];
  cardActionIds?: string[];
  /** O desenho do cartão da listagem. Ver `ScreenDefinition.cardTemplate`. */
  cardTemplate?: CardTemplate | null;
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
  /**
   * Ações do pacote que a extensão pendura no cartão e no detalhe da tela ALVO — `templateId`s,
   * remapeados para os ids gerados na instalação, exatamente como em `ScreenModuleTemplate`.
   *
   * Existe porque a lista de ações de uma tela é CONFIGURAÇÃO dela (a aba "Ações" do Form Design), e
   * não um mecanismo paralelo: uma extensão que oferece um gesto sobre a tela de outra precisa
   * chegar à mesma lista que o escritório edita à mão — senão haveria duas origens para a mesma
   * pergunta ("o que aparece neste cartão?"), e o usuário só conseguiria mexer numa delas.
   *
   * São ACRESCENTADAS às que já estão lá, nunca substituem: a tela é do destino, e o complemento não
   * manda no que o escritório configurou. A desinstalação retira apenas as que vieram desta extensão.
   */
  cardActionIds?: string[];
  viewActionIds?: string[];
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

/**
 * Uma action do pacote. `workflowId` referencia o `templateId` de um workflow do pacote.
 *
 * O QUE ela executa é uma união: um fluxo (`workflowId`) ou um gesto da plataforma (`command`). A
 * entidade gravada continua com `workflowId: string` — vazio quando há comando —, mas quem ESCREVE o
 * pacote não precisa mais do `workflowId: ''` só para compilar. Os dois campos existem nos dois
 * ramos de propósito: `keyof` da união continua enxergando ambos, e um pacote antigo com
 * `workflowId: ''` ao lado do `command` segue válido. A ação sem nenhum dos dois é recusada pelo
 * `check` (`packageActionIssues`), porque o tipo não vê o `''` que o JSON carrega.
 */
export type ActionModuleTemplate = { templateId: string } & Omit<
  ActionDefinition,
  | 'id' | 'tenantId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'updatedByName' | 'updatedByPhotoURL'
  | 'ownerPluginId' | 'workflowId' | 'command'
> & (
  | { workflowId: string; command?: null }
  | { command: string; workflowId?: string | null }
);

/**
 * Um relatório do pacote.
 *
 * O `ReportSpec` dele aponta para uma COLEÇÃO (`dataset.table`), e essa é a única referência que a
 * instalação precisa reescrever: a chave de uma tela do pacote pode ganhar sufixo no escritório de
 * destino. Ver `rewriteReportTables`.
 */
export type ReportModuleTemplate = ReportModuleTemplateType;

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
  /**
   * Opções SEMENTE: o ponto de partida da lista. Como entram é `seed` quem diz. É o que permite a uma
   * extensão entregar uma entidade pronta para uso sem que o kernel precise conhecer nenhuma delas —
   * inclusive numa lista do kernel, como `documentTypes`, que não ganha declaração nova por isso.
   */
  options?: CustomFieldOption[];
  /**
   * `when-empty` (padrão): as opções só entram numa lista vazia. `required`: numa lista que já tem
   * opções, entram as que faltam, cada uma UMA vez por extensão — a que o escritório apagou não volta.
   * Ver `schema/lookupSeed.ts`.
   */
  seed?: LookupSeedMode;
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
  /**
   * Relatórios que o pacote entrega prontos. Cada um pode ser DECLARATIVO (o normal) ou ter a
   * apresentação escrita em código — nesse caso uma contribuição `report.definition` com
   * `impl: { kind: 'code', key }` casa com a `views[]` de mesma chave.
   */
  reports?: ReportModuleTemplate[];
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
   * A FONTE das Cloud Functions que `manifest.backend.functions` declara, capturada pelo build do SDK
   * do diretório `functions/` ao lado do `plugin.ts`. O Console a monta e a põe no ar só depois que
   * quem opera o projeto aprova o hash. Ver `PackagedBackendSource`.
   */
  backendSource?: PackagedBackendSource;
  /**
   * MIGRAÇÕES DE DADOS: código que roda uma vez por escritório para converter o dado que uma versão
   * anterior desta mesma extensão escreveu. Viajam no pacote e NÃO são materializadas como Scripts do
   * escritório — o que elas reusam do Script é o sandbox, não a entidade. Ver `PluginMigration`.
   */
  migrations?: PluginMigration[];
  /**
   * Descrição rica da extensão, em Widget DSL — renderizada pelo Kernel na tela de detalhes. É
   * serializável (viaja no manifest até o registro) e não carrega código do plugin. `unknown`
   * porque o tipo `WidgetSpec` vive na camada de apresentação; o renderizador valida.
   */
  overview?: unknown;
}
