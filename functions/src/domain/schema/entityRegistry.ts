// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/entityRegistry.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldAggregation,
  FieldLogic,
  FieldOrigin,
  FieldRules,
} from './fieldRules';

export const SCHEMA_VERSION = 1;

/**
 * Chave de entidade. Aberta para `string` a partir da Etapa 4b: o conjunto de entidades passou a
 * ser dado (contribuições `data.entity`), não uma união fechada no tipo. A validação de que uma
 * chave existe é de runtime, contra o registro — `getEntityByCollection`/`ctx.registry`.
 */
export type EntityKey = string;

/** As entidades nativas do Microteia. Mantida como união só para documentar o conjunto fixo. */
export type BuiltinEntityKey =
  | 'contracts'
  | 'deadlines'
  | 'financials'
  | 'members'
  | 'pushes'
  | 'news';

export const BUILTIN_ENTITY_KEYS: readonly BuiltinEntityKey[] = [
  'contracts', 'deadlines', 'financials', 'members', 'pushes', 'news',
] as const;

export type WorkflowEntityEventPrefix =
  | 'contract'
  | 'deadline'
  | 'financial'
  | 'push';

export type NativeFieldType = 'string' | 'number' | 'boolean' | 'date' | 'stringArray' | 'object';

// Apenas regras de APRESENTAÇÃO (como o campo é exibido/renderizado). Regras de negócio
// (required, options, optionsAllowUserAdd, rules, logic, multi...) ficam no NativeFieldSpec.
export interface FieldUiSpec {
  control?: CustomFieldType;
  mask?: CustomFieldMask;
  section?: string;
  order?: number;
  placeholder?: string;
  form?: boolean;
  list?: { icon?: string; order?: number };
  /** O campo vira filtro na listagem — o mesmo `filterable` da forma de autoria. */
  filter?: boolean;
}

/**
 * Forma CANÔNICA de um campo dentro da camada de schema, seja ele declarado em código (aqui),
 * num pacote de extensão ou no Form Design. `FieldDefinition` é a forma de autoria/UI e converte
 * para esta em `screenEntity.ts`.
 */
export interface NativeFieldSpec {
  key: string;
  label: string;
  type: NativeFieldType;
  lookupCollection?: string;
  objectFields?: NativeFieldSpec[];
  refEntity?: string;
  /** Nome de navegação do registro apontado — o `denormKey` das relações do registro. */
  refDenormKey?: string;
  multi?: boolean;
  list?: boolean;
  required?: boolean;
  options?: CustomFieldOption[];
  optionsAllowUserAdd?: boolean;
  optionsColored?: boolean;
  rules?: FieldRules;
  logic?: FieldLogic;
  aggregation?: FieldAggregation;
  /** Ausente nos campos deste registro, onde é sempre `builtin` por definição. */
  origin?: FieldOrigin;
  ui?: FieldUiSpec;
}

export interface FkSpec {
  key: string;
  label: string;
  targetCollection: string;
  denormKey: string;
  multi?: boolean;
  denormalizedFields?: string[];
  required?: boolean;
  ui?: FieldUiSpec;
}

export interface EntityMetadata {
  /** Coleção de etiquetas da entidade, quando ela as tem. Ausente = tela sem etiquetas. */
  tagCollection?: string;
  key: EntityKey;
  collection: string;
  /**
   * Prefixo dos eventos de workflow. Nas entidades deste registro é o nome declarado no singular
   * (`person.saved`); numa entidade vinda de tela é o próprio nome da coleção (`medico.saved`).
   */
  eventPrefix?: string;
  labelSingular: string;
  labelPlural: string;
  displayNameFields: string[];
  referenceDenormFields: string[];
  fields: NativeFieldSpec[];
  fks: FkSpec[];
  /** A entidade pode receber uma `ScreenDefinition` — aparece no Form Design. */
  supportsCustomFields: boolean;
  referenceable: boolean;
}


const FINANCIAL_TYPE_OPTIONS: CustomFieldOption[] = [
  { key: 'Receita', label: 'Receita' },
  { key: 'Despesa', label: 'Despesa' },
];

const PAYMENT_METHOD_OPTIONS: CustomFieldOption[] = [
  'PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Outro',
].map((m) => ({ key: m, label: m }));

// `color` aceita token do tema (resolvido por resolveColor) — nunca hex literal.
const DEADLINE_PRIORITY_OPTIONS: CustomFieldOption[] = [
  { key: 'Baixa', label: 'Baixa', color: 'success' },
  { key: 'Média', label: 'Média', color: 'warning' },
  { key: 'Alta', label: 'Alta', color: 'secondary' },
  { key: 'Crítica', label: 'Crítica', color: 'danger' },
];

export const ENTITY_REGISTRY: Record<EntityKey, EntityMetadata> = {
  contracts: {
    key: 'contracts',
    collection: 'contracts',
    tagCollection: 'contractTags',
    eventPrefix: 'contract',
    labelSingular: 'Contrato',
    labelPlural: 'Contratos',
    displayNameFields: ['title', 'number'],
    referenceDenormFields: ['number', 'title', 'type'],
    fields: [
      { key: 'number', label: 'Número', type: 'string', required: true,
        ui: { section: 'Identificação', order: 0 } },
      { key: 'title', label: 'Título', type: 'string', required: true,
        ui: { section: 'Identificação', order: 1 } },
      { key: 'type', label: 'Tipo', type: 'string', lookupCollection: 'contractTypes',
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Identificação', order: 2 } },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'contractCategories',
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Identificação', order: 3 } },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'contractStatuses',
        required: true, optionsAllowUserAdd: true, optionsColored: true,
        ui: { control: 'select', section: 'Identificação', order: 4 } },
      { key: 'object', label: 'Objeto', type: 'string', lookupCollection: 'contractObjects',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Identificação', order: 5 } },
      { key: 'draftedAt', label: 'Data de elaboração', type: 'date',
        ui: { section: 'Datas e vigência', order: 13 } },
      { key: 'signedAt', label: 'Data de assinatura', type: 'date',
        ui: { section: 'Datas e vigência', order: 14 } },
      { key: 'effectiveStart', label: 'Início de vigência', type: 'date',
        ui: { section: 'Datas e vigência', order: 15 } },
      { key: 'effectiveEnd', label: 'Fim de vigência', type: 'date',
        ui: { section: 'Datas e vigência', order: 16 } },
      { key: 'autoRenewal', label: 'Renovação automática', type: 'boolean',
        ui: { control: 'checkbox', section: 'Datas e vigência', order: 17, placeholder: 'Renova automaticamente' } },
      { key: 'renewalDate', label: 'Data de renovação', type: 'date',
        ui: { section: 'Datas e vigência', order: 18 } },
      { key: 'terminationDate', label: 'Data de rescisão', type: 'date',
        ui: { section: 'Datas e vigência', order: 19 } },
      { key: 'initialValue', label: 'Valor inicial', type: 'number',
        ui: { control: 'currency', section: 'Condições financeiras', order: 20 } },
      { key: 'monthlyValue', label: 'Valor mensal', type: 'number',
        ui: { control: 'currency', section: 'Condições financeiras', order: 21 } },
      { key: 'totalValue', label: 'Valor total', type: 'number',
        ui: { control: 'currency', section: 'Condições financeiras', order: 22, list: { icon: 'moneyDollar', order: 1 } } },
      { key: 'adjustmentIndex', label: 'Índice de reajuste', type: 'string', lookupCollection: 'contractAdjustmentIndexes',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Condições financeiras', order: 23 } },
      { key: 'adjustmentPeriodicity', label: 'Periodicidade de reajuste', type: 'string', lookupCollection: 'contractAdjustmentPeriodicities',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Condições financeiras', order: 24 } },
      { key: 'currency', label: 'Moeda', type: 'string', lookupCollection: 'contractCurrencies',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Condições financeiras', order: 25 } },
      { key: 'paymentMethod', label: 'Forma de pagamento', type: 'string', lookupCollection: 'contractPaymentMethods',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Condições financeiras', order: 26 } },
      { key: 'dueDay', label: 'Dia de vencimento', type: 'number',
        ui: { section: 'Condições financeiras', order: 27 } },
      { key: 'installments', label: 'Parcelas', type: 'number',
        ui: { section: 'Condições financeiras', order: 28 } },
      { key: 'bank', label: 'Banco', type: 'string', lookupCollection: 'contractBanks',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Dados bancários', order: 29 } },
      { key: 'bankAccount', label: 'Conta bancária', type: 'string',
        ui: { section: 'Dados bancários', order: 30, placeholder: 'Agência / número' } },
      { key: 'pixKey', label: 'Chave PIX', type: 'string',
        ui: { section: 'Dados bancários', order: 31 } },
      { key: 'costCenter', label: 'Centro de custo', type: 'string', lookupCollection: 'contractCostCenters',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Dados bancários', order: 32 } },
    ],
    fks: [
      {
        key: 'clientId',
        label: 'Cliente',
        targetCollection: 'persons',
        denormKey: 'client',
        denormalizedFields: ['name', 'type', 'email'],
        ui: { section: 'Partes envolvidas', order: 11, placeholder: 'Selecione o cliente...' },
      },
      {
        key: 'responsibleId',
        label: 'Responsável',
        targetCollection: 'persons',
        denormKey: 'responsible',
        denormalizedFields: ['name', 'type', 'email'],
        ui: { section: 'Partes envolvidas', order: 12, placeholder: 'Selecione o responsável...' },
      },
      { key: 'contractorIds', label: 'Contratantes', targetCollection: 'persons', denormKey: 'contractor', multi: true,
        ui: { section: 'Partes envolvidas', order: 6, placeholder: 'Selecione...' } },
      { key: 'contracteeIds', label: 'Contratados', targetCollection: 'persons', denormKey: 'contractee', multi: true,
        ui: { section: 'Partes envolvidas', order: 7, placeholder: 'Selecione...' } },
      { key: 'witnessIds', label: 'Testemunhas', targetCollection: 'persons', denormKey: 'witness', multi: true,
        ui: { section: 'Partes envolvidas', order: 8, placeholder: 'Selecione...' } },
      { key: 'contractorLawyerIds', label: 'Advogados dos contratantes', targetCollection: 'persons', denormKey: 'contractorLawyer', multi: true,
        ui: { section: 'Partes envolvidas', order: 9, placeholder: 'Selecione...' } },
      { key: 'contracteeLawyerIds', label: 'Advogados dos contratados', targetCollection: 'persons', denormKey: 'contracteeLawyer', multi: true,
        ui: { section: 'Partes envolvidas', order: 10, placeholder: 'Selecione...' } },
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'contractTags', denormKey: 'tag', multi: true,
        ui: { form: false } },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  deadlines: {
    key: 'deadlines',
    collection: 'deadlines',
    eventPrefix: 'deadline',
    labelSingular: 'Prazo',
    labelPlural: 'Prazos',
    displayNameFields: ['description'],
    referenceDenormFields: ['type', 'dueDate', 'priority'],
    fields: [
      { key: 'type', label: 'Tipo', type: 'string', lookupCollection: 'deadlineTypes',
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Identificação', order: 0, placeholder: 'Selecione o tipo...' } },
      { key: 'priority', label: 'Prioridade', type: 'string', required: true,
        options: DEADLINE_PRIORITY_OPTIONS, optionsColored: true,
        ui: { control: 'select', section: 'Identificação', order: 1, placeholder: 'Selecione a prioridade...' } },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true,
        ui: { section: 'Datas', order: 3, list: { icon: 'calendar', order: 1 } } },
      { key: 'completedAt', label: 'Data de conclusão', type: 'date',
        ui: { section: 'Datas', order: 4, list: { icon: 'calendarCheck', order: 2 } } },
      { key: 'description', label: 'Descrição', type: 'string',
        ui: { control: 'textarea', section: 'Responsável e Detalhes', order: 6, placeholder: 'Detalhes sobre o prazo, documentos necessários, etc.', list: { icon: 'fileText', order: 4 } } },
      { key: 'status', label: 'Status', type: 'string', ui: { form: false } },
      { key: 'notes', label: 'Observações', type: 'string', ui: { form: false } },
    ],
    fks: [
      {
        key: 'caseId',
        label: 'Processo',
        targetCollection: 'cases',
        denormKey: 'case',
        denormalizedFields: ['caseNumber', 'title', 'area'],
        required: true,
        ui: { section: 'Identificação', order: 2, placeholder: 'Selecione o processo...',
              list: { icon: 'folder', order: 0 } },
      },
      {
        key: 'responsibleLawyerId',
        label: 'Advogado responsável',
        targetCollection: 'persons',
        denormKey: 'responsibleLawyer',
        denormalizedFields: ['name', 'type', 'email'],
        ui: { section: 'Responsável e Detalhes', order: 5, placeholder: 'Selecione o responsável...',
              list: { icon: 'scales', order: 3 } },
      },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  financials: {
    key: 'financials',
    collection: 'financials',
    tagCollection: 'financialTags',
    eventPrefix: 'financial',
    labelSingular: 'Financeiro',
    labelPlural: 'Financeiro',
    displayNameFields: ['category'],
    referenceDenormFields: ['type', 'amount', 'dueDate'],
    fields: [
      { key: 'type', label: 'Tipo', type: 'string', required: true, options: FINANCIAL_TYPE_OPTIONS,
        ui: { control: 'select', section: 'Lançamento', order: 0, placeholder: 'Selecione o tipo...' } },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'financialCategories',
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Lançamento', order: 1, placeholder: 'Selecione a categoria...' } },
      { key: 'amount', label: 'Valor', type: 'number', required: true,
        ui: { control: 'currency', section: 'Lançamento', order: 2 } },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'financialStatuses',
        required: true, optionsAllowUserAdd: true, optionsColored: true,
        ui: { control: 'select', section: 'Lançamento', order: 3, placeholder: 'Selecione o status...' } },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true,
        ui: { section: 'Datas', order: 4 } },
      { key: 'paymentDate', label: 'Data de pagamento', type: 'date', ui: { section: 'Datas', order: 5 } },
      { key: 'cancelDate', label: 'Data de cancelamento', type: 'date', ui: { section: 'Datas', order: 6 } },
      { key: 'paymentMethod', label: 'Forma de pagamento', type: 'string', options: PAYMENT_METHOD_OPTIONS,
        ui: { control: 'select', section: 'Pagamento', order: 7, placeholder: 'Selecione a forma...' } },
      // O centro de custo é compartilhado com Contratos (useContractLookup) — daí a coleção `contractCostCenters`.
      { key: 'costCenter', label: 'Centro de custo', type: 'string', lookupCollection: 'contractCostCenters',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Pagamento', order: 8, placeholder: 'Selecione o centro de custo...', list: { icon: 'wallet', order: 0 } } },
      { key: 'invoiceNumber', label: 'Número da nota', type: 'string', ui: { section: 'Pagamento', order: 9 } },
      { key: 'notes', label: 'Observações', type: 'string',
        ui: { control: 'textarea', section: 'Vínculos e Observações', order: 13 } },
    ],
    fks: [
      {
        key: 'caseId',
        label: 'Processo',
        targetCollection: 'cases',
        denormKey: 'case',
        denormalizedFields: ['caseNumber', 'title'],
        ui: { section: 'Vínculos e Observações', order: 10, placeholder: 'Selecione o processo...' },
      },
      {
        key: 'personId',
        label: 'Pessoa',
        targetCollection: 'persons',
        denormKey: 'person',
        denormalizedFields: ['name', 'type'],
        ui: { section: 'Vínculos e Observações', order: 11, placeholder: 'Selecione a pessoa...' },
      },
      {
        key: 'contractId',
        label: 'Contrato',
        targetCollection: 'contracts',
        denormKey: 'contract',
        denormalizedFields: ['number', 'title'],
        ui: { section: 'Vínculos e Observações', order: 12, placeholder: 'Selecione o contrato...' },
      },
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'financialTags', denormKey: 'tag', multi: true,
        ui: { form: false } },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  members: {
    key: 'members',
    collection: 'members',
    labelSingular: 'Membro',
    labelPlural: 'Membros',
    displayNameFields: ['name', 'displayName', 'email'],
    referenceDenormFields: ['name', 'email'],
    fields: [
      { key: 'name', label: 'Nome', type: 'string' },
      { key: 'displayName', label: 'Nome de exibição', type: 'string' },
      { key: 'email', label: 'E-mail', type: 'string' },
      { key: 'role', label: 'Papel', type: 'string' },
    ],
    fks: [],
    supportsCustomFields: false,
    referenceable: true,
  },
  pushes: {
    key: 'pushes',
    collection: 'pushes',
    eventPrefix: 'push',
    labelSingular: 'Push',
    labelPlural: 'Pushes',
    displayNameFields: ['subject', 'processNumber'],
    referenceDenormFields: ['subject', 'processNumber'],
    fields: [
      { key: 'subject', label: 'Assunto', type: 'string' },
      { key: 'from', label: 'Remetente', type: 'string' },
      { key: 'processNumber', label: 'Número do processo', type: 'string' },
      { key: 'court', label: 'Órgão', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'receivedAt', label: 'Data de recebimento', type: 'date' },
    ],
    fks: [],
    supportsCustomFields: false,
    referenceable: false,
  },
  news: {
    key: 'news',
    collection: 'news',
    labelSingular: 'Comunicado',
    labelPlural: 'Comunicados',
    displayNameFields: ['title'],
    referenceDenormFields: ['title'],
    fields: [
      { key: 'title', label: 'Título', type: 'string' },
      { key: 'content', label: 'Conteúdo', type: 'string' },
      { key: 'priority', label: 'Prioridade', type: 'string' },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'newsCategories' },
      { key: 'createdBy', label: 'Criado por', type: 'string' },
      { key: 'publishedAt', label: 'Data de publicação', type: 'date' },
    ],
    fks: [],
    supportsCustomFields: false,
    referenceable: false,
  },
};

export const ENTITY_REGISTRY_LIST: EntityMetadata[] = Object.values(ENTITY_REGISTRY);

export const getEntityByCollection = (collection: string): EntityMetadata | undefined =>
  ENTITY_REGISTRY_LIST.find((entity) => entity.collection === collection);

export const getEntityByEventPrefix = (prefix: string): EntityMetadata | undefined =>
  ENTITY_REGISTRY_LIST.find((entity) => entity.eventPrefix === prefix);

export const getEntityDisplayName = (
  entity: EntityMetadata,
  data: Record<string, unknown>,
): string | undefined => {
  for (const fieldKey of entity.displayNameFields) {
    const value = data[fieldKey];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
};
