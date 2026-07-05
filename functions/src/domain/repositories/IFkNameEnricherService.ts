import type { EntityData } from '../services/auditDiff';

export interface AuditFieldDiff {
  before?: EntityData;
  after?: EntityData;
}

export interface IFkNameEnricherService {
  /**
   * Substitui, dentro de `diff`, cada campo declarado como FK (estático ou "reference" de
   * campo personalizado) pelo nome de exibição da entidade apontada — preservando o id quando
   * a entidade referenciada não é encontrada (ex: já excluída).
   */
  enrichDiff(tenantId: string, collection: string, screenKey: string | undefined, diff: AuditFieldDiff): Promise<AuditFieldDiff>;
}
