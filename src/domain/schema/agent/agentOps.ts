import { PERMISSION_AUTOMATION_RUN } from '../access/kernelPermissions';
import { QUERY_OPERATORS } from '../querySpec';
import type { CrudAction } from '../access/permission';

/**
 * As operações que um agente de IA executa contra um escritório.
 *
 * **Nenhuma delas tem nome de negócio, e é isso que faz a superfície valer para qualquer extensão.**
 * A coleção é ARGUMENTO, nunca parte do nome — a mesma propriedade que `FirebaseRecordRepository` e
 * `RecordStore` já têm, levada até a superfície de ferramentas. Uma API por entidade instalada
 * obrigaria o kernel a conhecer a extensão, que é exatamente o que este projeto existe para não
 * fazer; e faria a lista de ferramentas crescer com cada instalação, gastando a janela do modelo com
 * o que ele descobre sozinho por `describe_screen`.
 */
export const AGENT_OPERATIONS = [
  'describe_screen',
  'search_records',
  'get_record',
  'create_record',
  'update_record',
  'delete_record',
  'run_report',
  'run_workflow',
  'get_workflow_run',
  'run_action',
] as const;

export type AgentOperation = (typeof AGENT_OPERATIONS)[number];

/**
 * Como a permissão de uma operação é cobrada.
 *
 * Fica DECLARADO aqui, e não espalhado pelo despacho, porque é a decisão de segurança de cada
 * operação — e uma decisão de segurança que mora junto do código que a executa é uma que ninguém
 * consegue auditar de uma vez.
 */
export type AgentPermissionRule =
  /** `<coleção>.<ação>`, com a coleção vinda do argumento da chamada. */
  | { kind: 'collection'; action: CrudAction }
  /** Uma permissão fixa do catálogo. */
  | { kind: 'fixed'; id: string }
  /**
   * Quem executa cobra. É o caso do relatório: `requireReportCollections` já cobra a leitura de cada
   * coleção que o spec alcança, INCLUSIVE as alcançadas por referência, que nenhuma regra declarada
   * aqui saberia enumerar.
   */
  | { kind: 'delegated' };

export interface AgentToolDefinition {
  name: AgentOperation;
  /**
   * Em inglês, como no MCP de autoria e por que o mesmo motivo: é documentação de API entregue a quem
   * consome, o mesmo leitor de `extensionTypeDefs.ts` e do `AUTHORING.md`. Não é texto de tela, e por
   * isso não passa pelo catálogo.
   */
  description: string;
  inputSchema: Record<string, unknown>;
  permission: AgentPermissionRule;
  /** Muda dado. É o que separa o acesso somente-leitura, e o que o aviso de `office/info` enumera. */
  writes: boolean;
}

const object = (
  properties: Record<string, unknown>,
  required: string[],
): Record<string, unknown> => ({ type: 'object', properties, required, additionalProperties: false });

const COLLECTION = {
  type: 'string',
  description: 'Collection name, as listed in the microteia://office/screens resource.',
};

const RECORD_ID = { type: 'string', description: 'The record id.' };

/**
 * O valor de um filtro é um valor CRU, e não um `InputMapping`.
 *
 * O executor fala `InputMapping` porque ele serve o motor de automações, onde um filtro pode apontar
 * para a saída de um passo. Um agente não tem passo anterior: pedir-lhe `{ kind: 'Literal', value }`
 * seria expor uma forma interna sem lhe dar nada em troca. O despacho embrulha.
 */
const WHERE = {
  type: 'array',
  description:
    'Filters, combined with AND. Equality filters are answered by the database; the others are '
    + 'applied in memory over the scanned window, so prefer at least one equality filter on a '
    + 'large collection.',
  items: object(
    {
      path: {
        type: 'string',
        description:
          'A field key, or a path into a referenced record (for example "client.city"). '
          + 'Use describe_screen to see which fields exist.',
      },
      op: { type: 'string', enum: [...QUERY_OPERATORS] },
      value: {
        description: 'The value to compare against. Omit it for the "exists" operator.',
      },
    },
    ['path', 'op'],
  ),
};

const ORDER_BY = {
  type: 'array',
  description: 'Ordering, applied in memory after the scan.',
  items: object(
    { path: { type: 'string' }, dir: { type: 'string', enum: ['asc', 'desc'] } },
    ['path', 'dir'],
  ),
};

const DATA = {
  type: 'object',
  description:
    'Field keys and values, as described by describe_screen. Dates are "YYYY-MM-DD", times are '
    + '"HH:mm", and a reference field takes the id of the referenced record.',
};

/**
 * A superfície inteira, e ela é deliberadamente pequena.
 *
 * `describe_screen` é o que dispensa uma ferramenta por entidade: ele devolve os campos, os tipos, os
 * obrigatórios, as chaves e as opções daquela tela, e a partir dele as sete operações genéricas
 * bastam para qualquer coleção que o escritório tenha instalado ou criado.
 */
export const AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'describe_screen',
    description:
      'The full field schema of one screen: every field with its type, whether it is required, the '
      + 'available options, the uniqueness keys, and the validation rules. Read this before writing '
      + 'to a collection you have not written to yet — field keys are not guessable from labels.',
    inputSchema: object({ collection: COLLECTION }, ['collection']),
    permission: { kind: 'collection', action: 'read' },
    writes: false,
  },
  {
    name: 'search_records',
    description:
      'Find records in a collection. Returns the matching records plus how many documents were '
      + 'scanned and whether the scan was complete — an incomplete scan means there may be more '
      + 'matches than the ones returned, so narrow the filters rather than trusting the count.',
    inputSchema: object(
      {
        collection: COLLECTION,
        where: WHERE,
        orderBy: ORDER_BY,
        limit: { type: 'integer', minimum: 1, description: 'Maximum records to return.' },
      },
      ['collection'],
    ),
    permission: { kind: 'collection', action: 'read' },
    writes: false,
  },
  {
    name: 'get_record',
    description:
      'One record by id, with every field as it is stored. Use it before update_record when you '
      + 'need the current values, and after create_record when you need what the platform filled '
      + 'in — computed fields and generated codes are not in what you sent.',
    inputSchema: object({ collection: COLLECTION, id: RECORD_ID }, ['collection', 'id']),
    permission: { kind: 'collection', action: 'read' },
    writes: false,
  },
  {
    name: 'create_record',
    description:
      'Create a record. Field rules, required fields, type coercion and uniqueness keys are all '
      + 'enforced — a refusal names the field and the reason, so fix the value and call again.',
    inputSchema: object(
      {
        collection: COLLECTION,
        data: DATA,
        id: { type: 'string', description: 'Optional explicit id. Omit to have one generated.' },
      },
      ['collection', 'data'],
    ),
    permission: { kind: 'collection', action: 'create' },
    writes: true,
  },
  {
    name: 'update_record',
    description:
      'Change fields of an existing record. Only the fields you pass are touched; the rest keep '
      + 'their stored values.',
    inputSchema: object({ collection: COLLECTION, id: RECORD_ID, data: DATA }, ['collection', 'id', 'data']),
    permission: { kind: 'collection', action: 'update' },
    writes: true,
  },
  {
    name: 'delete_record',
    description:
      'Delete a record, along with its notes, its attached documents and the stored files of both. '
      + 'This cannot be undone — confirm with the person before calling it.',
    inputSchema: object({ collection: COLLECTION, id: RECORD_ID }, ['collection', 'id']),
    permission: { kind: 'collection', action: 'delete' },
    writes: true,
  },
  {
    name: 'run_report',
    description:
      'Run one of the office reports and get the aggregate back. Reports listed in the '
      + 'microteia://office/reports resource say which filters they ask for.',
    inputSchema: object(
      {
        report: { type: 'string', description: 'The report key.' },
        prompts: { type: 'object', description: 'Values for the filters the report declares.' },
      },
      ['report'],
    ),
    permission: { kind: 'delegated' },
    writes: false,
  },
  {
    name: 'run_workflow',
    description:
      'Start an automation. It runs asynchronously: this returns an event id, and get_workflow_run '
      + 'tells you how it went. Automations can write data, so confirm with the person first.',
    inputSchema: object(
      {
        workflow: { type: 'string', description: 'The automation id.' },
        params: { type: 'object', description: 'Values for the parameters the automation declares.' },
      },
      ['workflow'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: true,
  },
  {
    name: 'get_workflow_run',
    description:
      'How an automation started by run_workflow went: its status and its execution log. The run '
      + 'may still be in progress, in which case call again.',
    inputSchema: object({ eventId: { type: 'string' } }, ['eventId']),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: false,
  },
  {
    name: 'run_action',
    description:
      'Run a record action — one of the buttons a screen offers on a record. Runs synchronously and '
      + 'returns its outcome. Actions can write data, so confirm with the person first.',
    inputSchema: object(
      {
        action: { type: 'string', description: 'The action id.' },
        collection: { ...COLLECTION, description: 'The collection of the record it acts on.' },
        recordId: { type: 'string', description: 'The record it acts on.' },
        params: { type: 'object', description: 'Values for the parameters the action declares.' },
      },
      ['action'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: true,
  },
];

/**
 * Os recursos — documento, não ação.
 *
 * A distinção é a mesma que o MCP de autoria carimba em teste: *recebe argumento ou muda alguma
 * coisa, é ferramenta; devolve um documento, é recurso*. Ela não é decorativa — toda ferramenta é
 * contexto que o agente carrega em toda sessão, e estas quatro respostas não têm argumento nenhum.
 */
export const AGENT_RESOURCES = [
  {
    uri: 'microteia://office/info',
    name: 'Office',
    description:
      'Which office this is, what this access may do, when it expires, and what this path does not '
      + 'enforce. Read it first.',
  },
  {
    uri: 'microteia://office/screens',
    name: 'Screens',
    description:
      'Every screen this access can reach, with its collection name and which operations are allowed '
      + 'on it. Field schemas come from describe_screen.',
  },
  {
    uri: 'microteia://office/reports',
    name: 'Reports',
    description: 'The office reports this access can run, and the filters each one asks for.',
  },
  {
    uri: 'microteia://office/workflows',
    name: 'Automations',
    description: 'The automations this access can start, and the parameters each one declares.',
  },
] as const;

export type AgentResourceUri = (typeof AGENT_RESOURCES)[number]['uri'];

export const agentToolByName = (name: string): AgentToolDefinition | null =>
  AGENT_TOOLS.find((tool) => tool.name === name) ?? null;

/**
 * O que este caminho NÃO garante, dito ao agente em vez de deixado implícito.
 *
 * As três primeiras linhas são de tela por definição — uma expressão de `hiddenWhen` é avaliada
 * contra o formulário aberto, e não existe formulário aqui. Dizê-las é o que evita o agente concluir
 * que um campo é livre porque nada o impediu de gravá-lo.
 */
export const AGENT_UNENFORCED = [
  'Fields hidden or disabled by a condition (hiddenWhen, disabledWhen) are not hidden here — the '
  + 'condition depends on an open form, and there is none.',
  'Field side effects that fire on change in a form (onChange) do not fire here.',
  'Any check that exists only in a screen and not in the field rules is not applied.',
] as const;

/**
 * O que vale IGUAL ao caminho do navegador. Dito junto do que não vale, porque a lista de cima sem
 * esta convida a supor que nada é conferido.
 */
export const AGENT_ENFORCED = [
  'Permissions: every operation is charged against this access, which can never exceed the '
  + 'permissions of the person who issued it.',
  'Field rules: formats, patterns, expression validations, computed fields and required fields.',
  'The declared type of each field: a value is coerced to it, or refused.',
  'Uniqueness: a primary or unique key is enforced atomically, so a duplicate is refused.',
  'Automations, aggregates and the audit log all fire for writes made here, exactly as they do for '
  + 'a write made in the application.',
] as const;
