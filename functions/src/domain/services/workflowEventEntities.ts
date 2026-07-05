export type WorkflowEventPrefix =
  | 'person' | 'contract' | 'case' | 'deadline' | 'financial' | 'push' | 'custom_record' | 'lookup';

const FLAT_ENTITY_PREFIXES: Record<string, WorkflowEventPrefix> = {
  persons: 'person',
  contracts: 'contract',
  cases: 'case',
  deadlines: 'deadline',
  financials: 'financial',
  pushes: 'push',
  customRecords: 'custom_record',
};

// Coleções de lookup (listas configuráveis por tenant) — todas publicam sob o prefixo genérico
// "lookup", já que o motor de workflow não precisa distinguir qual lista específica mudou.
const LOOKUP_COLLECTIONS = new Set([
  'personTypes', 'personOccupations', 'personNationalities', 'personMaritalStatuses',
  'personCities', 'personRelationships',
  'caseAreas', 'casePhases', 'caseStatuses', 'caseInstances', 'caseActionTypes',
  'caseCourts', 'caseDistricts', 'caseJudges',
  'documentTypes', 'newsCategories',
  'contractTypes', 'contractCategories', 'contractStatuses', 'contractObjects',
  'contractAdjustmentIndexes', 'contractAdjustmentPeriodicities', 'contractCurrencies',
  'contractPaymentMethods', 'contractBanks', 'contractCostCenters',
  'deadlineTypes',
  'financialCategories', 'financialStatuses',
]);

/**
 * Mapeia uma coleção flat de tenant (`tenants/{tenantId}/{collection}/{docId}`) para o prefixo
 * de evento do Workflow Engine (`<prefixo>.saved` / `<prefixo>.deleted`). `undefined` = coleção
 * fora do escopo de eventos (ex: tags, members, aiConnections) — o gatilho ignora rapidamente.
 */
export const getWorkflowEventPrefix = (collection: string): WorkflowEventPrefix | undefined => {
  if (FLAT_ENTITY_PREFIXES[collection]) return FLAT_ENTITY_PREFIXES[collection];
  if (LOOKUP_COLLECTIONS.has(collection)) return 'lookup';
  return undefined;
};
