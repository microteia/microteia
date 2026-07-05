export interface FkFieldSpec {
  targetCollection: string;
  multi?: boolean;
}

/**
 * Campos das entidades fixas que guardam id (ou array de ids) de outra entidade — nenhuma
 * delas mantém mais um nome espelhado localmente, então toda FK precisa de resolução ao vivo
 * aqui para aparecer legível no diff de auditoria. `targetCollection` é sempre uma chave de
 * `FLAT_ENTITY_CONFIG` (auditableEntities.ts).
 */
export const STATIC_FK_SCHEMA: Record<string, Record<string, FkFieldSpec>> = {
  persons: {
    tagIds: { targetCollection: 'personTags', multi: true },
  },
  cases: {
    contractId: { targetCollection: 'contracts' },
    responsibleLawyerId: { targetCollection: 'members' },
    activePoleIds: { targetCollection: 'persons', multi: true },
    passivePoleIds: { targetCollection: 'persons', multi: true },
    tagIds: { targetCollection: 'caseTags', multi: true },
  },
  deadlines: {
    caseId: { targetCollection: 'cases' },
    responsibleLawyerId: { targetCollection: 'members' },
  },
  financials: {
    caseId: { targetCollection: 'cases' },
    personId: { targetCollection: 'persons' },
    contractId: { targetCollection: 'contracts' },
    tagIds: { targetCollection: 'financialTags', multi: true },
  },
  contracts: {
    clientId: { targetCollection: 'persons' },
    responsibleId: { targetCollection: 'persons' },
    contractorIds: { targetCollection: 'persons', multi: true },
    contracteeIds: { targetCollection: 'persons', multi: true },
    witnessIds: { targetCollection: 'persons', multi: true },
    contractorLawyerIds: { targetCollection: 'persons', multi: true },
    contracteeLawyerIds: { targetCollection: 'persons', multi: true },
    tagIds: { targetCollection: 'contractTags', multi: true },
  },
};

/**
 * Coleções fixas cujo `customValues` pode conter campos do tipo "reference" criados no
 * Screen Builder. Para essas, o `screenKey` do próprio `ScreenDefinition` é o nome da coleção
 * (ex: `tenants/{tenantId}/screenDefinitions/cases`).
 */
export const CUSTOM_FIELD_COLLECTIONS = new Set(['persons', 'cases', 'deadlines', 'financials', 'contracts']);

/** Único destino possível para um `refEntity` que não é uma entidade fixa: os Registros Personalizados. */
export const BUILTIN_REF_ENTITIES = new Set(['persons', 'cases', 'contracts', 'deadlines', 'financials']);

export const resolveRefEntityCollection = (refEntity: string): string =>
  BUILTIN_REF_ENTITIES.has(refEntity) ? refEntity : 'customRecords';
