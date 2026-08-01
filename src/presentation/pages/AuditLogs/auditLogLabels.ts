import type { AuditAction, AuditSeverity, ScreenDefinition } from '../../../domain/entities';

/**
 * Entidades que o kernel audita por nome próprio, e as que já saíram dele — os logs gravados antes
 * da migração guardam `Person`/`Case`/`Contract` e continuam legíveis. Log novo de tela declarada
 * guarda a COLEÇÃO, resolvida em `entityLabel`.
 */
export const ENTITY_LABELS: Record<string, string> = {
  Person: 'Pessoa',
  Case: 'Processo',
  Contract: 'Contrato',
  Deadline: 'Prazo',
  Financial: 'Financeiro',
  TenantMember: 'Membro',
  PersonTag: 'Etiqueta de Pessoa',
  CaseTag: 'Etiqueta de Processo',
  ContractTag: 'Etiqueta de Contrato',
  FinancialTag: 'Etiqueta de Financeiro',
  PersonNote: 'Nota de Pessoa',
  CaseNote: 'Nota de Processo',
  ContractNote: 'Nota de Contrato',
  PersonDocument: 'Documento de Pessoa',
  CaseDocument: 'Documento de Processo',
  ContractDocument: 'Documento de Contrato',
  FinancialDocument: 'Documento de Financeiro',
  Record: 'Registro',
  RecordNote: 'Nota de Registro',
  CustomRecordDocument: 'Documento de Registro',
  ScreenDefinition: 'Tela Personalizada',
  Tenant: 'Escritório',
  Workflow: 'Automação',
  SYSTEM: 'Sistema',
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Criação',
  UPDATE: 'Alteração',
  DELETE: 'Exclusão',
  SYSTEM: 'Sistema',
};

export const SEVERITY_LABELS: Record<AuditSeverity, string> = {
  LOW: 'Baixa',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

const NESTED_PART_LABEL: Record<string, string> = {
  notes: 'Nota',
  documents: 'Documento',
};

const screenTitle = (screens: ScreenDefinition[], collection: string): ScreenDefinition | undefined =>
  screens.find((screen) => (screen.dataCollection ?? screen.id) === collection);

/**
 * O rótulo da entidade auditada. A chave fixa tem nome no código; a de tela declarada é a coleção
 * (`contracts`, `contracts#notes`) e recebe o nome da tela que a descreve HOJE — assim o log
 * acompanha o título quando a tela é renomeada, em vez de congelar o nome do dia da gravação.
 */
export const entityLabel = (entity: string, screens: ScreenDefinition[] = []): string => {
  const [collection, part] = entity.split('#');
  const screen = screenTitle(screens, collection);
  if (!screen) return ENTITY_LABELS[entity] ?? entity;
  const nested = part ? NESTED_PART_LABEL[part] : undefined;
  return nested ? `${nested} de ${screen.titleSingular}` : screen.titleSingular;
};

export interface EntityFilterOption {
  value: string;
  label: string;
}

/** As opções do filtro por entidade: as fixas do kernel mais o que o escritório declara. */
export const entityFilterOptions = (screens: ScreenDefinition[] = []): EntityFilterOption[] => {
  const options = Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }));
  for (const screen of screens) {
    const collection = screen.dataCollection ?? screen.id;
    options.push({ value: collection, label: screen.titleSingular });
    if (screen.hasNotes) options.push({ value: `${collection}#notes`, label: `Nota de ${screen.titleSingular}` });
    if (screen.hasDocuments) options.push({ value: `${collection}#documents`, label: `Documento de ${screen.titleSingular}` });
  }
  return options;
};
