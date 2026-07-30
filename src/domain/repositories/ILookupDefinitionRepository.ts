import type { LookupDefinition } from '../entities';

export type LookupDefinitionInput = Omit<LookupDefinition, 'createdAt'>;

/**
 * As listas que ESTE tenant declarou. Nunca inclui as do kernel: aquelas são declaração de código
 * (`LOOKUP_REGISTRY`) e não têm documento — replicá-las aqui transformaria cada mudança no registro
 * numa migração de dados.
 */
export interface ILookupDefinitionRepository {
  subscribe(tenantId: string, onChange: (definitions: LookupDefinition[]) => void): () => void;
  getAll(tenantId: string): Promise<LookupDefinition[]>;
  upsert(tenantId: string, definition: LookupDefinitionInput): Promise<LookupDefinition>;
  /** Remove só a DECLARAÇÃO. As opções já cadastradas ficam na coleção, prontas para reuso. */
  delete(tenantId: string, collection: string): Promise<void>;
}
