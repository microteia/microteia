import type { AuditAction } from '../entities/AuditLog';

type EntityData = Record<string, unknown>;

export interface AuditableEntityConfig {
  entityKey: string;
  entityLabel: string;
  entityLabelPlural: string;
  getDisplayName: (data: EntityData) => string;
  getEntityLink?: (tenantId: string, docId: string, parentId?: string, data?: EntityData) => string;
  /** Restringe quais ações geram log (ex: Pushes só audita UPDATE/DELETE). Sem isso, audita CREATE/UPDATE/DELETE. */
  auditActions?: AuditAction[];
}

export const truncate = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}…` : text;

export const asString = (v: unknown, fallback = 'sem nome'): string =>
  typeof v === 'string' && v.trim() ? v.trim() : fallback;

const FLAT_ENTITY_CONFIG: Record<string, AuditableEntityConfig> = {
  persons: {
    entityKey: 'Person',
    entityLabel: 'Pessoa',
    entityLabelPlural: 'Pessoas',
    getDisplayName: (d) => asString(d.name),
    getEntityLink: (_tenantId, docId) => `view-person:${docId}`,
  },
  cases: {
    entityKey: 'Case',
    entityLabel: 'Processo',
    entityLabelPlural: 'Processos',
    getDisplayName: (d) => asString(d.title ?? d.caseNumber),
    getEntityLink: (_tenantId, docId) => `view-case:${docId}`,
  },
  contracts: {
    entityKey: 'Contract',
    entityLabel: 'Contrato',
    entityLabelPlural: 'Contratos',
    getDisplayName: (d) => asString(d.title ?? d.number),
    getEntityLink: (_tenantId, docId) => `view-contract:${docId}`,
  },
  deadlines: {
    entityKey: 'Deadline',
    entityLabel: 'Prazo',
    entityLabelPlural: 'Prazos',
    getDisplayName: (d) => asString(d.description, 'Prazo'),
    getEntityLink: (_tenantId, docId) => `view-deadline:${docId}`,
  },
  financials: {
    entityKey: 'Financial',
    entityLabel: 'Financeiro',
    entityLabelPlural: 'Financeiro',
    getDisplayName: (d) => asString(d.category),
    getEntityLink: (_tenantId, docId) => `view-financial:${docId}`,
  },
  members: {
    entityKey: 'TenantMember',
    entityLabel: 'Membro',
    entityLabelPlural: 'Membros',
    getDisplayName: (d) => asString(d.displayName ?? d.email),
  },
  personTags: {
    entityKey: 'PersonTag',
    entityLabel: 'Etiqueta de Pessoa',
    entityLabelPlural: 'Etiquetas de Pessoas',
    getDisplayName: (d) => asString(d.name),
  },
  caseTags: {
    entityKey: 'CaseTag',
    entityLabel: 'Etiqueta de Processo',
    entityLabelPlural: 'Etiquetas de Processos',
    getDisplayName: (d) => asString(d.name),
  },
  contractTags: {
    entityKey: 'ContractTag',
    entityLabel: 'Etiqueta de Contrato',
    entityLabelPlural: 'Etiquetas de Contratos',
    getDisplayName: (d) => asString(d.name),
  },
  financialTags: {
    entityKey: 'FinancialTag',
    entityLabel: 'Etiqueta de Financeiro',
    entityLabelPlural: 'Etiquetas de Financeiro',
    getDisplayName: (d) => asString(d.name),
  },
  pushes: {
    entityKey: 'Push',
    entityLabel: 'Push do Tribunal',
    entityLabelPlural: 'Pushes do Tribunal',
    getDisplayName: (d) => asString(d.subject ?? d.processNumber, 'Push'),
    // Criação é automática (Cloud Function do webhook do Gmail) — só interessa auditar
    // a triagem manual (mudança de status) e a exclusão.
    auditActions: ['UPDATE', 'DELETE'],
  },
  screenDefinitions: {
    entityKey: 'ScreenDefinition',
    entityLabel: 'Tela Personalizada',
    entityLabelPlural: 'Telas Personalizadas',
    getDisplayName: (d) => asString(d.titlePlural ?? d.titleSingular),
    getEntityLink: () => 'screen-builder',
  },
  customRecords: {
    entityKey: 'CustomRecord',
    entityLabel: 'Registro Personalizado',
    entityLabelPlural: 'Registros Personalizados',
    getDisplayName: (d) => asString(d.title),
    getEntityLink: (_tenantId, docId, _parentId, data) =>
      `view-dyn:${asString(data?.screenKey, '')}:${docId}`,
  },
};

const NESTED_ENTITY_CONFIG: Record<string, Record<string, AuditableEntityConfig>> = {
  persons: {
    notes: {
      entityKey: 'PersonNote',
      entityLabel: 'Nota de Pessoa',
      entityLabelPlural: 'Notas de Pessoas',
      getDisplayName: (d) => truncate(asString(d.title ?? d.text, 'Nota'), 60),
      getEntityLink: (_tenantId, _docId, parentId) => `view-person:${parentId}`,
    },
    documents: {
      entityKey: 'PersonDocument',
      entityLabel: 'Documento de Pessoa',
      entityLabelPlural: 'Documentos de Pessoas',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId) => `view-person:${parentId}`,
    },
  },
  cases: {
    notes: {
      entityKey: 'CaseNote',
      entityLabel: 'Nota de Processo',
      entityLabelPlural: 'Notas de Processos',
      getDisplayName: (d) => truncate(asString(d.title ?? d.text, 'Nota'), 60),
      getEntityLink: (_tenantId, _docId, parentId) => `view-case:${parentId}`,
    },
    documents: {
      entityKey: 'CaseDocument',
      entityLabel: 'Documento de Processo',
      entityLabelPlural: 'Documentos de Processos',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId) => `view-case:${parentId}`,
    },
  },
  contracts: {
    notes: {
      entityKey: 'ContractNote',
      entityLabel: 'Nota de Contrato',
      entityLabelPlural: 'Notas de Contratos',
      getDisplayName: (d) => truncate(asString(d.title ?? d.text, 'Nota'), 60),
      getEntityLink: (_tenantId, _docId, parentId) => `view-contract:${parentId}`,
    },
    documents: {
      entityKey: 'ContractDocument',
      entityLabel: 'Documento de Contrato',
      entityLabelPlural: 'Documentos de Contratos',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId) => `view-contract:${parentId}`,
    },
  },
  financials: {
    documents: {
      entityKey: 'FinancialDocument',
      entityLabel: 'Documento de Financeiro',
      entityLabelPlural: 'Documentos de Financeiro',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId) => `view-financial:${parentId}`,
    },
  },
  customRecords: {
    notes: {
      entityKey: 'CustomRecordNote',
      entityLabel: 'Nota de Registro Personalizado',
      entityLabelPlural: 'Notas de Registros Personalizados',
      getDisplayName: (d) => truncate(asString(d.title ?? d.text, 'Nota'), 60),
      getEntityLink: (_tenantId, _docId, parentId, data) =>
        `view-dyn:${asString(data?.screenKey, '')}:${parentId}`,
    },
    documents: {
      entityKey: 'CustomRecordDocument',
      entityLabel: 'Documento de Registro Personalizado',
      entityLabelPlural: 'Documentos de Registros Personalizados',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId, data) =>
        `view-dyn:${asString(data?.screenKey, '')}:${parentId}`,
    },
  },
  screenDefinitions: {
    tags: {
      entityKey: 'CustomRecordTag',
      entityLabel: 'Etiqueta de Tela Personalizada',
      entityLabelPlural: 'Etiquetas de Telas Personalizadas',
      getDisplayName: (d) => asString(d.name),
      getEntityLink: (_tenantId, _docId, parentId) => `dyn:${parentId}`,
    },
  },
};

export const getFlatEntityConfig = (collection: string): AuditableEntityConfig | null =>
  FLAT_ENTITY_CONFIG[collection] ?? null;

export const getNestedEntityConfig = (parentCollection: string, subCollection: string): AuditableEntityConfig | null =>
  NESTED_ENTITY_CONFIG[parentCollection]?.[subCollection] ?? null;
