// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowStepCatalog.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowStepCatalog.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

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
export type InputPickerKind = 'workflow' | 'script' | 'ai-connection';

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
  /** Restringe os mappings aceitos. `undefined` aceita os cinco. */
  allowedMappingKinds?: InputMappingKind[];
  /** O que o valor deste input nomeia, para o editor oferecer a lista. Ver `InputPickerKind`. */
  picker?: InputPickerKind;
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
}

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
    id: 'notify',
    version: 1,
    name: '@core.automation/step.notify.name',
    description: '@core.automation/step.notify.description',
    icon: 'RiNotification3Line',
    category: 'Notification',
    type: 'Action',
    configurable: true,
    inputs: [
      { id: 'title', label: '@core.automation/step.notify.label.titulo', required: true, type: 'String' },
      { id: 'message', label: '@core.automation/step.notify.label.mensagem', required: true, type: 'String' },
    ],
    outputDefinitions: [],
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
