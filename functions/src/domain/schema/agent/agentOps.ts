// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/agent/agentOps.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import {
  PERMISSION_AUDIT_READ,
  PERMISSION_AUTOMATION_RUN,
  PERMISSION_DOCUMENT_TEMPLATES_MANAGE,
} from '../access/kernelPermissions';
import {
  DOCUMENT_OUTPUTS_BY_FORMAT,
  DOCUMENT_TEMPLATE_FORMATS,
  DOCUMENT_TEMPLATE_KEY_MAX_LENGTH,
  DOCUMENT_TEMPLATE_MAX_BYTES,
  DOCUMENT_OUTPUT_FORMATS,
} from '../document/documentTemplate';
import { TEMPLATE_BLOCKS, TEMPLATE_LOOP_VARIABLES } from '../document/templateGrammar';
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
  'list_workflows',
  'describe_workflow',
  'run_workflow',
  'get_workflow_run',
  'run_action',
  'search_audit_log',
  'list_document_templates',
  'get_document_template',
  'document_template_guide',
  'save_document_template',
  'change_document_template',
  'preview_document',
  'render_document',
] as const;

export type AgentOperation = (typeof AGENT_OPERATIONS)[number];

/**
 * Como uma automação NASCE, no vocabulário que o agente lê. Só `called` é iniciável por ele; as
 * outras disparam sozinhas, e descrevê-las é o que responde "quando roda?" e "rodou?".
 */
export const AGENT_WORKFLOW_TRIGGERS = ['called', 'record', 'date-reached', 'schedule', 'other'] as const;

export type AgentWorkflowTrigger = (typeof AGENT_WORKFLOW_TRIGGERS)[number];

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
 * Os estados de um modelo de documento no vocabulário do agente. É o mesmo da tela de modelos, com
 * nomes que dizem a origem: `extension` (só a extensão declara), `customized` (a cópia do escritório
 * vale no lugar do original), `disabled` (o escritório desligou a chave) e `office` (do escritório,
 * sem extensão por trás).
 */
export const AGENT_TEMPLATE_STATES = ['extension', 'customized', 'disabled', 'office'] as const;

export type AgentTemplateState = (typeof AGENT_TEMPLATE_STATES)[number];

/**
 * Os gestos sobre um modelo que não são "escrever o conteúdo" — os mesmos botões da tela de modelos.
 * `keep-customization` é o "Manter minha cópia" do aviso de atualização.
 */
export const AGENT_TEMPLATE_CHANGES = [
  'customize',
  'keep-customization',
  'restore',
  'disable',
  'enable',
  'clone',
  'delete',
] as const;

export type AgentTemplateChange = (typeof AGENT_TEMPLATE_CHANGES)[number];

const TEMPLATE_KEY = {
  type: 'string',
  description: 'The template key, as list_document_templates lists it.',
};

const DOCUMENT_TEMPLATE_MAX_KB = DOCUMENT_TEMPLATE_MAX_BYTES / 1024;

const OUTPUTS_BY_FORMAT_TEXT = DOCUMENT_TEMPLATE_FORMATS
  .map((format) => `${format} → ${DOCUMENT_OUTPUTS_BY_FORMAT[format].join(' or ')}`)
  .join('; ');

/**
 * A gramática dos modelos, dita a um AGENTE. A tela a ensina ao lado do editor; um modelo de IA não
 * tem a tela, e escrevia `{{else}}`, `{{cliente.nome}}` sem conferir a tela e Word com marca partida.
 *
 * Os fatos sobre o kernel são DERIVADOS das constantes — blocos, variáveis de laço, formatos de saída,
 * teto do `.docx` —, como no §12 do `AUTHORING.md`: um bloco novo na gramática aparece aqui sozinho.
 */
export const DOCUMENT_TEMPLATE_GRAMMAR = {
  summary:
    'A template is text with merge tags between double braces. What goes inside {{ }} is a FIELD '
    + 'EXPRESSION — the same language as computed fields: field paths, operators and the functions '
    + 'listed under "functions". The paths start at the record the document is generated for.',
  tags: [
    { code: '{{name}}', meaning: 'The value of a field of the record, by its key (describe_screen lists the keys).' },
    {
      code: '{{clientId.name}}',
      meaning: 'Follow a reference field to a field of the referenced record. A reference alone ({{clientId}}) '
        + 'prints nothing — always name the field to print.',
    },
    { code: '{{formatDate(dueDate, "DD/MM/YYYY")}}', meaning: 'Format a date with a pattern.' },
    { code: '{{formatMoney(amount)}}', meaning: 'Format a number as money in the office language.' },
    { code: '{{upper(name)}}', meaning: 'Any function of the expression language works inside the braces.' },
  ],
  blocks: TEMPLATE_BLOCKS.map((block) => (block === 'each'
    ? {
      block,
      code: '{{#each installments}} … {{/each}}',
      meaning: 'Repeat for each item of a list: a list declared in "datasets" (records of another screen '
        + 'that point to this one) or a multi-value field of the record. Inside, the item fields are read '
        + `directly, the outer record stays readable, and ${TEMPLATE_LOOP_VARIABLES.map((name) => `{{${name}}}`).join(' / ')} `
        + 'are the whole item (the only way to print a list of texts) and its position starting at 1.',
    }
    : {
      block,
      code: '{{#if paid}} … {{/if}}   {{#if not paid}} … {{/if}}   {{#if status == "draft"}} … {{/if}}',
      meaning: 'Include the content only when the expression is true. There is NO {{else}}: write a second '
        + '{{#if not …}} block.',
    })),
  rules: [
    `The only blocks are ${TEMPLATE_BLOCKS.map((block) => `{{#${block}}}`).join(' and ')}; every block must be closed by its own {{/…}}.`,
    'A select field stores the OPTION KEY, not its label: compare with the key ({{#if status == "draft"}}) and '
    + 'print a label with a chain of {{#if}} blocks. describe_screen lists the options with key and label.',
    'Values merged into a Markdown template are escaped: data never becomes formatting (a name with "*" does '
    + 'not open bold), and a line break in the data becomes a forced line break.',
    'A tag whose expression fails is left EMPTY in the document and reported as an empty field; it does not '
    + 'stop the generation. Use preview_document to see them before generating.',
    'Dates, money and numbers are formatted in the language of the OFFICE, not of who generates.',
    'The file name uses the same grammar ("Power of attorney - {{name}}"), without extension.',
  ],
  markdown: {
    produces: DOCUMENT_OUTPUTS_BY_FORMAT.markdown,
    layout: [
      { code: '# Title', meaning: 'The document title, centered. Use it once, at the top.' },
      { code: '## Section', meaning: 'A section heading.' },
      { code: '**bold**  *italic*', meaning: 'Emphasis.' },
      { code: '- item', meaning: 'A bulleted list (1. for numbered).' },
      { code: '| a | b |\n|---|---|', meaning: 'A table. A {{#each}} around one row repeats the row.' },
      { code: '---', meaning: 'A horizontal rule.' },
      { code: '<!-- pagebreak -->', meaning: 'A page break.' },
      { code: '<!-- note -->', meaning: 'Any other HTML comment is a note for whoever edits; it never prints.' },
    ],
    notes: [
      'Paragraphs are justified — the layout of a contract or a letter.',
      'The PDF uses the standard PDF fonts (Times, Courier): characters outside Latin-1 do not print.',
    ],
  },
  docx: {
    produces: DOCUMENT_OUTPUTS_BY_FORMAT.docx,
    notes: [
      'Write the tags directly in the Word document, with the same grammar. The layout, fonts, header and '
      + 'footer are the document\'s own; tags work in the body, the header and the footer.',
      'Type each tag in one go, with a single formatting: Word splits a tag into pieces when the formatting '
      + 'changes in the middle, and get_document_template returns the text as the platform reads it — check '
      + 'there that every tag came out whole.',
      'A {{#each}} around a table row repeats the row; {{#each}} and {{/each}} must be in the same row.',
      'A Word template does not produce PDF — converting Word needs an office suite that the server does not run. '
      + 'For a PDF, write the template in Markdown.',
      `Send the .docx as base64 in "content" (a "data:…;base64," prefix is accepted). At most ${DOCUMENT_TEMPLATE_MAX_KB} KB.`,
    ],
  },
  outputsByFormat: OUTPUTS_BY_FORMAT_TEXT,
  key: `Lowercase letters, digits and hyphens, starting with a letter, at most ${DOCUMENT_TEMPLATE_KEY_MAX_LENGTH} characters.`,
} as const;

const TEMPLATE_DATASETS = {
  type: 'array',
  description:
    'Lists of child records for {{#each}}: the records of another screen whose reference field points to '
    + 'the record of the document. document_template_guide lists the candidates for a screen.',
  items: object(
    {
      name: { type: 'string', description: 'How the template reads the list: {{#each <name>}}. Letters, digits and _.' },
      from: { type: 'string', description: 'The collection of the child records, as list_screens returns it.' },
      via: { type: 'string', description: 'The reference field, in the child, that points to the record of the document.' },
      orderBy: { type: 'string', description: 'A field of the child to order by.' },
      direction: { type: 'string', enum: ['asc', 'desc'] },
      limit: { type: 'integer', minimum: 1, maximum: 100, description: 'At most 100 items.' },
    },
    ['name', 'from', 'via'],
  ),
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
    name: 'list_workflows',
    description:
      'Every automation of the office, with how each one starts: "called" ones are started with '
      + 'run_workflow; "record" ones run when a record of a collection is saved or deleted; '
      + '"date-reached" ones when a date field of a record arrives; "schedule" ones on a clock (cron, '
      + 'in the office time zone). Only "called" ones can be started — the others start by themselves, '
      + 'and describe_workflow says when they run next and how the last run went.',
    inputSchema: object(
      {
        trigger: {
          type: 'string',
          enum: [...AGENT_WORKFLOW_TRIGGERS, 'all'],
          description: 'Only automations that start this way. Default: all.',
        },
      },
      [],
    ),
    permission: { kind: 'fixed', id: PERMISSION_AUTOMATION_RUN },
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
      + 'refused as a duplicate —, may-duplicate, notifies, appends — every run attaches a new file —, '
      + 'or opaque-steps). "pausesAt" lists the steps where a run stops and resumes later on its own. '
      + 'An automation that starts by itself ("callable": false) also says its "trigger" and, on a '
      + 'date or a clock, its "clock": the next run, the time zone, and the last run — fired or skipped '
      + 'and why, with the event id get_workflow_run reads.',
    inputSchema: object(
      { workflow: { type: 'string', description: 'The automation id, as list_workflows lists it.' } },
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
      + 'still running or waiting — call again in both cases. A run with status WAITING is paused on '
      + 'purpose and resumes by itself at "resumeAt"; CANCELLED means it had nothing left to resume. '
      + 'An event id no run_workflow returned is refused.',
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
  {
    name: 'list_document_templates',
    description:
      'The document templates of the office — the texts that generate a power of attorney, a contract, a '
      + 'receipt or a letter from a record. Each one says its key, title, the collection whose records it '
      + 'describes, its format (markdown or docx), the files it produces, and its state: "extension" (comes '
      + 'from an installed extension, read-only — customize it to change it), "customized" (the office copy '
      + 'replaces the extension original; "outdated": true means the extension changed the original since), '
      + '"disabled" (turned off) or "office" (written by the office). Also says whether this access can '
      + 'render each one and manage templates. Content is not included: get_document_template reads it.',
    inputSchema: object(
      {
        collection: { ...COLLECTION, description: 'Only templates for the records of this collection.' },
        state: { type: 'string', enum: [...AGENT_TEMPLATE_STATES, 'all'], description: 'Only templates in this state. Default: all.' },
      },
      [],
    ),
    // `delegated`: a regra do Firestore libera a leitura dos modelos a todo membro — o modelo é texto,
    // não dado de registro. Gerar e administrar continuam cobrados nas ferramentas que fazem isso.
    permission: { kind: 'delegated' },
    writes: false,
  },
  {
    name: 'get_document_template',
    description:
      'One document template in full: the Markdown text, or for a Word template the text as the platform '
      + 'reads it (to check that every tag came out whole) and, on request, the .docx itself as base64. '
      + 'Also returns the field paths it reads, its grammar problems, and the paths the screen does not have '
      + '("pathWarnings") — those print empty. version "extension" reads the original of an extension even '
      + 'when the office customized it; "office" reads the office copy; the default is the one in effect.',
    inputSchema: object(
      {
        key: TEMPLATE_KEY,
        version: { type: 'string', enum: ['effective', 'extension', 'office'], description: 'Which version to read. Default: effective.' },
        includeContent: {
          type: 'boolean',
          description: `Word templates only: also return the .docx as base64 in "content" (up to ${DOCUMENT_TEMPLATE_MAX_KB} KB). Default: false.`,
        },
      },
      ['key'],
    ),
    permission: { kind: 'delegated' },
    writes: false,
  },
  {
    name: 'document_template_guide',
    description:
      'How to write a document template: the full grammar (tags, {{#each}}, {{#if}}, layout, Word rules), '
      + 'the formats and what each produces, the limits, and every function usable inside the tags with its '
      + 'signature and an example. With a collection, also the exact tag that prints each field of that '
      + 'screen, the child lists that can be declared, and a starter template written from its fields — '
      + 'call this before writing a template, instead of guessing field keys.',
    inputSchema: object(
      {
        format: { type: 'string', enum: [...DOCUMENT_TEMPLATE_FORMATS], description: 'The format of the template to write.' },
        collection: { ...COLLECTION, description: 'The collection whose records the template will describe.' },
      },
      ['format'],
    ),
    // A gramática é pública a quem tem o acesso; a parte da tela cobra a leitura da coleção lá dentro,
    // a mesma de `describe_screen` — os campos de uma tela são esquema dela.
    permission: { kind: 'delegated' },
    writes: false,
  },
  {
    name: 'save_document_template',
    description:
      'Create a template of the office, or change one the office already has (an "office" or a "customized" '
      + 'one). On a change only the fields you pass are touched. Shape problems (key, title, collection, format, '
      + 'content) are refused; grammar problems and paths the screen does not have are saved and returned as '
      + 'warnings — fix them, they print empty. A Word template is read on save, and a file the platform cannot '
      + 'read is refused. The key of an extension template cannot be written directly: customize it first with '
      + 'change_document_template, or use another key. Pass dry_run: true to check everything without saving. '
      + `Grammar: document_template_guide. Formats and outputs: ${OUTPUTS_BY_FORMAT_TEXT}.`,
    inputSchema: object(
      {
        key: { type: 'string', description: `The template key. ${DOCUMENT_TEMPLATE_GRAMMAR.key}` },
        title: { type: 'string', description: 'The name people see when choosing the template.' },
        description: { type: 'string', description: 'An optional note about when to use it.' },
        collection: { ...COLLECTION, description: 'The collection whose records the template describes. Its screen must have a Documents tab.' },
        format: { type: 'string', enum: [...DOCUMENT_TEMPLATE_FORMATS], description: 'markdown (text in "body") or docx (a Word file in "content").' },
        body: { type: 'string', description: 'The Markdown text of the template, when format is markdown.' },
        content: { type: 'string', description: `The .docx file as base64, when format is docx. At most ${DOCUMENT_TEMPLATE_MAX_KB} KB.` },
        outputs: {
          type: 'array',
          items: { type: 'string', enum: [...DOCUMENT_OUTPUT_FORMATS] },
          description: 'The files it may produce. Omit for everything the format produces.',
        },
        fileName: { type: 'string', description: 'The generated file name, same grammar, no extension — "Contract - {{title}}".' },
        documentType: {
          type: 'string',
          description: 'The document type the file is attached with: a key of the list describe_screen shows under "documents".',
        },
        datasets: TEMPLATE_DATASETS,
        dry_run: { type: 'boolean', description: 'Check the template and return the problems without saving it.' },
      },
      ['key'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_DOCUMENT_TEMPLATES_MANAGE },
    writes: true,
  },
  {
    name: 'change_document_template',
    description:
      'The other gestures on a template. "customize": copy an extension template to the office under the same '
      + 'key — the copy replaces the original and can then be changed with save_document_template. '
      + '"keep-customization": mark a customized copy as reviewed against a new extension original, without '
      + 'changing it. "restore": discard the customized copy and use the extension original again. "disable" / '
      + '"enable": take a key out of circulation and put it back, without losing a customization. "clone": a NEW '
      + 'office template with the content of this one, under "newKey" (default <key>-copy) and "title". '
      + '"delete": delete an office template — extension templates cannot be deleted. restore and delete cannot '
      + 'be undone: confirm with the person first.',
    inputSchema: object(
      {
        key: TEMPLATE_KEY,
        action: { type: 'string', enum: [...AGENT_TEMPLATE_CHANGES] },
        newKey: { type: 'string', description: 'clone only: the key of the new template.' },
        title: { type: 'string', description: 'clone only: the name of the new template.' },
      },
      ['key', 'action'],
    ),
    permission: { kind: 'fixed', id: PERMISSION_DOCUMENT_TEMPLATES_MANAGE },
    writes: true,
  },
  {
    name: 'preview_document',
    description:
      'The text a template produces for one record, with the values merged in, WITHOUT generating a file or '
      + 'attaching anything: the Markdown with the values in place, or the text of a Word template. Also '
      + 'returns the tags that came out empty and why, and the file name. Use it to check a template you '
      + 'wrote or changed against a real record before render_document.',
    inputSchema: object(
      {
        collection: { ...COLLECTION, description: 'The collection of the record — the one the template describes.' },
        recordId: RECORD_ID,
        template: TEMPLATE_KEY,
      },
      ['collection', 'recordId', 'template'],
    ),
    permission: { kind: 'collection', action: 'read' },
    writes: false,
  },
  {
    name: 'render_document',
    description:
      'Generate a document from a template for one record and attach it to the record\'s Documents tab, exactly '
      + 'as the "Generate document" button does. Returns the attached document with its download link, and how '
      + 'many tags came out empty. Every call attaches a new file — do not repeat it to retry a success.',
    inputSchema: object(
      {
        collection: { ...COLLECTION, description: 'The collection of the record — the one the template describes.' },
        recordId: RECORD_ID,
        template: TEMPLATE_KEY,
        output: { type: 'string', enum: [...DOCUMENT_OUTPUT_FORMATS], description: 'The file to produce. Default: the first the template produces.' },
        fileName: { type: 'string', description: 'Replace the template file name for this document. Same grammar, no extension.' },
        documentType: { type: 'string', description: 'Replace the document type of the template for this document.' },
      },
      ['collection', 'recordId', 'template'],
    ),
    // A MESMA cobrança da callable `renderDocument` e de `attach_document`: gerar é anexar.
    permission: { kind: 'collection', action: 'update' },
    writes: true,
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
