import { ENTITY_REGISTRY_LIST } from '../schema/entityRegistry';
import { isLookupCollection } from '../schema/lookupRegistry';
import { RESERVED_COLLECTIONS } from '../schema/screenEntity';

export type WorkflowEventPrefix = string;

const FLAT_ENTITY_PREFIXES: Record<string, WorkflowEventPrefix> = Object.fromEntries(
  ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [
    entity.collection,
    entity.eventPrefix as WorkflowEventPrefix,
  ]),
);

/**
 * Mapeia uma coleção flat de tenant (`tenants/{tenantId}/{collection}/{docId}`) para o prefixo
 * de evento do Workflow Engine (`<prefixo>.saved` / `<prefixo>.deleted`).
 *
 * As entidades fixas mantêm o prefixo declarado no registro (`persons` → `person`), o que preserva
 * os workflows já existentes. Qualquer outra coleção que não seja reservada pelo sistema é uma tela
 * do tenant e emite pelo PRÓPRIO nome (`medico` → `medico.saved`). `undefined` = coleção fora do
 * escopo de eventos (etiquetas, membros, conexões) — o gatilho ignora rapidamente.
 *
 * A checagem é por denylist e não consulta o cache de telas: o gatilho roda em TODA escrita do
 * tenant, e uma leitura extra por escrita sairia cara. Um evento publicado para uma coleção sem
 * automação simplesmente não encontra assinante.
 */
export const getWorkflowEventPrefix = (collection: string): WorkflowEventPrefix | undefined => {
  if (FLAT_ENTITY_PREFIXES[collection]) return FLAT_ENTITY_PREFIXES[collection];
  if (isLookupCollection(collection)) return 'lookup';
  if (RESERVED_COLLECTIONS.has(collection)) return undefined;
  return collection;
};
