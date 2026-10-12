import { PERMISSION_AUDIT_READ, PERMISSION_AUTOMATION_RUN } from '../access/kernelPermissions';
import { QUERY_OPERATORS } from '../querySpec';
import { AGENT_DOCUMENT_MAX_MB } from './agentDocument';
import type { CrudAction } from '../access/permission';
import type { WorkflowParameterType } from '../../entities/Workflow';
import type { AuditAction, AuditSeverity, AuditType } from '../../entities/AuditLog';

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
  'list_screens',
  'describe_screen',
  'search_records',
  'get_record',
  'create_record',
  'update_record',
  'delete_record',
  'list_documents',
  'attach_document',
  'run_report',
  'describe_workflow',
  'run_workflow',
  'get_workflow_run',
  'run_action',
  'search_audit_log',
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
   * Quem executa cobra. É o caso do relatório: `requireReportAccess` já cobra a leitura de cada
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
  description: 'Collection name, exactly as list_screens returns it — never the screen label.',
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
    + 'large collection. '
    + 'Operators: eq / neq (equality; on a multi-value field, "any of"), lt / lte / gt / gte '
    + '(ordering), in (value must be an array: matches any of them), contains (case-insensitive '
    + 'substring on text; membership on lists), exists (the field has a value; send no value). '
    + 'Dates compare as dates on every operator, including createdAt and updatedAt. A bare day '
    + '"YYYY-MM-DD" means that whole day in UTC: gte "2026-10-01" includes all of October 1st, '
    + 'lte "2026-10-01" includes it too, gt and lt exclude it, eq matches any instant of it. A full '
    + 'ISO-8601 timestamp ("2026-10-01T14:30:00-03:00") compares as that exact instant.',
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
        description:
          'The value to compare against: text, number, boolean, a date as "YYYY-MM-DD" or ISO-8601, '
          + 'a record id for a reference field, an option key for a list field, or an array for '
          + '"in". Omit it for "exists".',
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

export const AUDIT_LOG_ACTIONS = ['CREATE', 'UPDATE', 'DELETE', 'SYSTEM'] as const satisfies readonly AuditAction[];
export const AUDIT_LOG_SEVERITIES = ['LOW', 'HIGH', 'CRITICAL'] as const satisfies readonly AuditSeverity[];
export const AUDIT_LOG_TYPES = ['AUDIT', 'ERROR'] as const satisfies readonly AuditType[];

const AUDIT_DAY_OR_INSTANT = (edge: string): string =>
  `Only entries ${edge} this moment, inclusive. A bare day "YYYY-MM-DD" means that whole day in UTC; `
  + 'a full ISO-8601 timestamp means that exact instant.';

/** O teto de `search_records`, dito no esquema para o modelo não pedir mais e achar que recebeu. */
export const AGENT_SEARCH_MAX_RESULTS = 200;

/**
 * Como se escreve o valor de cada tipo de parâmetro de automação.
 *
 * Mora aqui, e não junto de quem descreve o parâmetro, pela mesma razão das descrições de
 * ferramenta: é documentação de API entregue a quem consome a superfície, em inglês, e este arquivo é
 * o lugar declarado dela — uma segunda exceção ao gate de idioma seria uma segunda lista a manter.
 */
const PARAMETER_ACCEPTS: Readonly<Record<WorkflowParameterType, string>> = {
  String: 'Text.',
  Number: 'A JSON number.',
  Date: 'A day as "YYYY-MM-DD" (preferred), or a full ISO-8601 timestamp.',
  Boolean: 'true or false.',
  select: 'One of the "value"s listed in options — never the label.',
  lookup: 'The key of an item of the office list named in optionsFrom; list it with search_records.',
  EntityReference: 'The id of a record of the collection named in references; find it with search_records.',
  Object: 'An object with the keys listed in fields.',
};

export const agentParameterAccepts = (type: WorkflowParameterType, list: boolean): string =>
  list ? `A JSON array. Each item: ${PARAMETER_ACCEPTS[type]}` : PARAMETER_ACCEPTS[type];

/** O exemplo de um valor que só o escritório conhece — a chave de um item, o id de um registro. */
export const agentParameterPlaceholder = (type: WorkflowParameterType, target?: string): string => {
  if (type === 'lookup') return `<key of an item of ${target ?? 'the list'}>`;
  if (type === 'EntityReference') return `<id of a record of ${target ?? 'the collection'}>`;
  return 'text';
};

/**
 * A superfície inteira, e ela é deliberadamente pequena.
 *
 * `describe_screen` é o que dispensa uma ferramenta por entidade: ele devolve os campos, os tipos, os
 * obrigatórios, as chaves e as opções daquela tela, e a partir dele as sete operações genéricas
 * bastam para qualquer coleção que o escritório tenha instalado ou criado.
 *
 * `list_screens` é o que faz as outras serem alcançáveis, e é a única sem argumento. O mapa
 * rótulo→coleção nasceu só como o recurso `microteia://office/screens`, pela regra de que leitura
 * pura é recurso — e a regra pressupunha um cliente que busca recurso sozinho. Nem todo cliente é:
 * onde o recurso é material que a PESSOA anexa, o modelo nunca vê o mapa, e o escritório só responde
 * a quem digita o nome técnico da coleção. Um escritório que só atende por `persons` quando a tela
 * se chama Pessoas é um escritório que não foi encontrado.
 */
export const AGENT_TOOLS: readonly AgentToolDefinition[] = [
  {
    name: 'list_screens',
    description:
      'Every screen this access can reach, with its collection name, its label and the operations '
      + 'allowed on it. Call this first: the collection name behind a label is given nowhere else, '
      + 'and every other tool takes that name as an argument. Screens this access cannot reach are '
      + 'absent from the list rather than listed as denied.',
    inputSchema: object({}, []),
    // `delegated` e não uma permissão fixa: `officeScreens` já devolve só o que o acesso alcança, e
    // uma permissão a mais para LISTAR obrigaria quem emite um acesso estreito a concedê-la só para
    // o agente descobrir as duas telas que ele pode ler.
    permission: { kind: 'delegated' },
    writes: false,
  },
  {
    name: 'describe_screen',
    description:
      'The full field schema of one screen: every field with its type, whether it is required, the '
      + 'available options, the uniqueness keys, the validation rules and an example value — plus '
      + 'the record actions the screen offers, with the parameters each one takes (those are the ids '
      + 'run_action accepts). Read this before writing to a collection you have not written to yet '
      + '— field keys are not guessable from labels.',
    inputSchema: object({ collection: COLLECTION }, ['collection']),
    permission: { kind: 'collection', action: 'read' },
    writes: false,
  },
  {
    name: 'search_records',
    description:
      'Find records in a collection. Returns the matching records plus how many documents were '
      + 'scanned and whether the scan was complete — an incomplete scan means there may be more '
      + 'matches than the ones returned, so narrow the filters rather than trusting the count. '
      + 'Filter paths are checked against the screen: an unknown field or argument is refused with '
      + 'the reason, never ignored. Dates compare as dates — see "where".',
    inputSchema: object(
      {
        collection: COLLECTION,
        where: WHERE,
        orderBy: ORDER_BY,
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: AGENT_SEARCH_MAX_RESULTS,
          description: `Maximum records to return (at most ${AGENT_SEARCH_MAX_RESULTS}; that is also the default).`,
        },
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
    name: 'list_documents',
    description:
      'The files attached to a record in its Documents tab, newest first: name, document type, '
      + 'description, who attached it and when, and the download link. Only screens whose '
      + 'describe_screen answer has a "documents" section have this tab.',
    inputSchema: object({ collection: COLLECTION, recordId: RECORD_ID }, ['collection', 'recordId']),
    // A MESMA cobrança da regra do Firestore: o documento é parte do registro, e lê-lo é ler a coleção.
    permission: { kind: 'collection', action: 'read' },
    writes: false,
  },
  {
    name: 'attach_document',
    description:
      'Attach a file to a record\'s Documents tab, exactly as if it had been uploaded in the '
      + 'application: the file is stored in the office bucket and listed with its name, type and '
      + 'download link. Send the file as base64 in "content" (a "data:<type>;base64," prefix is also '
      + `accepted). Files must be smaller than ${AGENT_DOCUMENT_MAX_MB} MB. The document types `
      + 'accepted are listed by describe_screen under "documents"; an unknown type is refused with '
      + 'the accepted ones. Only screens with a "documents" section accept attachments.',
    inputSchema: object(
      {
        collection: COLLECTION,
        recordId: { type: 'string', description: 'The record the file is attached to.' },
        fileName: {
          type: 'string',
          description: 'The file name shown in the tab, with its extension — for example "power-of-attorney.pdf".',
        },
        content: { type: 'string', description: 'The file content, base64-encoded.' },
        contentType: {
          type: 'string',
          description: 'The MIME type, for example "application/pdf". Omit it to infer from the file extension.',
        },
        type: {
          type: 'string',
          description: 'The document type: its key or its label, as describe_screen lists them under "documents".',
        },
        description: { type: 'string', description: 'An optional note about the file.' },
      },
      ['collection', 'recordId', 'fileName', 'content'],
    ),
    // `update`, e não `create`: é o que `firestore.rules` cobra para anexar à aba Documentos de um
    // registro. Anexar muda o registro; não cria um registro novo da coleção.
    permission: { kind: 'collection', action: 'update' },
    writes: true,
  },
  {
    name: 'run_report',
    description:
      'Run one of the office reports and get the aggregate back. Reports listed in the '
      + 'microteia://office/reports resource say which filters they ask for, with the type of each. '
      + 'A filter key the report does not declare, or a required filter left out, is refused with '
      + 'the list of accepted keys.',
    inputSchema: object(
      {
        report: { type: 'string', description: 'The report key.' },
        prompts: {
          type: 'object',
          description: 'Values for the filters the report declares, keyed by the filter "key".',
        },
      },
      ['report'],
    ),
    permission: { kind: 'delegated' },
    writes: false,
  },
  {
    name: 'describe_workflow',
    description:
      'Everything needed to call one automation right the first time: every parameter with its key, '
      + 'type, whether it is required, its options or the collection its value comes from, and an '
      + 'example; the collections it reads, writes and deletes from; a summary of its steps with '
      + 'their inputs and conditions; the shape of its result; and whether running it twice is safe '
      + '("idempotent": yes / no / unknown, with "because": reads-only, keyed-writes — a repeat is '
      + 'refused as a duplicate —, may-duplicate, notifies, or opaque-steps).',
    inputSchema: object(
      { workflow: { type: 'string', description: 'The automation id, as microteia://office/workflows lists it.' } },
      ['workflow'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: false,
  },
  {
    name: 'run_workflow',
    description:
      'Start an automation. It runs asynchronously: this returns an event id, and get_workflow_run '
      + 'tells you how it went. Parameters are checked before anything starts: a key the automation '
      + 'does not declare, a missing required parameter or an invalid value is refused with the list '
      + 'of accepted keys — call describe_workflow first. Pass dry_run: true to validate and see what '
      + 'it would write without starting it. Automations can write data, so confirm with the person '
      + 'first.',
    inputSchema: object(
      {
        workflow: { type: 'string', description: 'The automation id.' },
        params: {
          type: 'object',
          description: 'Values for the parameters the automation declares, keyed by the parameter "key".',
        },
        dry_run: {
          type: 'boolean',
          description:
            'Validate the parameters and return the values as they would be received, the '
            + 'collections the automation would write to, and whether it is safe to repeat — '
            + 'without starting it or writing anything.',
        },
      },
      ['workflow'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: true,
  },
  {
    name: 'get_workflow_run',
    description:
      'How an automation started by run_workflow went: its status, its execution log and its '
      + 'outputs. "pending": true means the run has not started yet, and "finished": false that it is '
      + 'still running — call again in both cases. An event id no run_workflow returned is refused.',
    inputSchema: object(
      { eventId: { type: 'string', description: 'The event id run_workflow returned.' } },
      ['eventId'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: false,
  },
  {
    name: 'run_action',
    description:
      'Run a record action — one of the buttons a screen offers on a record; describe_screen lists '
      + 'them with their parameters. Runs synchronously and returns its outcome. A parameter the '
      + 'action does not declare, or a missing required one, is refused before it runs. Actions can '
      + 'write data, so confirm with the person first.',
    inputSchema: object(
      {
        action: { type: 'string', description: 'The action id, as describe_screen lists it.' },
        collection: { ...COLLECTION, description: 'The collection of the record it acts on.' },
        recordId: { type: 'string', description: 'The record it acts on.' },
        params: { type: 'object', description: 'Values for the parameters the action declares.' },
      },
      ['action'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
    writes: true,
  },
  {
    name: 'search_audit_log',
    description:
      'The office audit log, newest first: who created, changed or deleted what and when, plus the '
      + 'errors the platform recorded. Entries are kept for 30 days. Returns how many entries were '
      + 'scanned and whether the scan was complete — an incomplete scan means older matches may '
      + 'exist, so narrow the period rather than trusting the count.',
    inputSchema: object(
      {
        since: { type: 'string', description: AUDIT_DAY_OR_INSTANT('from') },
        until: { type: 'string', description: AUDIT_DAY_OR_INSTANT('up to') },
        action: { type: 'string', enum: [...AUDIT_LOG_ACTIONS], description: 'Only entries of this kind of change.' },
        severity: { type: 'string', enum: [...AUDIT_LOG_SEVERITIES], description: 'Only entries of this severity.' },
        type: { type: 'string', enum: [...AUDIT_LOG_TYPES], description: 'AUDIT for changes, ERROR for failures.' },
        entity: { type: 'string', description: 'Only entries about this entity, exactly as the log names it.' },
        entityId: { type: 'string', description: 'Only entries about this record id.' },
        userId: { type: 'string', description: 'Only entries made by this user id.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: AGENT_SEARCH_MAX_RESULTS,
          description: `Maximum entries to return (at most ${AGENT_SEARCH_MAX_RESULTS}; that is also the default).`,
        },
      },
      [],
    ),
    // Uma permissão FIXA, e não `<coleção>.read`: o log não é coleção de tela — mora fora do
    // escritório, em `auditLogs`, e `firestore.rules` o cobra por `audit.read`. Era a permissão que
    // um acesso podia receber sem nenhuma ferramenta que a usasse.
    permission: { kind: 'fixed', id: PERMISSION_AUDIT_READ },
    writes: false,
  },
];

/**
 * Os recursos — documento, não ação.
 *
 * A distinção é a mesma que o MCP de autoria carimba em teste: *recebe argumento ou muda alguma
 * coisa, é ferramenta; devolve um documento, é recurso*. Ela não é decorativa — toda ferramenta é
 * contexto que o agente carrega em toda sessão, e estas quatro respostas não têm argumento nenhum.
 *
 * `office/screens` é a ÚNICA que também é ferramenta, e a duplicação é deliberada: ela é o ponto de
 * entrada para as outras, e um cliente que não busca recurso sozinho fica sem nenhuma se ela não for
 * alcançável por `tools/call`. As outras três não têm esse papel — quem não as lê perde contexto,
 * não perde o caminho. Remover a URI não é opção: URI de recurso é contrato com quem já configurou o
 * servidor, e nada no cliente valida uma que sumiu.
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
      + 'on it. Field schemas come from describe_screen. This is the same answer the list_screens '
      + 'tool gives, for clients that read resources.',
  },
  {
    uri: 'microteia://office/reports',
    name: 'Reports',
    description:
      'The office reports this access can run, and the filters each one asks for — key, field, '
      + 'operator, type, whether it is required, and its options or source collection.',
  },
  {
    uri: 'microteia://office/workflows',
    name: 'Automations',
    description:
      'The automations this access can start, with every parameter each one declares — key, type, '
      + 'whether it is required, options or source collection, and an example. describe_workflow '
      + 'adds what each one reads and writes.',
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
