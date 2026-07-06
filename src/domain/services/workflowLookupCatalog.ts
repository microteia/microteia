export type WorkflowLookupGroup = 'person' | 'case' | 'contract' | 'deadline' | 'financial' | 'document' | 'news';

export interface WorkflowLookupCollectionEntry {
  collection: string;
  group: WorkflowLookupGroup;
  screenLabel: string;
  entityLabel: string;
}

/**
 * Catálogo estático das coleções de lookup (listas configuráveis por tenant) que publicam
 * eventos "lookup.saved"/"lookup.deleted" — espelha, do lado do cliente, o conjunto
 * `LOOKUP_COLLECTIONS` de `functions/src/domain/services/workflowEventEntities.ts`. Necessário
 * porque o evento genérico "lookup.*" não distingue sozinho qual lista mudou (dois itens de
 * listas diferentes podem ter o mesmo nome), então o gatilho do Workflow precisa escolher a
 * coleção específica aqui.
 */
export const WORKFLOW_LOOKUP_COLLECTIONS: WorkflowLookupCollectionEntry[] = [
  { collection: 'personTypes', group: 'person', screenLabel: 'Pessoa', entityLabel: 'Tipo' },
  { collection: 'personOccupations', group: 'person', screenLabel: 'Pessoa', entityLabel: 'Profissão' },
  { collection: 'personNationalities', group: 'person', screenLabel: 'Pessoa', entityLabel: 'Nacionalidade' },
  { collection: 'personMaritalStatuses', group: 'person', screenLabel: 'Pessoa', entityLabel: 'Estado Civil' },
  { collection: 'personCities', group: 'person', screenLabel: 'Pessoa', entityLabel: 'Cidade' },
  { collection: 'personRelationships', group: 'person', screenLabel: 'Pessoa', entityLabel: 'Relacionamento' },
  { collection: 'caseAreas', group: 'case', screenLabel: 'Processo', entityLabel: 'Área do Direito' },
  { collection: 'casePhases', group: 'case', screenLabel: 'Processo', entityLabel: 'Fase Processual' },
  { collection: 'caseStatuses', group: 'case', screenLabel: 'Processo', entityLabel: 'Status' },
  { collection: 'caseInstances', group: 'case', screenLabel: 'Processo', entityLabel: 'Instância' },
  { collection: 'caseActionTypes', group: 'case', screenLabel: 'Processo', entityLabel: 'Tipo de Ação' },
  { collection: 'caseCourts', group: 'case', screenLabel: 'Processo', entityLabel: 'Vara/Tribunal' },
  { collection: 'caseDistricts', group: 'case', screenLabel: 'Processo', entityLabel: 'Comarca' },
  { collection: 'caseJudges', group: 'case', screenLabel: 'Processo', entityLabel: 'Juiz(a)' },
  { collection: 'documentTypes', group: 'document', screenLabel: 'Documentos', entityLabel: 'Tipo' },
  { collection: 'newsCategories', group: 'news', screenLabel: 'Notícias', entityLabel: 'Categoria' },
  { collection: 'contractTypes', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Tipo' },
  { collection: 'contractCategories', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Categoria' },
  { collection: 'contractStatuses', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Status' },
  { collection: 'contractObjects', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Objeto' },
  { collection: 'contractAdjustmentIndexes', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Índice de Reajuste' },
  { collection: 'contractAdjustmentPeriodicities', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Periodicidade de Reajuste' },
  { collection: 'contractCurrencies', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Moeda' },
  { collection: 'contractPaymentMethods', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Forma de Pagamento' },
  { collection: 'contractBanks', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Banco' },
  { collection: 'contractCostCenters', group: 'contract', screenLabel: 'Contrato', entityLabel: 'Centro de Custo' },
  { collection: 'deadlineTypes', group: 'deadline', screenLabel: 'Prazo', entityLabel: 'Tipo' },
  { collection: 'financialCategories', group: 'financial', screenLabel: 'Financeiro', entityLabel: 'Categoria' },
  { collection: 'financialStatuses', group: 'financial', screenLabel: 'Financeiro', entityLabel: 'Status' },
];

export const getWorkflowLookupCollectionLabel = (collection: string): string => {
  const entry = WORKFLOW_LOOKUP_COLLECTIONS.find((e) => e.collection === collection);
  return entry ? `${entry.screenLabel}:${entry.entityLabel}` : collection;
};
