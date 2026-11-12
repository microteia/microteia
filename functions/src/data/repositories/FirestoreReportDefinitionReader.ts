import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { IReportDefinitionReader, StoredReport } from '../../domain/repositories/IReportDefinitionReader';
import type { ReportSpec } from '../../domain/schema/report/reportSpec';

const toStored = (snapshot: DocumentSnapshot): StoredReport | null => {
  const data = snapshot.data();
  const spec = data?.spec as ReportSpec | undefined;
  if (!data || !spec || typeof spec !== 'object') return null;
  return {
    id: snapshot.id,
    key: typeof data.key === 'string' && data.key ? data.key : snapshot.id,
    title: typeof data.title === 'string' ? data.title : snapshot.id,
    spec,
  };
};

export class FirestoreReportDefinitionReader implements IReportDefinitionReader {
  constructor(private readonly db: Firestore) {}

  async find(tenantId: string, keyOrId: string): Promise<StoredReport | null> {
    const reports = this.db.collection(`tenants/${tenantId}/reports`);
    const byKey = await reports.where('key', '==', keyOrId).limit(1).get();
    if (!byKey.empty) return toStored(byKey.docs[0]);
    // Um id com `/` não é endereço de documento — e `doc()` lançaria em vez de dizer "não existe".
    if (keyOrId.includes('/')) return null;
    const byId = await reports.doc(keyOrId).get();
    return byId.exists ? toStored(byId) : null;
  }
}
