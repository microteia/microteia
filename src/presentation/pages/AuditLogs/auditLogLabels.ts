import type { AuditAction, AuditSeverity } from '../../../domain/entities';

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
  Tenant: 'Escritório',
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

export const entityLabel = (entity: string): string => ENTITY_LABELS[entity] ?? entity;
