import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import { isLookupCollection } from '../schema/lookupRegistry';

export type WorkflowEventPrefix =
  | 'person' | 'contract' | 'case' | 'deadline' | 'financial' | 'push' | 'custom_record' | 'lookup';

const FLAT_ENTITY_PREFIXES: Record<string, WorkflowEventPrefix> = Object.fromEntries(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [
    entity.collection,
    entity.eventPrefix as WorkflowEventPrefix,
  ]),
);

/**
 * Mapeia uma coleção flat de tenant (`tenants/{tenantId}/{collection}/{docId}`) para o prefixo
 * de evento do Workflow Engine (`<prefixo>.saved` / `<prefixo>.deleted`). `undefined` = coleção
 * fora do escopo de eventos (ex: tags, members, aiConnections) — o gatilho ignora rapidamente.
 */
export const getWorkflowEventPrefix = (collection: string): WorkflowEventPrefix | undefined => {
  if (FLAT_ENTITY_PREFIXES[collection]) return FLAT_ENTITY_PREFIXES[collection];
  if (isLookupCollection(collection)) return 'lookup';
  return undefined;
};
