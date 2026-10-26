import { FieldValue } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IRecordDocumentSharing, SharableRecordDocument } from '../../domain/repositories/IRecordDocumentSharing';
import type { PortalScreen } from '../../domain/repositories/IPortalRepository';
import { portalScreenOf } from '../../domain/schema/portal';

/** O Firestore aceita até 500 escritas num lote. */
const BATCH_LIMIT = 450;

export class FirebaseRecordDocumentSharing implements IRecordDocumentSharing {
  constructor(
    private readonly db: Firestore,
    private readonly portalScreens: (tenantId: string) => Promise<PortalScreen[]>,
  ) {}

  private record(tenantId: string, physicalCollection: string, recordId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(physicalCollection).doc(recordId);
  }

  async recordExists(tenantId: string, physicalCollection: string, recordId: string): Promise<boolean> {
    return (await this.record(tenantId, physicalCollection, recordId).get()).exists;
  }

  async documents(tenantId: string, physicalCollection: string, recordId: string): Promise<SharableRecordDocument[]> {
    const snapshot = await this.record(tenantId, physicalCollection, recordId).collection('documents').get();
    return snapshot.docs
      .filter((doc) => !doc.get('deletedBy'))
      .map((doc) => {
        const type = doc.get('type');
        return {
          id: doc.id,
          ...(typeof type === 'string' && type ? { type } : {}),
          portalShared: doc.get('portalShared') === true,
        };
      });
  }

  async setPortalShared(
    tenantId: string,
    physicalCollection: string,
    recordId: string,
    documentIds: readonly string[],
    shared: boolean,
    actorUid: string,
  ): Promise<void> {
    const documents = this.record(tenantId, physicalCollection, recordId).collection('documents');
    for (let start = 0; start < documentIds.length; start += BATCH_LIMIT) {
      const batch = this.db.batch();
      for (const id of documentIds.slice(start, start + BATCH_LIMIT)) {
        batch.update(documents.doc(id), {
          portalShared: shared,
          portalSharedBy: actorUid,
          portalSharedAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }
  }

  async portalShowsDocuments(tenantId: string, physicalCollection: string): Promise<boolean> {
    return portalScreenOf(await this.portalScreens(tenantId), physicalCollection)?.portal?.documents === true;
  }
}
