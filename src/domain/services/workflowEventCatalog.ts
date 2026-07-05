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

const ENTITY_EVENTS: { prefix: string; entityLabel: string; fields: WorkflowEventFieldOption[] }[] = [
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
      { path: 'responsibleLawyerName', label: 'Nome do advogado responsável' },
      { path: 'contractId', label: 'Id do contrato' },
    ],
  },
  {
    prefix: 'deadline',
    entityLabel: 'Prazo',
    fields: [
      { path: 'type', label: 'Tipo' },
      { path: 'caseId', label: 'Id do processo' },
      { path: 'caseNumber', label: 'Número do processo' },
      { path: 'caseTitle', label: 'Título do processo' },
      { path: 'personName', label: 'Nome do cliente' },
      { path: 'dueDate', label: 'Data de vencimento' },
      { path: 'priority', label: 'Prioridade' },
      { path: 'status', label: 'Status' },
      { path: 'responsibleLawyerId', label: 'Id do advogado responsável' },
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
    ],
  },
];

const buildEntry = (prefix: string, entityLabel: string, action: 'saved' | 'deleted', fields: WorkflowEventFieldOption[]): WorkflowEventCatalogEntry => ({
  name: `${prefix}.${action}`,
  label: `Ao ${action === 'saved' ? 'salvar' : 'excluir'}: ${entityLabel}`,
  fields: [ID_FIELD, ...fields],
});

/**
 * Catálogo estático dos eventos que o Workflow Engine conhece — espelha, do lado do cliente,
 * o mapa `functions/src/domain/services/workflowEventEntities.ts` (publicado por
 * `publishWorkflowEventOnEntityChange`). Ordenado por tipo de ação (salvar, depois excluir),
 * na ordem das entidades abaixo.
 */
export const WORKFLOW_EVENT_CATALOG: WorkflowEventCatalogEntry[] = [
  ...ENTITY_EVENTS.map(({ prefix, entityLabel, fields }) => buildEntry(prefix, entityLabel, 'saved', fields)),
  ...ENTITY_EVENTS.map(({ prefix, entityLabel, fields }) => buildEntry(prefix, entityLabel, 'deleted', fields)),
];

export const getWorkflowEventFields = (eventName: string): WorkflowEventFieldOption[] =>
  WORKFLOW_EVENT_CATALOG.find((entry) => entry.name === eventName)?.fields ?? [];
