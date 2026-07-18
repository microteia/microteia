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
  required?: boolean;
  options?: CustomFieldOption[];
  optionsAllowUserAdd?: boolean;
  optionsColored?: boolean;
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
  required?: boolean;
  ui?: FieldUiSpec;
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
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', order: 0 } },
      { key: 'name', label: 'Nome', type: 'string', required: true,
        ui: { order: 1 } },
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
        optionsAllowUserAdd: true,
        ui: { control: 'select', order: 7 } },
      { key: 'occupation', label: 'Profissão', type: 'string', lookupCollection: 'personOccupations',
        optionsAllowUserAdd: true, logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', order: 8, list: { icon: 'briefcase', order: 4 } } },
      { key: 'nationality', label: 'Nacionalidade', type: 'string', lookupCollection: 'personNationalities',
        optionsAllowUserAdd: true, logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', order: 9 } },
      { key: 'maritalStatus', label: 'Estado Civil', type: 'string', lookupCollection: 'personMaritalStatuses',
        optionsAllowUserAdd: true, logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', order: 10 } },
      { key: 'birthDate', label: 'Data de Nascimento', type: 'date',
        logic: { hiddenWhen: PF_ONLY },
        ui: { order: 11 } },
      { key: 'gender', label: 'Sexo', type: 'string', lookupCollection: 'personGenders',
        optionsAllowUserAdd: true, logic: { hiddenWhen: PF_ONLY },
        ui: { control: 'select', order: 12 } },
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
            optionsAllowUserAdd: true,
            ui: { control: 'select', section: 'Endereço', order: 18, list: { icon: 'map', order: 5 } } },
          { key: 'state', label: 'Estado', type: 'string', options: BR_STATE_OPTIONS,
            ui: { control: 'select', section: 'Endereço', order: 19 } },
        ],
      },
      { key: 'notes', label: 'Observações', type: 'string',
        ui: { control: 'textarea', order: 20, placeholder: 'Informações adicionais sobre a pessoa' } },
      { key: 'status', label: 'Status', type: 'string', ui: { form: false } },
    ],
    fks: [
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'personTags', denormKey: 'tag', multi: true,
        ui: { form: false } },
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
      { key: 'caseNumber', label: 'Número do processo', type: 'string', required: true,
        ui: { section: 'Identificação', order: 2 } },
      { key: 'title', label: 'Título', type: 'string', required: true,
        ui: { section: 'Identificação', order: 3 } },
      { key: 'area', label: 'Área', type: 'string', lookupCollection: 'caseAreas',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Classificação', order: 4, list: { icon: 'scales', order: 0 } } },
      { key: 'type', label: 'Tipo de ação', type: 'stringArray', lookupCollection: 'caseActionTypes',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Classificação', order: 5 } },
      { key: 'phase', label: 'Fase', type: 'string', lookupCollection: 'casePhases',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Classificação', order: 6 } },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'caseStatuses',
        optionsAllowUserAdd: true, optionsColored: true,
        ui: { control: 'select', section: 'Classificação', order: 7 } },
      { key: 'instance', label: 'Instância', type: 'string', lookupCollection: 'caseInstances',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Tribunal', order: 8, list: { icon: 'scales', order: 1 } } },
      { key: 'court', label: 'Vara/Tribunal', type: 'string', lookupCollection: 'caseCourts',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Tribunal', order: 9, list: { icon: 'scales', order: 2 } } },
      { key: 'courtDistrict', label: 'Comarca', type: 'string', lookupCollection: 'caseDistricts',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Tribunal', order: 10 } },
      { key: 'judge', label: 'Juiz(a)', type: 'string', lookupCollection: 'caseJudges',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Tribunal', order: 11 } },
      { key: 'filedAt', label: 'Data de distribuição', type: 'date',
        ui: { section: 'Tribunal', order: 12 } },
      { key: 'causeValue', label: 'Valor da causa', type: 'number',
        ui: { control: 'currency', section: 'Financeiro e Responsável', order: 13, list: { icon: 'money', order: 3 } } },
      { key: 'notes', label: 'Observações', type: 'string',
        ui: { control: 'textarea', section: 'Financeiro e Responsável', order: 16 } },
    ],
    fks: [
      {
        key: 'contractId',
        label: 'Contrato',
        targetCollection: 'contracts',
        denormKey: 'contract',
        denormalizedFields: ['number', 'title', 'type', 'status'],
        ui: { section: 'Financeiro e Responsável', order: 15, placeholder: 'Selecione o contrato...' },
      },
      {
        key: 'responsibleLawyerId',
        label: 'Advogado responsável',
        targetCollection: 'members',
        denormKey: 'responsibleLawyer',
        denormalizedFields: ['name', 'email'],
        ui: { section: 'Financeiro e Responsável', order: 14, placeholder: 'Selecione o responsável...' },
      },
      { key: 'activePoleIds', label: 'Polo ativo', targetCollection: 'persons', denormKey: 'activePole', multi: true,
        ui: { section: 'Partes', order: 0, placeholder: 'Selecione as pessoas...' } },
      { key: 'passivePoleIds', label: 'Polo passivo', targetCollection: 'persons', denormKey: 'passivePole', multi: true,
        ui: { section: 'Partes', order: 1, placeholder: 'Selecione as pessoas...' } },
      { key: 'tagIds', label: 'Etiquetas', targetCollection: 'caseTags', denormKey: 'tag', multi: true,
        ui: { form: false } },
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
        ui: { control: 'select', section: 'Identificação', order: 0, placeholder: 'Selecione o tipo...', list: { icon: 'time', order: 0 } } },
      { key: 'priority', label: 'Prioridade', type: 'string', required: true,
        options: DEADLINE_PRIORITY_OPTIONS, optionsColored: true,
        ui: { control: 'select', section: 'Identificação', order: 1, placeholder: 'Selecione a prioridade...' } },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true,
        ui: { section: 'Datas', order: 3, list: { icon: 'calendar', order: 1 } } },
      { key: 'completedAt', label: 'Data de conclusão', type: 'date',
        ui: { section: 'Datas', order: 4 } },
      { key: 'description', label: 'Descrição', type: 'string',
        ui: { control: 'textarea', section: 'Responsável e Detalhes', order: 6, placeholder: 'Detalhes sobre o prazo, documentos necessários, etc.' } },
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
        ui: { section: 'Identificação', order: 2, placeholder: 'Selecione o processo...' },
      },
      {
        key: 'responsibleLawyerId',
        label: 'Advogado responsável',
        targetCollection: 'members',
        denormKey: 'responsibleLawyer',
        denormalizedFields: ['name', 'email'],
        ui: { section: 'Responsável e Detalhes', order: 5, placeholder: 'Selecione o responsável...' },
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
      { key: 'type', label: 'Tipo', type: 'string', required: true, options: FINANCIAL_TYPE_OPTIONS,
        ui: { control: 'select', section: 'Lançamento', order: 0, placeholder: 'Selecione o tipo...' } },
      { key: 'category', label: 'Categoria', type: 'string', lookupCollection: 'financialCategories',
        required: true, optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Lançamento', order: 1, placeholder: 'Selecione a categoria...', list: { icon: 'wallet', order: 0 } } },
      { key: 'amount', label: 'Valor', type: 'number', required: true,
        ui: { control: 'currency', section: 'Lançamento', order: 2, list: { icon: 'money', order: 1 } } },
      { key: 'status', label: 'Status', type: 'string', lookupCollection: 'financialStatuses',
        required: true, optionsAllowUserAdd: true, optionsColored: true,
        ui: { control: 'select', section: 'Lançamento', order: 3, placeholder: 'Selecione o status...' } },
      { key: 'dueDate', label: 'Data de vencimento', type: 'date', required: true,
        ui: { section: 'Datas', order: 4, list: { icon: 'calendar', order: 2 } } },
      { key: 'paymentDate', label: 'Data de pagamento', type: 'date', ui: { section: 'Datas', order: 5 } },
      { key: 'cancelDate', label: 'Data de cancelamento', type: 'date', ui: { section: 'Datas', order: 6 } },
      { key: 'paymentMethod', label: 'Forma de pagamento', type: 'string', options: PAYMENT_METHOD_OPTIONS,
        ui: { control: 'select', section: 'Pagamento', order: 7, placeholder: 'Selecione a forma...' } },
      // O centro de custo é compartilhado com Contratos (useContractLookup) — daí a coleção `contractCostCenters`.
      { key: 'costCenter', label: 'Centro de custo', type: 'string', lookupCollection: 'contractCostCenters',
        optionsAllowUserAdd: true,
        ui: { control: 'select', section: 'Pagamento', order: 8, placeholder: 'Selecione o centro de custo...' } },
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
