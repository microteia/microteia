import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { Script } from '../../domain/entities/Script';

const toDate = (value: unknown): Date => (value instanceof Timestamp ? value.toDate() : (value as Date));

const mapScript = (id: string, tenantId: string, data: DocumentData): Script => ({
  id,
  tenantId,
  name: data.name,
  description: data.description ?? undefined,
  sourceTs: data.sourceTs ?? '',
  compiledJs: data.compiledJs ?? '',
  inputParams: data.inputParams ?? [],
  outputParams: data.outputParams ?? [],
  createdAt: toDate(data.createdAt),
  updatedAt: toDate(data.updatedAt),
});

export class FirebaseScriptRepository implements IScriptRepository {
  constructor(private readonly db: Firestore) {}

  async findById(tenantId: string, id: string): Promise<Script | null> {
    const snap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('scripts')
      .doc(id)
      .get();
    if (!snap.exists) return null;
    return mapScript(snap.id, tenantId, snap.data() as DocumentData);
  }
}
