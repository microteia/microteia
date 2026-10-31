// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowStepCatalog.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowStepCatalog.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { WORKFLOW_AUDIT_EVENT } from './workflowAuditTrigger';
import type { FieldRules } from './fieldRules';

/**
 * O catálogo de passos de automação — a METADATA, sem os executores.
 *
 * Ele morava em `functions/`, junto do motor, e essa era a única capacidade grande do kernel que um
 * autor de extensão não conseguia enumerar: o SDK, o MCP e o guia vivem em `src/`, os dois projetos
 * não compartilham código, e a documentação de automação parava nessa fronteira. O guia chegava a
 * dizer que o catálogo "não pode ser enumerado a partir daqui" e mandava o autor ler a tela de
 * Automações de uma instalação em execução — enquanto o construtor visual, dentro do app, tinha o
 * catálogo inteiro. O agente de IA que escrevia a extensão sabia menos que a tela.
 *
 * A metadata é DADO, e agora mora do lado em que o dado do kernel mora. Quem ganha executor é o
 * backend: `StepDefinition` é esta metadata mais `createExecutor`, e cada passo de
 * `functions/src/infrastructure/workflow/steps/` toma a sua daqui em vez de redeclará-la — sem isso
 * seriam duas fontes, e a segunda divergiria em silêncio.
 */

export type InputType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'EntityReference'
  | 'Expression'
  | 'OutputReference'
  | 'VariableReference'
  | 'Query'
  | 'Upsert'
  | 'Remove'
  | 'Map'
  | 'Validate';

/**
 * Os cinco `kind` de `InputMapping` — a forma como um valor chega a um input de passo. É a mesma
 * união de `InputMapping` em `domain/entities/Workflow.ts`, repetida aqui como união de STRING porque
 * `allowedMappingKinds` restringe por nome, não por objeto.
 */
export type InputMappingKind = 'Literal' | 'Event' | 'Expression' | 'Output' | 'Variable';

export type InputOptionsSource =
  | { kind: 'Static'; options: { value: string; label: string; color?: string }[] }
  | { kind: 'Lookup'; lookup: string };

/**
 * O que um input NOMEIA, quando o valor dele é o id de outra coisa declarada no escritório. É o que
 * faz o editor oferecer a lista em vez de pedir um id digitado — e é DECLARATIVO de propósito: antes
 * o seletor de workflow aparecia porque o input era a fonte dos inputs dinâmicos (`dynamicInputs`),
 * de modo que um alvo escolhido de outra forma (a saída de um passo anterior) ficava sem seletor
 * nenhum e um input que só aponta um alvo não tinha como pedir um.
 *
 * O seletor só é oferecido quando o mapping é `Literal`: um alvo que só se conhece em runtime não
 * tem lista a mostrar em design-time.
 */
/**
 * O kernel a partir do qual existem o passo `share-documents` e a entrada `portalShared` de
 * `render-document`. Um pacote que admite kernel anterior instalaria um fluxo que reprova no passo.
 */
export const PORTAL_DOCUMENT_SHARING_SINCE_KERNEL = '2.70.0';

export const SHARE_DOCUMENTS_STEP_ID = 'share-documents';

export const PORTAL_INVITE_STEP_ID = 'portal-invite';
export const PORTAL_REVOKE_STEP_ID = 'portal-revoke';

export type InputPickerKind =
  | 'workflow'
  | 'script'
  | 'ai-connection'
  | 'permission'
  | 'document-template'
  | 'document-template-reference'
  | 'documents-collection'
  | 'portal-subject'
  | 'portal-invite-subject';

export interface InputDefinition {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  type: InputType;
  defaultValue?: unknown;
  validator?: (value: unknown) => string | undefined;
  options?: InputOptionsSource;
  /**
   * Só relevante quando `type === 'EntityReference'`. É a COLEÇÃO apontada — a mesma chave que
   * `FieldDefinition.refEntity` usa: `members` (usuários do tenant) ou a coleção de uma tela do Form
   * Design ou de uma extensão. O kernel não conhece nenhuma coleção de negócio pelo nome.
   */
  entityType?: string;
  /**
   * O valor `Literal` é uma LISTA do que o input nomeia — vários membros, vários registros. Só muda o
   * controle do editor (`MultiSearchSelect` no lugar de `SearchSelect`); em runtime o passo recebe o
   * `string[]` gravado.
   */
  list?: boolean;
  /** Restringe os mappings aceitos. `undefined` aceita os cinco. */
  allowedMappingKinds?: InputMappingKind[];
  /** O que o valor deste input nomeia, para o editor oferecer a lista. Ver `InputPickerKind`. */
  picker?: InputPickerKind;
  /**
   * O input só vale para modelos de documento desta ORIGEM (`record` ou `payload`), no passo cujo alvo
   * é um modelo (`dynamicInputs: from-target-document-template-parameters`). O editor o esconde quando o
   * modelo escolhido é da outra origem, e o exige (`required`) quando é desta. Não vira `required` no
   * catálogo porque o motor cobra `required` em toda execução — e aí o modelo da outra origem falharia.
   */
  templateSource?: { is: 'record' | 'payload'; required?: boolean };
  /**
   * Validação por regex, só para `Literal` string. Mantido por compatibilidade: em runtime é lido
   * como um `rules.validate` equivalente (ver `toEffectiveRules` em `schema/fieldRules.ts`).
   */
  pattern?: string;
  patternMessage?: string;
  /** Regras de formatação e validação aplicadas ao valor resolvido, em design-time e em runtime. */
  rules?: FieldRules;
}

export interface OutputDefinition {
  id: string;
  label: string;
  type: InputType;
}

export type StepCategory = 'Action' | 'Data' | 'Notification' | 'Integration';

/**
 * O que uma ENTRADA de catálogo pode ser. Estritamente menor que o `StepType` de
 * `domain/entities/Workflow.ts`, que é o que um passo DECLARADO pode ser: aquele inclui os nós de
 * controle (`Condition`, `Loop`), que não têm entrada de catálogo nenhuma.
 */
export type CatalogStepType = 'Action' | 'Script' | 'SubWorkflow';

/**
 * Define se e como os outputs são dinâmicos (conhecidos apenas em runtime).
 * Usado pelo IntelliSense para sugerir variáveis mesmo quando o nome não é conhecido em design-time.
 */
export type DynamicOutputsMetadata =
  | {
      kind: 'from-input-field';
      /** ID(s) do(s) input(s) que definem o(s) nome(s) do(s) output(s). Ex: 'name' ou ['key1', 'key2'] */
      sourceInputId: string | string[];
      description?: string;
    }
  | {
      kind: 'runtime-only';
      description?: string;
    }
  | {
      kind: 'from-target-script-outputs';
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-workflow-outputs';
      /** ID do input (Literal) que guarda o id do workflow-alvo cujas "Saída do Workflow" viram saídas. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-workflow-parameters';
      /** ID do input que guarda o id do workflow-alvo cujos PARÂMETROS viram saídas deste passo. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-query-projections';
      /** ID do input do tipo 'Query' cujas projeções viram saídas `first.<projeção>`. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-validate-config';
      /** ID do input do tipo 'Validate' cujo ValidateStepConfig define a saída `<outputName>`. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-map-config';
      /** ID do input do tipo 'Map'. Com `name`, a saída é o objeto nomeado `<name>` (tipado por `type`);
       *  sem `name`, cada campo do MapStepConfig vira uma saída direta na raiz do step. */
      sourceInputId: string;
      description?: string;
    };

/**
 * Define se e como os inputs são dinâmicos (conhecidos apenas depois que o usuário escolhe um
 * alvo em design-time). Usado pelo editor para renderizar campos extras e pelo IntelliSense.
 */
export type DynamicInputsMetadata =
  | {
      kind: 'from-target-script-parameters';
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-workflow-parameters';
      /** ID do input (Literal) que guarda o id do workflow-alvo cujos parâmetros viram inputs. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-document-template-parameters';
      /** ID do input (Literal) que guarda a chave do modelo `payload` cujos parâmetros viram inputs `param.<chave>`. */
      sourceInputId: string;
      description?: string;
    };

/**
 * Uma entrada do catálogo, sem executor. É o que o backend espelha em `workflow_step_catalog/{id}`,
 * o que a callable `getWorkflowStepCatalog` devolve, e o que o MCP serve ao autor de extensão.
 */
export interface WorkflowStepMetadata {
  id: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  category: StepCategory;
  type: CatalogStepType;
  configurable: boolean;
  inputs: InputDefinition[];
  outputDefinitions: OutputDefinition[];
  /**
   * Define se este step gera outputs dinâmicos (nomes conhecidos apenas em runtime).
   * Ex: SetVariable gera output com nome definido pelo input 'name'.
   */
  dynamicOutputs?: DynamicOutputsMetadata;
  /**
   * Define se este step ganha inputs dinâmicos a partir de um alvo escolhido em design-time.
   * Ex: 'Chamar Workflow' expõe os parâmetros do workflow-alvo como inputs `param.<chave>`.
   */
  dynamicInputs?: DynamicInputsMetadata;
  /**
   * Cada execução ACRESCENTA um artefato novo (um arquivo anexado, por exemplo) sem chave que recuse
   * a repetição. Não se lê do tipo de input — o passo que gera documento não tem `Upsert` —, e sem
   * isto o agente ouviria "seguro repetir" de uma automação que anexa uma cópia a cada chamada.
   */
  appendsEachRun?: true;
  /**
   * Os gatilhos (`eventName`) em cuja automação o passo NÃO pode entrar. É propriedade do passo, e não
   * do gatilho, porque quem sabe o efeito colateral é quem o produz: o passo que grava na Auditoria sabe
   * que, numa automação disparada pela Auditoria, ele se reacenderia.
   *
   * Não é exibida nem editada — é contrato do catálogo. Quem a cobra: o editor (não oferece o passo,
   * nem deixa trocar o gatilho de um fluxo que já o tem), a validação de pacote e o motor, que recusa o
   * passo em runtime para o que chegou por fora das duas portas.
   */
  excludedTriggers?: readonly string[];
}

/** O passo não pode compor uma automação disparada por `eventName`. */
export const isStepExcludedFromTrigger = (
  metadata: Pick<WorkflowStepMetadata, 'excludedTriggers'> | undefined,
  eventName: string,
): boolean => !!metadata?.excludedTriggers?.includes(eventName);

const JS_RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'null', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

const VALID_VARIABLE_NAME_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * O nome de variável do passo `set-variable`. Vive aqui, e não junto do executor, porque quem mais
 * precisa da resposta é o design-time: a validação do pacote e o editor reprovam o nome inválido
 * antes de o fluxo rodar.
 */
export const validateVariableName = (value: unknown): string | undefined => {
  const name = String(value);
  if (!name) return '@core.automation/step.set-variable.name.empty';
  if (!VALID_VARIABLE_NAME_PATTERN.test(name)) return '@core.automation/step.set-variable.name.invalid';
  if (JS_RESERVED_WORDS.has(name)) return '@core.automation/step.set-variable.name.reserved';
  return undefined;
};

/**
 * Os passos que o kernel traz. Uma extensão acrescenta os próprios contribuindo para
 * `workflow.step` — este array é a BASELINE, não o universo.
 */
export const CORE_STEP_CATALOG: readonly WorkflowStepMetadata[] = [
  {
    /**
     * Um passo, quatro destinos. A versão 1 só gravava na Auditoria; os destinos novos entraram como
     * opções do MESMO passo, e não como um passo irmão, porque são a mesma intenção — avisar — e um
     * fluxo quer quase sempre os dois: o registro do escritório e a pessoa avisada.
     *
     * Sem nenhum destino marcado o passo continua indo só para a Auditoria, que é o que todo fluxo
     * salvo antes desta versão espera. Ver "Passo Notificar" no ARCHITECTURE.md.
     */
    id: 'notify',
    version: 2,
    name: '@core.automation/step.notify.name',
    description: '@core.automation/step.notify.description',
    icon: 'RiNotification3Line',
    category: 'Notification',
    type: 'Action',
    configurable: true,
    inputs: [
      { id: 'title', label: '@core.automation/step.notify.label.titulo', required: true, type: 'String' },
      { id: 'message', label: '@core.automation/step.notify.label.mensagem', required: true, type: 'String' },
      {
        id: 'messageParams',
        label: '@core.automation/step.notify.label.params',
        description: '@core.automation/step.notify.help.params',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Expression', 'Output', 'Variable', 'Event'],
      },
      {
        id: 'link',
        label: '@core.automation/step.notify.label.link',
        description: '@core.automation/step.notify.help.link',
        required: false,
        type: 'String',
      },
      {
        id: 'openRecord',
        label: '@core.automation/step.notify.label.open-record',
        description: '@core.automation/step.notify.help.open-record',
        required: false,
        type: 'Boolean',
        defaultValue: true,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'category',
        label: '@core.automation/step.notify.label.category',
        description: '@core.automation/step.notify.help.category',
        required: false,
        type: 'String',
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'toAudit',
        label: '@core.automation/step.notify.label.to-audit',
        required: false,
        type: 'Boolean',
        defaultValue: true,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'toInApp',
        label: '@core.automation/step.notify.label.to-in-app',
        required: false,
        type: 'Boolean',
        defaultValue: false,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'toEmail',
        label: '@core.automation/step.notify.label.to-email',
        required: false,
        type: 'Boolean',
        defaultValue: false,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'toPush',
        label: '@core.automation/step.notify.label.to-push',
        required: false,
        type: 'Boolean',
        defaultValue: false,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'toSms',
        label: '@core.automation/step.notify.label.to-sms',
        description: '@core.automation/step.notify.help.to-sms',
        required: false,
        type: 'Boolean',
        defaultValue: false,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'recipientMembers',
        label: '@core.automation/step.notify.label.recipient-members',
        required: false,
        type: 'EntityReference',
        entityType: 'members',
        list: true,
      },
      {
        id: 'recipientsFrom',
        label: '@core.automation/step.notify.label.recipients-from',
        description: '@core.automation/step.notify.help.recipients-from',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Event', 'Expression', 'Output', 'Variable'],
      },
      {
        id: 'recipientPermission',
        label: '@core.automation/step.notify.label.recipient-permission',
        description: '@core.automation/step.notify.help.recipient-permission',
        required: false,
        type: 'String',
        picker: 'permission',
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'portalGuests',
        label: '@core.automation/step.notify.label.portal-guests',
        description: '@core.automation/step.notify.help.portal-guests',
        required: false,
        type: 'Boolean',
        defaultValue: false,
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'portalRecord',
        label: '@core.automation/step.notify.label.portal-record',
        description: '@core.automation/step.notify.help.portal-record',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Event'],
      },
      // Só caminho do EVENTO: é o tipo do caminho que diz se ele termina num campo que a tela
      // declarou `contact` — uma expressão montaria qualquer endereço.
      {
        id: 'recipientAddresses',
        label: '@core.automation/step.notify.label.recipient-addresses',
        description: '@core.automation/step.notify.help.recipient-addresses',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Event'],
      },
      {
        id: 'recipientPhones',
        label: '@core.automation/step.notify.label.recipient-phones',
        description: '@core.automation/step.notify.help.recipient-phones',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Event'],
      },
    ],
    outputDefinitions: [
      { id: 'recipients', label: '@core.automation/step.notify.output.recipients', type: 'Number' },
      { id: 'delivered.audit', label: '@core.automation/step.notify.output.delivered.audit', type: 'Number' },
      { id: 'delivered.inApp', label: '@core.automation/step.notify.output.delivered.in-app', type: 'Number' },
      { id: 'delivered.email', label: '@core.automation/step.notify.output.delivered.email', type: 'Number' },
      { id: 'delivered.push', label: '@core.automation/step.notify.output.delivered.push', type: 'Number' },
      { id: 'delivered.sms', label: '@core.automation/step.notify.output.delivered.sms', type: 'Number' },
      { id: 'failed.audit', label: '@core.automation/step.notify.output.failed.audit', type: 'Number' },
      { id: 'failed.inApp', label: '@core.automation/step.notify.output.failed.in-app', type: 'Number' },
      { id: 'failed.email', label: '@core.automation/step.notify.output.failed.email', type: 'Number' },
      { id: 'failed.push', label: '@core.automation/step.notify.output.failed.push', type: 'Number' },
      { id: 'failed.sms', label: '@core.automation/step.notify.output.failed.sms', type: 'Number' },
      { id: 'optedOut', label: '@core.automation/step.notify.output.opted-out', type: 'Number' },
    ],
  },
  {
    id: 'register-audit',
    version: 1,
    name: '@core.automation/step.register-audit.name',
    description: '@core.automation/step.register-audit.description',
    icon: 'RiFileHistoryLine',
    category: 'Action',
    type: 'Action',
    configurable: true,
    // Grava um log que reacenderia a própria automação. O motor já ignora o log de máquina; recusar o
    // passo na autoria é dizer ao autor, antes de salvar, que ali ele não faria nada.
    excludedTriggers: [WORKFLOW_AUDIT_EVENT],
    inputs: [
      { id: 'title', label: '@core.automation/step.register-audit.label.titulo', required: true, type: 'String' },
      { id: 'message', label: '@core.automation/step.register-audit.label.mensagem', required: true, type: 'String' },
      {
        id: 'severity',
        label: '@core.automation/step.register-audit.label.severidade',
        required: true,
        type: 'String',
        options: {
          kind: 'Static',
          options: [
            { value: 'LOW', label: '@core.automation/step.register-audit.label.baixa', color: 'info' },
            { value: 'HIGH', label: '@core.automation/step.register-audit.label.alta', color: 'warning' },
            { value: 'CRITICAL', label: '@core.automation/step.register-audit.label.critica', color: 'danger' },
          ],
        },
        defaultValue: 'LOW',
      },
      {
        id: 'entity',
        label: '@core.automation/step.register-audit.label.entidade-relacionada',
        required: false,
        type: 'String',
        defaultValue: 'workflow',
      },
      {
        id: 'entityId',
        label: '@core.automation/step.register-audit.label.id-da-entidade-relacionada',
        required: false,
        type: 'String',
      },
    ],
    outputDefinitions: [],
  },
  {
    id: 'set-variable',
    version: 2,
    name: '@core.automation/step.set-variable.name',
    description: '@core.automation/step.set-variable.description',
    icon: 'RiBracesLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'name',
        label: '@core.automation/step.set-variable.label.nome-da-variavel',
        required: true,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        pattern: '^[a-zA-Z_$][a-zA-Z0-9_$]*$',
        patternMessage: '@core.automation/step.set-variable.name.invalid',
        validator: validateVariableName,
      },
      { id: 'value', label: '@core.automation/step.set-variable.label.valor', required: true, type: 'Expression' },
    ],
    outputDefinitions: [],
    dynamicOutputs: {
      kind: 'from-input-field',
      sourceInputId: 'name',
      description: '@core.automation/step.set-variable.description',
    },
  },
  {
    id: 'map',
    version: 1,
    name: '@core.automation/step.map.name',
    description: '@core.automation/step.map.description',
    icon: 'RiBracketsLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'map',
        label: '@core.automation/step.map.label.objeto',
        required: true,
        type: 'Map',
        allowedMappingKinds: ['Literal'],
      },
    ],
    outputDefinitions: [],
    dynamicOutputs: {
      kind: 'from-map-config',
      sourceInputId: 'map',
      description: '@core.automation/step.map.description',
    },
  },
  {
    id: 'validate-object',
    version: 1,
    name: '@core.automation/step.validate-object.name',
    description: '@core.automation/step.validate.description',
    icon: 'RiShieldCheckLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'validate',
        label: '@core.automation/step.validate-object.label.validacao',
        required: true,
        type: 'Validate',
        allowedMappingKinds: ['Literal'],
      },
    ],
    outputDefinitions: [],
    dynamicOutputs: {
      kind: 'from-validate-config',
      sourceInputId: 'validate',
      description: '@core.automation/step.validate-object.description',
    },
  },
  {
    id: 'exit',
    version: 1,
    name: '@core.automation/step.exit.name',
    description: '@core.automation/step.exit.description',
    icon: 'RiLogoutBoxRLine',
    category: 'Action',
    type: 'Action',
    configurable: false,
    inputs: [],
    outputDefinitions: [],
  },
  {
    id: 'delay',
    version: 1,
    name: '@core.automation/step.delay.name',
    description: '@core.automation/step.delay.description',
    icon: 'RiHourglassLine',
    category: 'Action',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'duration',
        label: '@core.automation/step.delay.label.duration',
        description: '@core.automation/step.delay.help.duration',
        required: false,
        type: 'String',
      },
      {
        id: 'until',
        label: '@core.automation/step.delay.label.until',
        description: '@core.automation/step.delay.help.until',
        required: false,
        type: 'Date',
      },
    ],
    outputDefinitions: [
      { id: 'resumeAt', label: '@core.automation/step.delay.label.resume-at', type: 'Date' },
    ],
  },
  {
    id: 'call-workflow',
    version: 2,
    name: '@core.automation/step.call-workflow.name',
    description: '@core.automation/step.call-workflow.description',
    icon: 'RiFlowChart',
    category: 'Action',
    type: 'SubWorkflow',
    configurable: true,
    inputs: [
      {
        /**
         * O alvo já não é obrigatoriamente escolhido em design-time: ele pode vir da saída de um
         * passo anterior — é o que permite a um fluxo detectar a automação a partir de um texto e
         * chamá-la. Quando o mapping é `Literal`, tudo segue como antes (seletor, `param.<chave>` e
         * as saídas do alvo); quando não é, não há o que oferecer em design-time e quem carrega os
         * parâmetros é o input `params`.
         */
        id: 'targetWorkflowId',
        label: '@core.automation/step.call-workflow.label.target',
        required: true,
        type: 'String',
        picker: 'workflow',
      },
      {
        /**
         * Os parâmetros EM BLOCO, num objeto cujas chaves são as do workflow-alvo. Aplicado antes
         * dos `param.<chave>` explícitos, que vencem chave por chave: quem extraiu tudo de um texto
         * livre ainda pode fixar um campo à mão.
         */
        id: 'params',
        label: '@core.automation/step.call-workflow.label.params',
        description: '@core.automation/step.call-workflow.params.description',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Expression', 'Output', 'Variable', 'Event'],
      },
      {
        id: 'waitForResult',
        label: '@core.automation/step.call-workflow.label.aguardar-retorno',
        description: '@core.automation/step.call-workflow.wait.description',
        required: false,
        type: 'Boolean',
        defaultValue: false,
        allowedMappingKinds: ['Literal'],
      },
    ],
    outputDefinitions: [],
    dynamicInputs: { kind: 'from-target-workflow-parameters', sourceInputId: 'targetWorkflowId' },
    dynamicOutputs: {
      kind: 'from-target-workflow-outputs',
      sourceInputId: 'targetWorkflowId',
      description: '@core.automation/step.call-workflow.description',
    },
  },
  {
    id: 'script',
    version: 1,
    name: '@core.automation/step.script.name',
    description: '@core.automation/step.script.description',
    icon: 'RiCodeBoxLine',
    category: 'Integration',
    type: 'Script',
    configurable: true,
    inputs: [
      {
        id: 'scriptId',
        label: '@core.automation/step.script.label.script',
        required: true,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'script',
      },
    ],
    outputDefinitions: [],
    dynamicInputs: { kind: 'from-target-script-parameters', sourceInputId: 'scriptId' },
    dynamicOutputs: { kind: 'from-target-script-outputs', sourceInputId: 'scriptId' },
  },
  {
    /**
     * A DECISÃO de qual automação atende um texto livre — o que a tela do Extrator de Dados faz
     * quando alguém clica em "detectar", agora disponível como passo. É o que permite a um fluxo
     * começar sozinho num e-mail em vez de alguém colar o texto e escolher a automação na mão.
     *
     * Não encontrar nada é um resultado, não um erro: o passo termina com SUCESSO e `found` em
     * falso, para que quem declara decida com um nó de Condição o que fazer com o que não se
     * classificou. Falhar aqui tiraria do autor justamente o caminho da triagem humana.
     */
    id: 'ai-detect-workflow',
    version: 1,
    name: '@core.automation/step.ai-detect-workflow.name',
    description: '@core.automation/step.ai-detect-workflow.description',
    icon: 'RiRobot2Line',
    category: 'Integration',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'text',
        label: '@core.automation/step.ai.label.text',
        description: '@core.automation/step.ai.text.description',
        required: true,
        type: 'String',
      },
      {
        id: 'connectionId',
        label: '@core.automation/step.ai.label.connection',
        description: '@core.automation/step.ai.connection.description',
        required: false,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'ai-connection',
      },
    ],
    outputDefinitions: [
      { id: 'found', label: '@core.automation/step.ai-detect-workflow.label.found', type: 'Boolean' },
      { id: 'workflowId', label: '@core.automation/step.ai-detect-workflow.label.workflow-id', type: 'String' },
      { id: 'workflowName', label: '@core.automation/step.ai-detect-workflow.label.workflow-name', type: 'String' },
      { id: 'candidates', label: '@core.automation/step.ai-detect-workflow.label.candidates', type: 'String' },
    ],
  },
  {
    /**
     * O TEXTO LIVRE virando os parâmetros de uma automação, contra o esquema que ela mesma declara.
     * O alvo pode ser escolhido aqui ou vir da saída do passo de detecção — e é essa segunda forma
     * que fecha o caminho "e-mail chega, o sistema decide, o sistema executa".
     */
    id: 'ai-extract-parameters',
    version: 1,
    name: '@core.automation/step.ai-extract-parameters.name',
    description: '@core.automation/step.ai-extract-parameters.description',
    icon: 'RiAiGenerate',
    category: 'Integration',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'text',
        label: '@core.automation/step.ai.label.text',
        description: '@core.automation/step.ai.text.description',
        required: true,
        type: 'String',
      },
      {
        id: 'targetWorkflowId',
        label: '@core.automation/step.ai-extract-parameters.label.target',
        description: '@core.automation/step.ai-extract-parameters.target.description',
        required: true,
        type: 'String',
        picker: 'workflow',
      },
      {
        id: 'connectionId',
        label: '@core.automation/step.ai.label.connection',
        description: '@core.automation/step.ai.connection.description',
        required: false,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'ai-connection',
      },
    ],
    outputDefinitions: [
      { id: 'params', label: '@core.automation/step.ai-extract-parameters.label.params', type: 'String' },
      { id: 'filled', label: '@core.automation/step.ai-extract-parameters.label.filled', type: 'Number' },
    ],
    dynamicOutputs: {
      kind: 'from-target-workflow-parameters',
      sourceInputId: 'targetWorkflowId',
      description: '@core.automation/step.ai-extract-parameters.description',
    },
  },
  {
    id: 'query',
    version: 1,
    name: '@core.automation/step.query.name',
    description: '@core.automation/step.query.description',
    icon: 'RiSearchLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'query',
        label: '@core.automation/step.query.label.consulta',
        required: true,
        type: 'Query',
        allowedMappingKinds: ['Literal'],
      },
    ],
    outputDefinitions: [
      { id: 'count', label: '@core.automation/step.query.label.quantidade-encontrada', type: 'Number' },
      { id: 'results', label: '@core.automation/step.query.label.resultados-lista', type: 'String' },
      { id: 'first', label: '@core.automation/step.query.label.primeiro-resultado', type: 'String' },
      { id: 'hasMore', label: '@core.automation/step.query.label.has-more', type: 'Boolean' },
      { id: 'cursor', label: '@core.automation/step.query.label.cursor', type: 'String' },
    ],
    dynamicOutputs: {
      kind: 'from-query-projections',
      sourceInputId: 'query',
      description: '@core.automation/step.query.description',
    },
  },
  {
    id: 'upsert',
    version: 2,
    name: '@core.automation/step.upsert.name',
    description: '@core.automation/step.upsert.description',
    icon: 'RiSaveLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'upsert',
        label: '@core.automation/step.upsert.label.gravacao',
        required: true,
        type: 'Upsert',
        allowedMappingKinds: ['Literal'],
      },
    ],
    outputDefinitions: [
      { id: 'id', label: '@core.automation/step.upsert.label.id-do-registro-gravado', type: 'String' },
      { id: 'created', label: '@core.automation/step.upsert.label.foi-incluido-novo', type: 'Boolean' },
      { id: 'record', label: '@core.automation/step.upsert.label.registro-gravado', type: 'String' },
    ],
  },
  {
    id: 'remove',
    version: 1,
    name: '@core.automation/step.remove.name',
    description: '@core.automation/step.remove.description',
    icon: 'RiDeleteBin6Line',
    category: 'Data',
    type: 'Action',
    configurable: true,
    // A exclusão feita pelo motor não carimba quem excluiu, e o log dela sai atribuído ao último autor
    // do registro — uma pessoa. A trava causal não o distingue de um gesto humano, e cada exclusão
    // reacenderia a automação que a fez.
    excludedTriggers: [WORKFLOW_AUDIT_EVENT],
    inputs: [
      {
        id: 'remove',
        label: '@core.automation/step.remove.label.exclusao',
        required: true,
        type: 'Remove',
        allowedMappingKinds: ['Literal'],
      },
    ],
    outputDefinitions: [
      { id: 'id', label: '@core.automation/step.remove.label.id-do-registro', type: 'String' },
      { id: 'removed', label: '@core.automation/step.remove.label.foi-excluido', type: 'Boolean' },
    ],
  },
  {
    /**
     * Gera o documento de um registro a partir de um modelo (`document.template` ou o do escritório,
     * que vence na mesma chave) e o entrega na aba Documentos ou em Downloads. A tela é a do MODELO:
     * quem escolhe o modelo escolhe de que registro ele fala, e por isso não há input de coleção. O
     * modelo `payload` não tem registro: os dados vêm de `payload` e dos `param.<chave>` que os
     * parâmetros dele geram.
     */
    id: 'render-document',
    version: 1,
    name: '@core.automation/step.render-document.name',
    description: '@core.automation/step.render-document.description',
    icon: 'RiFileTextLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'templateKey',
        label: '@core.automation/step.render-document.label.template',
        required: true,
        type: 'String',
        picker: 'document-template',
      },
      {
        id: 'recordId',
        label: '@core.automation/step.render-document.label.record',
        description: '@core.automation/step.render-document.help.record',
        required: false,
        type: 'String',
        templateSource: { is: 'record', required: true },
      },
      {
        /**
         * Os dados de um modelo `payload` EM BLOCO — tipicamente o que um passo anterior montou. Os
         * `param.<chave>` declarados um a um vencem chave por chave, como em "Chamar Workflow".
         */
        id: 'payload',
        label: '@core.automation/step.render-document.label.payload',
        description: '@core.automation/step.render-document.help.payload',
        required: false,
        type: 'Expression',
        allowedMappingKinds: ['Expression', 'Output', 'Variable', 'Event'],
        templateSource: { is: 'payload' },
      },
      {
        /**
         * O dono do documento de dados: a chave de um parâmetro `EntityReference` do modelo. Com destino
         * `record`, o arquivo é anexado ao registro que ele aponta; com Downloads, esse registro vira a
         * origem do item. É de quem gera, não do modelo — o mesmo modelo serve a mais de uma tela.
         */
        id: 'belongsTo',
        label: '@core.automation/step.render-document.label.belongs-to',
        description: '@core.automation/step.render-document.help.belongs-to',
        required: false,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'document-template-reference',
        templateSource: { is: 'payload' },
      },
      {
        id: 'output',
        label: '@core.automation/step.render-document.label.output',
        description: '@core.automation/step.render-document.help.output',
        required: false,
        type: 'String',
        options: {
          kind: 'Static',
          options: [
            { value: 'pdf', label: '@core.automation/step.render-document.output.pdf' },
            { value: 'docx', label: '@core.automation/step.render-document.output.docx' },
          ],
        },
      },
      {
        id: 'fileName',
        label: '@core.automation/step.render-document.label.file-name',
        description: '@core.automation/step.render-document.help.file-name',
        required: false,
        type: 'String',
      },
      {
        id: 'documentType',
        label: '@core.automation/step.render-document.label.document-type',
        required: false,
        type: 'String',
        options: { kind: 'Lookup', lookup: 'documentTypes' },
      },
      {
        id: 'destination',
        label: '@core.automation/step.render-document.label.destination',
        description: '@core.automation/step.render-document.help.destination',
        required: false,
        type: 'String',
        options: {
          kind: 'Static',
          options: [
            { value: 'record', label: '@core.automation/step.render-document.destination.record' },
            { value: 'downloads', label: '@core.automation/step.render-document.destination.downloads' },
          ],
        },
      },
      {
        id: 'expiresInDays',
        label: '@core.automation/step.render-document.label.expires-in-days',
        description: '@core.automation/step.render-document.help.expires-in-days',
        required: false,
        type: 'Number',
      },
      {
        /**
         * O documento gerado já nasce compartilhado com o portal — o mesmo `portalShared` que o upload
         * do convidado e a marca da tela gravam. Só vale para a aba Documentos: Downloads não está no
         * portal, e pedir os dois reprova o passo em vez de entregar metade.
         */
        id: 'portalShared',
        label: '@core.automation/step.render-document.label.portal-shared',
        description: '@core.automation/step.render-document.help.portal-shared',
        required: false,
        type: 'Boolean',
        defaultValue: false,
      },
    ],
    outputDefinitions: [
      { id: 'documentId', label: '@core.automation/step.render-document.output.document-id', type: 'String' },
      { id: 'name', label: '@core.automation/step.render-document.output.name', type: 'String' },
      { id: 'url', label: '@core.automation/step.render-document.output.url', type: 'String' },
      { id: 'format', label: '@core.automation/step.render-document.output.format', type: 'String' },
      { id: 'emptyFields', label: '@core.automation/step.render-document.output.empty-fields', type: 'Number' },
      { id: 'destination', label: '@core.automation/step.render-document.output.destination', type: 'String' },
      { id: 'expiresAt', label: '@core.automation/step.render-document.output.expires-at', type: 'String' },
    ],
    dynamicInputs: { kind: 'from-target-document-template-parameters', sourceInputId: 'templateKey' },
    appendsEachRun: true,
  },
  {
    /**
     * Compartilhar (ou deixar de compartilhar) com o portal os documentos que um registro JÁ tem — o
     * gesto que a liberação "na hora certa" pede: ao confirmar, ao abrir, ao assinar. Sem
     * `documentId`, vale para todos os documentos do registro (filtrados por `documentType`), porque
     * quem reage ao evento do registro não conhece os ids dos anexos. Idempotente: o documento que já
     * está no estado pedido não é regravado.
     */
    id: 'share-documents',
    version: 1,
    name: '@core.automation/step.share-documents.name',
    description: '@core.automation/step.share-documents.description',
    icon: 'RiShareLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'collection',
        label: '@core.automation/step.share-documents.label.collection',
        description: '@core.automation/step.share-documents.help.collection',
        required: true,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'documents-collection',
      },
      {
        id: 'recordId',
        label: '@core.automation/step.share-documents.label.record',
        required: true,
        type: 'String',
      },
      {
        id: 'shared',
        label: '@core.automation/step.share-documents.label.shared',
        description: '@core.automation/step.share-documents.help.shared',
        required: false,
        type: 'Boolean',
        defaultValue: true,
      },
      {
        id: 'documentId',
        label: '@core.automation/step.share-documents.label.document',
        description: '@core.automation/step.share-documents.help.document',
        required: false,
        type: 'String',
      },
      {
        id: 'documentType',
        label: '@core.automation/step.share-documents.label.document-type',
        description: '@core.automation/step.share-documents.help.document-type',
        required: false,
        type: 'String',
        options: { kind: 'Lookup', lookup: 'documentTypes' },
      },
    ],
    outputDefinitions: [
      { id: 'matched', label: '@core.automation/step.share-documents.output.matched', type: 'Number' },
      { id: 'changed', label: '@core.automation/step.share-documents.output.changed', type: 'Number' },
      { id: 'shared', label: '@core.automation/step.share-documents.output.shared', type: 'Boolean' },
    ],
  },
  {
    /**
     * Convidar alguém de fora para um registro-sujeito do portal — o mesmo convite de Configurações ›
     * Portal (a mesma conta, a mesma marca, o mesmo vínculo), feito pelo fluxo que valida o registro
     * do representante. Só nas telas que declaram `portal.invites.automation`. Idempotente por
     * (e-mail, sujeito): o convite que já existe não é refeito, não conta no limite por hora e não
     * manda outro e-mail.
     */
    id: PORTAL_INVITE_STEP_ID,
    version: 1,
    name: '@core.automation/step.portal-invite.name',
    description: '@core.automation/step.portal-invite.description',
    icon: 'RiUserAddLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'subjectCollection',
        label: '@core.automation/step.portal-access.label.subject-collection',
        description: '@core.automation/step.portal-invite.help.subject-collection',
        required: true,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'portal-invite-subject',
      },
      {
        id: 'subjectRecordId',
        label: '@core.automation/step.portal-access.label.subject-record',
        required: true,
        type: 'String',
      },
      {
        id: 'email',
        label: '@core.automation/step.portal-access.label.email',
        required: true,
        type: 'String',
      },
      {
        id: 'displayName',
        label: '@core.automation/step.portal-invite.label.display-name',
        description: '@core.automation/step.portal-invite.help.display-name',
        required: false,
        type: 'String',
      },
      {
        // O papel do convidado NESTE sujeito — uma chave que a condição da tela compara
        // (`actor.portalRoles`). Vazio, o vínculo novo nasce sem papel e o existente fica com o seu.
        id: 'role',
        label: '@core.automation/step.portal-invite.label.role',
        description: '@core.automation/step.portal-invite.help.role',
        required: false,
        type: 'String',
      },
      {
        id: 'sendEmail',
        label: '@core.automation/step.portal-invite.label.send-email',
        description: '@core.automation/step.portal-invite.help.send-email',
        required: false,
        type: 'Boolean',
        defaultValue: true,
      },
      {
        // Com o nome, o convite é por IDENTIDADE: só quem provar a claim por um provedor do
        // escritório o aceita, e o valor vazio reprova o passo — nunca vira convite pelo e-mail.
        id: 'requiredClaimName',
        label: '@core.automation/step.portal-invite.label.required-claim-name',
        description: '@core.automation/step.portal-invite.help.required-claim-name',
        required: false,
        type: 'String',
        allowedMappingKinds: ['Literal'],
      },
      {
        id: 'requiredClaimValue',
        label: '@core.automation/step.portal-invite.label.required-claim-value',
        description: '@core.automation/step.portal-invite.help.required-claim-value',
        required: false,
        type: 'String',
      },
      {
        id: 'requiredClaimNormalize',
        label: '@core.automation/step.portal-invite.label.required-claim-normalize',
        required: false,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        options: {
          kind: 'Static',
          options: [
            { value: 'digits', label: '@core.tenant/portal.claim.normalize.digits' },
            { value: 'lowercase', label: '@core.tenant/portal.claim.normalize.lowercase' },
          ],
        },
      },
    ],
    outputDefinitions: [
      { id: 'guestId', label: '@core.automation/step.portal-access.output.guest-id', type: 'String' },
      { id: 'created', label: '@core.automation/step.portal-invite.output.created', type: 'Boolean' },
      { id: 'granted', label: '@core.automation/step.portal-invite.output.granted', type: 'Boolean' },
      { id: 'emailed', label: '@core.automation/step.portal-invite.output.emailed', type: 'Boolean' },
      { id: 'inviteId', label: '@core.automation/step.portal-invite.output.invite-id', type: 'String' },
      { id: 'roleChanged', label: '@core.automation/step.portal-invite.output.role-changed', type: 'Boolean' },
    ],
  },
  {
    /**
     * Tirar de um convidado o acesso a um registro-sujeito — ou, com `allSubjects`, o convite inteiro,
     * desde que ele tenha aquele sujeito. Vale no instante, como em Configurações › Portal. Recolher
     * não pede a declaração `portal.invites`: tirar acesso nunca expõe nada.
     */
    id: PORTAL_REVOKE_STEP_ID,
    version: 1,
    name: '@core.automation/step.portal-revoke.name',
    description: '@core.automation/step.portal-revoke.description',
    icon: 'RiUserUnfollowLine',
    category: 'Data',
    type: 'Action',
    configurable: true,
    inputs: [
      {
        id: 'subjectCollection',
        label: '@core.automation/step.portal-access.label.subject-collection',
        description: '@core.automation/step.portal-revoke.help.subject-collection',
        required: true,
        type: 'String',
        allowedMappingKinds: ['Literal'],
        picker: 'portal-subject',
      },
      {
        id: 'subjectRecordId',
        label: '@core.automation/step.portal-access.label.subject-record',
        required: true,
        type: 'String',
      },
      {
        id: 'email',
        label: '@core.automation/step.portal-access.label.email',
        required: true,
        type: 'String',
      },
      {
        id: 'allSubjects',
        label: '@core.automation/step.portal-revoke.label.all-subjects',
        description: '@core.automation/step.portal-revoke.help.all-subjects',
        required: false,
        type: 'Boolean',
        defaultValue: false,
      },
    ],
    outputDefinitions: [
      { id: 'guestId', label: '@core.automation/step.portal-access.output.guest-id', type: 'String' },
      { id: 'revoked', label: '@core.automation/step.portal-revoke.output.revoked', type: 'Boolean' },
    ],
  },
];

const BY_ID: ReadonlyMap<string, WorkflowStepMetadata> = new Map(
  CORE_STEP_CATALOG.map((step) => [step.id, step]),
);

/**
 * A metadata de um passo do kernel. Os `make…StepDefinition` do backend a tomam daqui, e é o que
 * impede o catálogo de ter duas fontes.
 */
export const coreStepMetadata = (id: string): WorkflowStepMetadata => {
  const found = BY_ID.get(id);
  if (found === undefined) {
    throw new Error(`Unknown core step definition id: ${id}`);
  }
  return found;
};

export const isCoreStepDefinitionId = (id: string): boolean => BY_ID.has(id);

export const CORE_STEP_DEFINITION_IDS: readonly string[] = CORE_STEP_CATALOG.map((step) => step.id);

/**
 * Os nós de CONTROLE do fluxo. Não são entradas de catálogo: o `WorkflowExecutor` os interpreta pelo
 * `type` do passo ANTES de consultar o registro, e `stepDefinitionId` fica vazio neles. Estão aqui
 * porque quem valida uma declaração precisa saber que esses dois são a exceção legítima ao "todo
 * passo nomeia uma entrada do catálogo".
 */
export const CONTROL_STEP_TYPES: readonly string[] = ['Condition', 'Loop'];

/**
 * O TIPO `Delay` está em `STEP_TYPES` e não é um nó de controle: a espera é o PASSO `delay` do catálogo
 * (`type: 'Action'`, `stepDefinitionId: 'delay'`), que pausa a execução pelo mesmo contrato com que o
 * `exit` a encerra — o resultado do passo pede, o executor obedece. Um passo `type: 'Delay'` não é
 * interceptado por ninguém: cai em `registry.resolve(undefined)` e falha em runtime.
 *
 * A união fica como está — remover um valor de `STEP_TYPES` quebraria declarações já gravadas —, e a
 * validação do pacote reprova quem usar o tipo, apontando para o passo.
 */
export const UNIMPLEMENTED_STEP_TYPES: readonly string[] = ['Delay'];

/**
 * Os passos que PAUSAM a execução. O motor só retoma no nível principal do fluxo — dentro de um ramo de
 * condição ou do corpo de uma repetição a pausa falharia com o fluxo rodando. Uma regra só para quem a
 * cobra: o editor (que não oferece nem deixa arrastar), a validação de pacote e o modelo de domínio.
 */
export const PAUSING_STEP_DEFINITION_IDS: readonly string[] = ['delay'];

export const isPausingStepDefinition = (stepDefinitionId: string | undefined): boolean =>
  !!stepDefinitionId && PAUSING_STEP_DEFINITION_IDS.includes(stepDefinitionId);

/**
 * Os inputs de um passo para um modelo de documento da origem `source`: o que só vale para a outra
 * origem sai, e o que a origem exige passa a `required`. Sem origem (nenhum modelo escolhido), todos
 * ficam como estão. Ver `templateSource`.
 */
export const inputsForTemplateSource = <T extends Pick<InputDefinition, 'required' | 'templateSource'>>(
  inputs: readonly T[],
  source: 'record' | 'payload' | null,
): T[] =>
  source === null
    ? [...inputs]
    : inputs.flatMap((input) => {
      if (!input.templateSource) return [input];
      if (input.templateSource.is !== source) return [];
      return [input.templateSource.required ? { ...input, required: true } : input];
    });

