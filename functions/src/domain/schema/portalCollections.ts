// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/portalCollections.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Os nomes das coleções do portal — num módulo-FOLHA, sem import nenhum. `screenEntity.ts` os reserva
 * e é importado por quase todo o schema; `portal.ts` depende do motor de expressões, que chega de
 * volta a `screenEntity.ts`. Morando lá, a constante era lida antes de inicializada.
 */
export const PORTAL_USERS_COLLECTION = 'portalUsers';
export const PORTAL_RECORDS_COLLECTION = 'portalRecords';
export const PORTAL_DOCUMENTS_SUBCOLLECTION = 'documents';
/**
 * A reprojeção de uma coleção depois que uma declaração mudou — um documento por coleção, só do
 * servidor. O cursor gravado ali é o gatilho da rodada seguinte.
 */
export const PORTAL_REPROJECTIONS_COLLECTION = 'portal_reprojections';
/** Coleção de RAIZ, só do servidor: a marca do convite que precisa existir antes da conta. */
export const PORTAL_INVITES_COLLECTION = 'portalInvites';
