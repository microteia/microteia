import type { FirestoreEvent, Change, DocumentSnapshot } from 'firebase-functions/v2/firestore';
import { getDb } from '../../firebase/initFirebase';
import { getDI } from '../../di/container';
import { publishEvent } from '../../workflow/publishEvent';
import { resolveEventPrefix } from '../../workflow/resolveEventPrefix';
import { getWorkflowEventPrefix } from '../../../domain/services/workflowEventEntities';
import { childRecordEvent } from '../../../domain/services/childRecordEvent';
import type { ChildRecordKind } from '../../../domain/schema/eventCatalog';
import { resolveEntity } from '../../../domain/schema/screenEntity';

type ChildWriteEvent = FirestoreEvent<
  Change<DocumentSnapshot> | undefined,
  { tenantId: string; parent: string; parentId: string; childId: string }
>;

const dataOf = (snapshot: DocumentSnapshot | undefined): Record<string, unknown> | null =>
  snapshot?.exists ? (snapshot.data() as Record<string, unknown>) : null;

/**
 * Publica o evento de uma nota ou de um documento de QUALQUER registro de tela.
 *
 * A coleção do pai decide pela mesma regra do evento do próprio registro: reservada ou lista de
 * opções não publica, e o prefixo é o que a tela declara (`eventPrefix`), ou a coleção. É o que faz
 * `<prefixo>_document.saved` existir para toda tela sem que o kernel escreva nome de coleção algum.
 */
export const publishChildRecordEvent = async (kind: ChildRecordKind, event: ChildWriteEvent): Promise<void> => {
  const { tenantId, parent, parentId, childId } = event.params;
  const convention = getWorkflowEventPrefix(parent);
  if (!convention || convention === 'lookup') return;

  try {
    const before = dataOf(event.data?.before);
    const after = dataOf(event.data?.after);
    if (!before && !after) return;

    const [parentPrefix, parentSnapshot, schema] = await Promise.all([
      resolveEventPrefix(tenantId, parent, convention),
      getDb().collection('tenants').doc(tenantId).collection(parent).doc(parentId).get(),
      getDI().getScreenDefinitionCache().getSchemaContext(tenantId),
    ]);

    const published = childRecordEvent({
      kind,
      parentPrefix,
      parentId,
      childId,
      before,
      after,
      parentData: dataOf(parentSnapshot),
      parentEntity: resolveEntity(schema, parent),
    });
    if (published) await publishEvent(getDb(), tenantId, published.name, published.payload);
  } catch (error) {
    console.error(`[workflow] Falha ao publicar o evento de ${kind} ${tenantId}/${parent}/${parentId}/${childId}:`, error);
  }
};
