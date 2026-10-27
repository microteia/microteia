import type { PortalViewFact } from '../usecases/PortalViewUseCases';
import type { CreateAuditLogInput } from '../usecases/CreateAuditLogUseCase';
import { PORTAL_VIEW_REPEAT_MINUTES, portalRecordTitle } from '../schema/portal';

/**
 * O payload de `<prefixo>.portalViewed`: o registro, na raiz — como o `saved` o leva, para a condição e o
 * `upsert` lerem os mesmos caminhos —, e a abertura em `portalView`, que vem por último e por isso não é
 * sobrescrita por um campo do registro com o mesmo nome. O convidado NÃO está aqui: é o `actor` do evento.
 */
export const portalViewedPayload = (
  fact: PortalViewFact,
  record: Record<string, unknown>,
): Record<string, unknown> => ({
  id: fact.recordId,
  ...record,
  portalView: {
    at: fact.at,
    email: fact.email,
    documentId: fact.document?.id ?? null,
    documentName: fact.document?.name ?? null,
    documentType: fact.document?.type ?? null,
  },
});

/**
 * A linha de Auditoria da abertura. Aponta para o registro aberto — a entidade é a COLEÇÃO, como nas
 * linhas de gravação, para o filtro por tela achá-la — e o autor é o convidado, pelo nome com que ele
 * aparece ao escritório. O título do registro é o do ESCRITÓRIO (`portalRecordTitle`): quem lê a
 * Auditoria é de dentro, e o campo de título pode não estar entre os expostos.
 */
export const portalViewAuditEntry = (
  fact: PortalViewFact,
  record: Record<string, unknown>,
  guestName: string,
): CreateAuditLogInput => {
  const who = guestName || fact.email;
  const title = portalRecordTitle(fact.screen, record) || fact.recordId;
  return {
    tenantId: fact.tenantId,
    title: fact.document ? '@core.tenant/portal.audit.viewed-document' : '@core.tenant/portal.audit.viewed',
    titleParams: {
      guest: who,
      record: title,
      screen: fact.screen.titleSingular,
      ...(fact.document ? { document: fact.document.name } : {}),
    },
    userId: fact.userId,
    userName: who,
    photoURL: '',
    action: 'SYSTEM',
    type: 'AUDIT',
    entity: fact.screen.collection,
    entityId: fact.recordId,
    linkCollection: fact.screen.collection,
    linkRecordId: fact.recordId,
    text: '@core.tenant/portal.audit.viewed.detail',
    textParams: { email: fact.email, minutes: String(PORTAL_VIEW_REPEAT_MINUTES) },
  };
};
