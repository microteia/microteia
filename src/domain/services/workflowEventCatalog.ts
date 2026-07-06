export interface WorkflowEventFieldOption {
  path: string;
  label: string;
}

export interface WorkflowEventCatalogEntry {
  name: string;
  label: string;
  fields: WorkflowEventFieldOption[];
}

const ID_FIELD: WorkflowEventFieldOption = { path: 'id', label: 'Id' };
const OLD_FIELD: WorkflowEventFieldOption = { path: 'old', label: 'Dados anteriores (objeto)' };
const VALUES_FIELD: WorkflowEventFieldOption = { path: 'values', label: 'Campos dinâmicos (objeto)' };

const ENTITY_EVENTS: { prefix: string; entityLabel: string; fields: WorkflowEventFieldOption[]; denormalizedFields?: WorkflowEventFieldOption[] }[] = [
  {
    prefix: 'person',
    entityLabel: 'Pessoa',
    fields: [
      { path: 'name', label: 'Nome' },
      { path: 'type', label: 'Tipo' },
      { path: 'cpf', label: 'CPF' },
      { path: 'cnpj', label: 'CNPJ' },
      { path: 'email', label: 'E-mail' },
      { path: 'phone', label: 'Telefone' },
      { path: 'status', label: 'Status' },
    ],
  },
  {
    prefix: 'contract',
    entityLabel: 'Contrato',
    fields: [
      { path: 'number', label: 'Número' },
      { path: 'title', label: 'Título' },
      { path: 'type', label: 'Tipo' },
      { path: 'category', label: 'Categoria' },
      { path: 'status', label: 'Status' },
      { path: 'clientId', label: 'Id do Cliente' },
      { path: 'responsibleId', label: 'Id do Responsável' },
    ],
    denormalizedFields: [
      { path: 'client.id', label: 'Cliente: Id' },
      { path: 'client.name', label: 'Cliente: Nome' },
      { path: 'client.type', label: 'Cliente: Tipo' },
      { path: 'client.email', label: 'Cliente: E-mail' },
      { path: 'responsible.id', label: 'Responsável: Id' },
      { path: 'responsible.name', label: 'Responsável: Nome' },
      { path: 'responsible.email', label: 'Responsável: E-mail' },
    ],
  },
  {
    prefix: 'case',
    entityLabel: 'Processo',
    fields: [
      { path: 'caseNumber', label: 'Número do processo' },
      { path: 'title', label: 'Título' },
      { path: 'area', label: 'Área' },
      { path: 'phase', label: 'Fase' },
      { path: 'status', label: 'Status' },
      { path: 'responsibleLawyerId', label: 'Id do advogado responsável' },
      { path: 'contractId', label: 'Id do contrato' },
    ],
    denormalizedFields: [
      { path: 'contract.id', label: 'Contrato: Id' },
      { path: 'contract.number', label: 'Contrato: Número' },
      { path: 'contract.title', label: 'Contrato: Título' },
      { path: 'contract.type', label: 'Contrato: Tipo' },
      { path: 'contract.status', label: 'Contrato: Status' },
      { path: 'responsibleLawyer.id', label: 'Advogado: Id' },
      { path: 'responsibleLawyer.name', label: 'Advogado: Nome' },
      { path: 'responsibleLawyer.email', label: 'Advogado: E-mail' },
    ],
  },
  {
    prefix: 'deadline',
    entityLabel: 'Prazo',
    fields: [
      { path: 'type', label: 'Tipo' },
      { path: 'caseId', label: 'Id do processo' },
      { path: 'dueDate', label: 'Data de vencimento' },
      { path: 'priority', label: 'Prioridade' },
      { path: 'status', label: 'Status' },
      { path: 'description', label: 'Descrição' },
      { path: 'responsibleLawyerId', label: 'Id do advogado responsável' },
    ],
    denormalizedFields: [
      { path: 'case.id', label: 'Processo: Id' },
      { path: 'case.caseNumber', label: 'Processo: Número' },
      { path: 'case.title', label: 'Processo: Título' },
      { path: 'case.area', label: 'Processo: Área' },
      { path: 'responsibleLawyer.id', label: 'Advogado: Id' },
      { path: 'responsibleLawyer.name', label: 'Advogado: Nome' },
      { path: 'responsibleLawyer.email', label: 'Advogado: E-mail' },
    ],
  },
  {
    prefix: 'financial',
    entityLabel: 'Financeiro',
    fields: [
      { path: 'type', label: 'Tipo' },
      { path: 'category', label: 'Categoria' },
      { path: 'amount', label: 'Valor' },
      { path: 'dueDate', label: 'Data de vencimento' },
      { path: 'status', label: 'Status' },
      { path: 'caseId', label: 'Id do processo' },
      { path: 'personId', label: 'Id da pessoa' },
      { path: 'contractId', label: 'Id do contrato' },
    ],
    denormalizedFields: [
      { path: 'case.id', label: 'Processo: Id' },
      { path: 'case.caseNumber', label: 'Processo: Número' },
      { path: 'case.title', label: 'Processo: Título' },
      { path: 'person.id', label: 'Pessoa: Id' },
      { path: 'person.name', label: 'Pessoa: Nome' },
      { path: 'person.type', label: 'Pessoa: Tipo' },
      { path: 'contract.id', label: 'Contrato: Id' },
      { path: 'contract.number', label: 'Contrato: Número' },
      { path: 'contract.title', label: 'Contrato: Título' },
    ],
  },
  {
    prefix: 'push',
    entityLabel: 'Push',
    fields: [
      { path: 'subject', label: 'Assunto' },
      { path: 'from', label: 'Remetente' },
      { path: 'processNumber', label: 'Número do processo' },
      { path: 'court', label: 'Órgão' },
      { path: 'status', label: 'Status' },
      { path: 'receivedAt', label: 'Data de recebimento' },
    ],
  },
  {
    prefix: 'news',
    entityLabel: 'Comunicado',
    fields: [
      { path: 'title', label: 'Título' },
      { path: 'content', label: 'Conteúdo' },
      { path: 'priority', label: 'Prioridade' },
      { path: 'createdBy', label: 'Criado por' },
      { path: 'publishedAt', label: 'Data de publicação' },
    ],
  },
  {
    prefix: 'custom_record',
    entityLabel: 'Entidade Customizada',
    fields: [
      { path: 'screenKey', label: 'Tela' },
    ],
  },
  {
    prefix: 'lookup',
    entityLabel: 'Item de Lista',
    fields: [
      { path: 'key', label: 'Chave' },
      { path: 'label', label: 'Rótulo' },
      { path: 'collection', label: 'Coleção' },
    ],
  },
];

const buildEntry = (
  prefix: string,
  entityLabel: string,
  action: 'saved' | 'deleted',
  fields: WorkflowEventFieldOption[],
  denormalizedFields?: WorkflowEventFieldOption[],
): WorkflowEventCatalogEntry => {
  const allFields = [ID_FIELD];

  if (action === 'saved') {
    allFields.push(OLD_FIELD);
  }

  allFields.push(...fields);

  if (denormalizedFields) {
    allFields.push(...denormalizedFields);
  }

  allFields.push(VALUES_FIELD);

  return {
    name: `${prefix}.${action}`,
    label: `Ao ${action === 'saved' ? 'salvar' : 'excluir'}: ${entityLabel}`,
    fields: allFields,
  };
};

const NOTE_FIELDS: WorkflowEventFieldOption[] = [
  { path: 'parentId', label: 'Id da entidade pai' },
  { path: 'parentType', label: 'Tipo da entidade pai' },
  { path: 'content', label: 'Conteúdo' },
  { path: 'createdBy', label: 'Criado por' },
  { path: 'createdAt', label: 'Data de criação' },
];

const DOCUMENT_FIELDS: WorkflowEventFieldOption[] = [
  { path: 'parentId', label: 'Id da entidade pai' },
  { path: 'parentType', label: 'Tipo da entidade pai' },
  { path: 'fileName', label: 'Nome do arquivo' },
  { path: 'fileSize', label: 'Tamanho do arquivo' },
  { path: 'uploadedBy', label: 'Enviado por' },
  { path: 'uploadedAt', label: 'Data de envio' },
];

const PARENT_DENORM_FIELDS: Record<string, WorkflowEventFieldOption[]> = {
  case: [
    { path: 'parent.id', label: 'Processo: Id' },
    { path: 'parent.caseNumber', label: 'Processo: Número' },
    { path: 'parent.title', label: 'Processo: Título' },
  ],
  person: [
    { path: 'parent.id', label: 'Pessoa: Id' },
    { path: 'parent.name', label: 'Pessoa: Nome' },
  ],
  contract: [
    { path: 'parent.id', label: 'Contrato: Id' },
    { path: 'parent.name', label: 'Contrato: Nome' },
  ],
  deadline: [
    { path: 'parent.id', label: 'Prazo: Id' },
    { path: 'parent.type', label: 'Prazo: Tipo' },
    { path: 'parent.dueDate', label: 'Prazo: Data de vencimento' },
  ],
  financial: [
    { path: 'parent.id', label: 'Financeiro: Id' },
    { path: 'parent.type', label: 'Financeiro: Tipo' },
    { path: 'parent.amount', label: 'Financeiro: Valor' },
  ],
};

const buildNoteEvents = (): WorkflowEventCatalogEntry[] => {
  const parents = ['case', 'person', 'contract', 'deadline', 'financial'];
  const labels: Record<string, string> = {
    case: 'Processo',
    person: 'Pessoa',
    contract: 'Contrato',
    deadline: 'Prazo',
    financial: 'Financeiro',
  };

  const result: WorkflowEventCatalogEntry[] = [];

  for (const parent of parents) {
    const parentFields = PARENT_DENORM_FIELDS[parent] || [];
    result.push(
      buildEntry(`${parent}_note`, `Nota de ${labels[parent]}`, 'saved', NOTE_FIELDS, parentFields),
      buildEntry(`${parent}_note`, `Nota de ${labels[parent]}`, 'deleted', NOTE_FIELDS, parentFields)
    );
  }

  return result;
};

const buildDocumentEvents = (): WorkflowEventCatalogEntry[] => {
  const parents = ['case', 'person', 'contract', 'financial'];
  const labels: Record<string, string> = {
    case: 'Processo',
    person: 'Pessoa',
    contract: 'Contrato',
    financial: 'Financeiro',
  };

  const result: WorkflowEventCatalogEntry[] = [];

  for (const parent of parents) {
    const parentFields = PARENT_DENORM_FIELDS[parent] || [];
    result.push(
      buildEntry(`${parent}_document`, `Documento de ${labels[parent]}`, 'saved', DOCUMENT_FIELDS, parentFields),
      buildEntry(`${parent}_document`, `Documento de ${labels[parent]}`, 'deleted', DOCUMENT_FIELDS, parentFields)
    );
  }

  return result;
};

/**
 * Catálogo estático dos eventos que o Workflow Engine conhece — espelha, do lado do cliente,
 * o mapa `functions/src/domain/services/workflowEventEntities.ts` (publicado por
 * `publishWorkflowEventOnEntityChange`). Ordenado por tipo de ação (salvar, depois excluir),
 * na ordem das entidades abaixo.
 */
export const WORKFLOW_EVENT_CATALOG: WorkflowEventCatalogEntry[] = [
  ...ENTITY_EVENTS.map(({ prefix, entityLabel, fields, denormalizedFields }) =>
    buildEntry(prefix, entityLabel, 'saved', fields, denormalizedFields)
  ),
  ...ENTITY_EVENTS.map(({ prefix, entityLabel, fields, denormalizedFields }) =>
    buildEntry(prefix, entityLabel, 'deleted', fields, denormalizedFields)
  ),
  ...buildNoteEvents(),
  ...buildDocumentEvents(),
];

/**
 * Mapeia o nome de um evento de workflow para o entityKey correspondente.
 * Ex: 'case.saved' → 'cases', 'person.deleted' → 'persons'
 */
export const eventNameToEntityKey = (eventName: string): string | null => {
  const mapping: Record<string, string> = {
    'person': 'persons',
    'contract': 'contracts',
    'case': 'cases',
    'deadline': 'deadlines',
    'financial': 'financials',
    'push': 'pushes',
    'news': 'news',
    'lookup': 'lookups',
  };

  const prefix = eventName.split('.')[0];
  return prefix ? (mapping[prefix] ?? null) : null;
};

export const getWorkflowEventFields = (
  eventName: string,
  dynamicFields: WorkflowEventFieldOption[] = [],
): WorkflowEventFieldOption[] => {
  const entry = WORKFLOW_EVENT_CATALOG.find((e) => e.name === eventName);
  if (!entry) return [];

  if (eventName.startsWith('custom_record.')) {
    const baseFields = entry.fields.filter(f => f.path !== 'values');
    const valuesFields = dynamicFields.map(f => ({ ...f, path: `values.${f.path}` }));
    return [...baseFields, ...valuesFields];
  }

  const baseFields = entry.fields.filter(f => f.path !== 'values');
  if (dynamicFields.length > 0) {
    const valuesFields = dynamicFields.map(f => ({ ...f, path: `values.${f.path}` }));
    return [...baseFields, ...valuesFields];
  }

  return baseFields;
};
