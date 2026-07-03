import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import { getDb } from '../firebase/initFirebase';

/**
 * `pushInteractions` é coleção raiz (não tenant-scoped) e as Security Rules só permitem que
 * cada usuário escreva/apague sua própria interação (`request.resource.data.userId ==
 * request.auth.uid`) — não há como um admin do tenant apagar em cascata pelo client ao excluir
 * o `Push`. Por isso a cascata roda aqui, via Admin SDK (ignora as regras), disparada pela
 * própria exclusão do documento pai.
 */
export const cascadeDeletePushInteractions = onDocumentDeleted(
  { document: 'tenants/{tenantId}/pushes/{pushId}', region: 'southamerica-east1' },
  async (event) => {
    const { pushId } = event.params;
    try {
      const db = getDb();
      const snap = await db.collection('pushInteractions').where('pushId', '==', pushId).get();
      if (snap.empty) return;

      const batch = db.batch();
      for (const doc of snap.docs) batch.delete(doc.ref);
      await batch.commit();
    } catch (error) {
      console.error(`[pushInteractions] Falha ao cascatear exclusão para push ${pushId}:`, error);
    }
  },
);
