import type { PortalViewRecorder } from '../../domain/usecases/PortalViewUseCases';
import { toPublishedActor } from '../../domain/engine/workflowActor';
import { getWorkflowEventPrefix } from '../../domain/services/workflowEventEntities';
import { portalViewAuditEntry, portalViewedPayload } from '../../domain/services/portalView';
import { portalViewedEventName } from '../../domain/schema/eventCatalog';
import { getDb } from '../firebase/initFirebase';
import { getDI } from '../di/container';
import { publishEvent } from '../workflow/publishEvent';
import { resolveEventPrefix } from '../workflow/resolveEventPrefix';
import { identifyPortalActor } from './identifyPortalActor';

/**
 * Registra a abertura que o domínio já conferiu e decidiu registrar: a linha de Auditoria e o evento
 * `<prefixo>.portalViewed`, com o convidado como ator. Lê o registro — nunca o grava.
 *
 * O ator vai AO LADO do payload, como em toda execução que uma pessoa causa: a automação que reage
 * grava em nome do convidado (`updatedVia: 'portal'`, `portalVerified` quando ele provou identidade), e
 * `hasPermission(...)` responde não. Qualquer falha sobe: quem chamou desfaz a marca, e o documento não
 * é entregue.
 */
export const portalViewRecorder: PortalViewRecorder = async (fact) => {
  const collection = fact.screen.collection;
  const [record, actor, prefix] = await Promise.all([
    getDI().getPortalRepository().getRecord(fact.tenantId, collection, fact.recordId),
    identifyPortalActor(fact.tenantId, fact.userId),
    resolveEventPrefix(fact.tenantId, collection, getWorkflowEventPrefix(collection) ?? collection),
  ]);
  const data = record ?? {};
  await getDI().getCreateAuditLogUseCase().execute(portalViewAuditEntry(fact, data, actor.name));
  await publishEvent(getDb(), fact.tenantId, portalViewedEventName(prefix), portalViewedPayload(fact, data), toPublishedActor(actor));
};
