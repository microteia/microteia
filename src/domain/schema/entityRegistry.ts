import type {
  CustomFieldMask,
  CustomFieldOption,
  CustomFieldType,
  FieldLogic,
  FieldRules,
} from './fieldRules';

export const SCHEMA_VERSION = 1;

export type EntityKey =
  | 'persons'
  | 'cases'
  | 'contracts'
  | 'deadlines'
  | 'financials'
  | 'members'
  | 'pushes'
  | 'news'
  | 'customRecords';

export type WorkflowEntityEventPrefix =
  | 'person'
  | 'case'
  | 'contract'
  | 'deadline'
  | 'financial'
  | 'push'
  | 'custom_record';

export type NativeFieldType = 'string' | 'number' | 'boolean' | 'date' | 'stringArray' | 'object';

export interface FieldUiSpec {
  control?: CustomFieldType;
  mask?: CustomFieldMask;
  section?: string;
  order?: number;
  placeholder?: string;
  required?: boolean;
  optionsAllowUserAdd?: boolean;
  options?: CustomFieldOption[];
  form?: boolean;
  list?: { icon?: string; order?: number };
}

export interface NativeFieldSpec {
  key: string;
  label: string;
  type: NativeFieldType;
  lookupCollection?: string;
  objectFields?: NativeFieldSpec[];
  refEntity?: string;
  multi?: boolean;
  list?: boolean;
  rules?: FieldRules;
  logic?: FieldLogic;
  ui?: FieldUiSpec;
}

export interface FkSpec {
  key: string;
  label: string;
  targetCollection: string;
  denormKey: string;
  multi?: boolean;
  denormalizedFields?: string[];
}

export interface EntityMetadata {
  key: EntityKey;
  collection: string;
  eventPrefix?: WorkflowEntityEventPrefix;
  labelSingular: string;
  labelPlural: string;
  displayNameFields: string[];
  referenceDenormFields: string[];
  fields: NativeFieldSpec[];
  fks: FkSpec[];
  supportsCustomFields: boolean;
  referenceable: boolean;
}

// O formato canônico gravado no Firestore para documentos, telefones e CEP é o de DÍGITOS PUROS
// (a máscara existe só na tela). As regras abaixo normalizam para esse formato e validam em cima
// dele — nunca introduza aqui um preset com máscara, sob pena de mudar o shape do dado gravado.
const EMAIL_PATTERN = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

const PHONE_RULES: FieldRules = {
  format: { preset: 'digits' },
  validate: { pattern: '^\\d{10,11}$', message: 'Telefone deve ter DDD + 8 ou 9 dígitos' },
};

const CEP_RULES: FieldRules = {
  format: { preset: 'digits' },
  validate: { pattern: '^\\d{8}$', message: 'CEP deve ter 8 dígitos' },
};

const PF_ONLY = 'type != "Pessoa Física"';
const PJ_ONLY = 'type != "Pessoa Jurídica"';

const BR_STATE_OPTIONS: CustomFieldOption[] = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
].map((uf) => ({ key: uf, label: uf, isStatic: true }));

export const ENTITY_REGISTRY: Record<EntityKey, EntityMetadata> = {
  persons: {
    key: 'persons',
    collection: 'persons',
    eventPrefix: 'person',
    labelSingular: 'Pessoa',
    labelPlural: 'Pessoas',
    displayNameFields: ['name'],
    referenceDenormFields: ['name', 'type', 'email'],
    fields: [
      { key: 'type', label: 'Tipo', type: 'string', lookupCollection: 'personTypes',
        ui: { control: 'select', optionsAllowUserAdd: true, required: true, order: 0 } },
      { key: 'name', label: 'Nome', type: 'string',
        ui: { required: true, order: 1 } },
      {
        key: 'cpf',
        label: 'CPF',
        type: 'string',
        rules: { format: { preset: 'digits' }, validate: { check: 'cpf' } },
        logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'masked', mask: 'cpf', order: 2, list: { icon: 'contacts', order: 0 } },
      },
      {
        key: 'cnpj',
        label: 'CNPJ',
        type: 'string',
        rules: { format: { preset: 'digits' }, validate: { check: 'cnpj' } },
        logic: { hiddenWhen: PJ_ONLY },
        ui: { control: 'masked', mask: 'cnpj', order: 3, list: { icon: 'contacts', order: 1 } },
      },
      {
        key: 'email',
        label: 'E-mail',
        type: 'string',
        rules: {
          format: { preset: 'trim' },
          validate: { pattern: EMAIL_PATTERN, message: 'E-mail inválido' },
        },
        ui: { placeholder: 'email@exemplo.com', order: 4, list: { icon: 'mail', order: 2 } },
      },
      { key: 'phone', label: 'Telefone', type: 'string', rules: PHONE_RULES,
        ui: { control: 'masked', mask: 'phone', order: 5, list: { icon: 'phone', order: 3 } } },
      { key: 'secondaryPhone', label: 'Telefone Secundário', type: 'string', rules: PHONE_RULES,
        ui: { control: 'masked', mask: 'phone', order: 6 } },
      { key: 'relationship', label: 'Relacionamento', type: 'string', lookupCollection: 'personRelationships',
        ui: { control: 'select', optionsAllowUserAdd: true, order: 7 } },
      { key: 'occupation', label: 'Profissão', type: 'string', lookupCollection: 'personOccupations',
        logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', optionsAllowUserAdd: true, order: 8, list: { icon: 'briefcase', order: 4 } } },
      { key: 'nationality', label: 'Nacionalidade', type: 'string', lookupCollection: 'personNationalities',
        logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', optionsAllowUserAdd: true, order: 9 } },
      { key: 'maritalStatus', label: 'Estado Civil', type: 'string', lookupCollection: 'personMaritalStatuses',
        logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', optionsAllowUserAdd: true, order: 10 } },
      { key: 'birthDate', label: 'Data de Nascimento', type: 'date',
        logic: { hiddenWhen: PF_ONLY },
        ui: { order: 11 } },
      { key: 'gender', label: 'Sexo', type: 'string', lookupCollection: 'personGenders',
        logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', optionsAllowUserAdd: true, order: 12 } },
      {
        key: 'address',
        label: 'Endereço',
        type: 'object',
        objectFields: [
          { key: 'zipCode', label: 'CEP', type: 'string', rules: CEP_RULES,
            ui: { control: 'masked', mask: 'cep', section: 'Endereço', order: 13 } },
          { key: 'street', label: 'Rua / Avenida', type: 'string',
            ui: { section: 'Endereço', order: 14 } },
          { key: 'number', label: 'Número', type: 'string',
            ui: { section: 'Endereço', order: 15 } },
          { key: 'complement', label: 'Complemento', type: 'string',
            ui: { section: 'Endereço', order: 16, placeholder: 'Apto, Sala...' } },
          { key: 'neighborhood', label: 'Bairro', type: 'string',
            ui: { section: 'Endereço', order: 17 } },
          { key: 'city', label: 'Cidade', type: 'string', lookupCollection: 'personCities',
            ui: { control: 'select', optionsAllowUserAdd: true, section: 'Endereço', order: 18, list: { icon: 'map', order: 5 } } },
          { key: 'state', label: 'Estado', type: 'string',
            ui: { control: 'select', options: BR_STATE_OPTIONS, section: 'Endereço', order: 19 } },
        ],
      },
      { key: 'notes', label: 'Observações', type: 'string',
        ui: { control: 'textarea', order: 20, placeholder: 'Informações adicionais sobre a pessoa' } },
      { key: 'status', label: 'Status', type: 'string', ui: { form: false } },
    ],
    fks: [
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'personTags', denormKey: 'tag', multi: true },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  cases: {
    key: 'cases',
    collection: 'cases',
    eventPrefix: 'case',
    labelSingular: 'Processo',
    labelPlural: 'Processos',
    displayNameFields: ['title', 'caseNumber'],
    referenceDenormFields: ['caseNumber', 'title', 'area'],
    fields: [
      { key: 'caseNumber', label: 'Número do processo', type: 'string' },
      { key: 'title', label: 'Título', type: 'string' },
      { key: 'area', label: 'Área', type: 'string', lookupCollection: 'caseAreas' },
      { key: 'type', label: 'Tipo de ação', type: 'stringArray', lookupCollection: 'caseActionTypes' },
      { key: 'court', label: 'Vara/Tribunal', type: 'string', lookupCollection: 'caseCourts' },
      { key: 'courtDistrict', label: 'Comarca', type: 'string', lookupCollection: 'caseDistricts' },
      { key: 'judge', label: 'Juiz(a)', type: 'string', lookupCollection: 'caseJudges' },
      { key: 'instance', label: 'Instância', type: 'string', lookupCollection: 'caseInstances' },
      { key: 'phase', label: 'Fase', type: 'string', lookupCollection: 'casePhases' },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'caseStatuses' },
      { key: 'filedAt', label: 'Data de distribuição', type: 'date' },
      { key: 'causeValue', label: 'Valor da causa', type: 'number' },
      { key: 'notes', label: 'Observações', type: 'string' },
    ],
    fks: [
      {
        key: 'contractId',
        label: 'Contrato',
        targetCollection: 'contracts',
        denormKey: 'contract',
        denormalizedFields: ['number', 'title', 'type', 'status'],
      },
      {
        key: 'responsibleLawyerId',
        label: 'Advogado responsável',
        targetCollection: 'members',
        denormKey: 'responsibleLawyer',
        denormalizedFields: ['name', 'email'],
      },
      { key: 'activePoleIds', label: 'Polo ativo', targetCollection: 'persons', denormKey: 'activePole', multi: true },
      { key: 'passivePoleIds', label: 'Polo passivo', targetCollection: 'persons', denormKey: 'passivePole', multi: true },
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'caseTags', denormKey: 'tag', multi: true },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  contracts: {
    key: 'contracts',
    collection: 'contracts',
    eventPrefix: 'contract',
    labelSingular: 'Contrato',
    labelPlural: 'Contratos',
    displayNameFields: ['title', 'number'],
    referenceDenormFields: ['number', 'title', 'type'],
    fields: [
      { key: 'number', label: 'Número', type: 'string' },
      { key: 'title', label: 'Título', type: 'string' },
      { key: 'type', label: 'Tipo', type: 'string', lookupCollection: 'contractTypes' },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'contractCategories' },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'contractStatuses' },
      { key: 'object', label: 'Objeto', type: 'string', lookupCollection: 'contractObjects' },
      { key: 'draftedAt', label: 'Data de elaboração', type: 'date' },
      { key: 'signedAt', label: 'Data de assinatura', type: 'date' },
      { key: 'effectiveStart', label: 'Início de vigência', type: 'date' },
      { key: 'effectiveEnd', label: 'Fim de vigência', type: 'date' },
      { key: 'autoRenewal', label: 'Renovação automática', type: 'boolean' },
      { key: 'renewalDate', label: 'Data de renovação', type: 'date' },
      { key: 'terminationDate', label: 'Data de rescisão', type: 'date' },
      { key: 'initialValue', label: 'Valor inicial', type: 'number' },
      { key: 'monthlyValue', label: 'Valor mensal', type: 'number' },
      { key: 'totalValue', label: 'Valor total', type: 'number' },
      { key: 'adjustmentIndex', label: 'Índice de reajuste', type: 'string', lookupCollection: 'contractAdjustmentIndexes' },
      { key: 'adjustmentPeriodicity', label: 'Periodicidade de reajuste', type: 'string', lookupCollection: 'contractAdjustmentPeriodicities' },
      { key: 'currency', label: 'Moeda', type: 'string', lookupCollection: 'contractCurrencies' },
      { key: 'paymentMethod', label: 'Forma de pagamento', type: 'string', lookupCollection: 'contractPaymentMethods' },
      { key: 'dueDay', label: 'Dia de vencimento', type: 'number' },
      { key: 'installments', label: 'Parcelas', type: 'number' },
      { key: 'bank', label: 'Banco', type: 'string', lookupCollection: 'contractBanks' },
      { key: 'bankAccount', label: 'Conta bancária', type: 'string' },
      { key: 'pixKey', label: 'Chave PIX', type: 'string' },
      { key: 'costCenter', label: 'Centro de custo', type: 'string', lookupCollection: 'contractCostCenters' },
    ],
    fks: [
      {
        key: 'clientId',
        label: 'Cliente',
        targetCollection: 'persons',
        denormKey: 'client',
        denormalizedFields: ['name', 'type', 'email'],
      },
      {
        key: 'responsibleId',
        label: 'Responsável',
        targetCollection: 'members',
        denormKey: 'responsible',
        denormalizedFields: ['name', 'email'],
      },
      { key: 'contractorIds', label: 'Contratantes', targetCollection: 'persons', denormKey: 'contractor', multi: true },
      { key: 'contracteeIds', label: 'Contratados', targetCollection: 'persons', denormKey: 'contractee', multi: true },
      { key: 'witnessIds', label: 'Testemunhas', targetCollection: 'persons', denormKey: 'witness', multi: true },
      { key: 'contractorLawyerIds', label: 'Advogados dos contratantes', targetCollection: 'persons', denormKey: 'contractorLawyer', multi: true },
      { key: 'contracteeLawyerIds', label: 'Advogados dos contratados', targetCollection: 'persons', denormKey: 'contracteeLawyer', multi: true },
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'contractTags', denormKey: 'tag', multi: true },
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
      { key: 'description', label: 'Descrição', type: 'string' },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date' },
      { key: 'type', label: 'Tipo', type: 'string', lookupCollection: 'deadlineTypes' },
      { key: 'priority', label: 'Prioridade', type: 'string' },
      { key: 'status', label: 'Status', type: 'string' },
      { key: 'completedAt', label: 'Data de conclusão', type: 'date' },
      { key: 'notes', label: 'Observações', type: 'string' },
    ],
    fks: [
      {
        key: 'caseId',
        label: 'Processo',
        targetCollection: 'cases',
        denormKey: 'case',
        denormalizedFields: ['caseNumber', 'title', 'area'],
      },
      {
        key: 'responsibleLawyerId',
        label: 'Advogado responsável',
        targetCollection: 'members',
        denormKey: 'responsibleLawyer',
        denormalizedFields: ['name', 'email'],
      },
    ],
    supportsCustomFields: true,
    referenceable: true,
  },
  financials: {
    key: 'financials',
    collection: 'financials',
    eventPrefix: 'financial',
    labelSingular: 'Financeiro',
    labelPlural: 'Financeiro',
    displayNameFields: ['category'],
    referenceDenormFields: ['type', 'amount', 'dueDate'],
    fields: [
      { key: 'type', label: 'Tipo', type: 'string' },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'financialCategories' },
      { key: 'costCenter', label: 'Centro de custo', type: 'string' },
      { key: 'amount', label: 'Valor', type: 'number' },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date' },
      { key: 'paymentDate', label: 'Data de pagamento', type: 'date' },
      { key: 'cancelDate', label: 'Data de cancelamento', type: 'date' },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'financialStatuses' },
      { key: 'paymentMethod', label: 'Forma de pagamento', type: 'string' },
      { key: 'invoiceNumber', label: 'Número da nota', type: 'string' },
      { key: 'notes', label: 'Observações', type: 'string' },
    ],
    fks: [
      {
        key: 'caseId',
        label: 'Processo',
        targetCollection: 'cases',
        denormKey: 'case',
        denormalizedFields: ['caseNumber', 'title'],
      },
      {
        key: 'personId',
        label: 'Pessoa',
        targetCollection: 'persons',
        denormKey: 'person',
        denormalizedFields: ['name', 'type'],
      },
      {
        key: 'contractId',
        label: 'Contrato',
        targetCollection: 'contracts',
        denormKey: 'contract',
        denormalizedFields: ['number', 'title'],
      },
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'financialTags', denormKey: 'tag', multi: true },
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
  customRecords: {
    key: 'customRecords',
    collection: 'customRecords',
    eventPrefix: 'custom_record',
    labelSingular: 'Entidade Customizada',
    labelPlural: 'Entidades Customizadas',
    displayNameFields: ['title'],
    referenceDenormFields: ['title'],
    fields: [
      { key: 'screenKey', label: 'Tela', type: 'string' },
      { key: 'title', label: 'Título', type: 'string' },
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
