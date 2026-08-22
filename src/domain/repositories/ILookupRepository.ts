import type { LookupOption } from '../entities';

/**
 * Opções de UMA lista, endereçada pelo nome da coleção. Um repositório só serve a lista do kernel
 * (`caseCourts`), a criada no Form Design e a trazida por uma extensão — a origem não muda o caminho.
 */
export interface ILookupRepository {
  subscribe(
    tenantId: string,
    collection: string,
    onChange: (options: LookupOption[]) => void,
  ): () => void;
  getAll(tenantId: string, collection: string): Promise<LookupOption[]>;
  create(tenantId: string, collection: string, option: LookupOption, createdBy: string): Promise<LookupOption>;
  recolor(tenantId: string, collection: string, key: string, color: string): Promise<void>;
  delete(tenantId: string, collection: string, key: string): Promise<void>;
}
