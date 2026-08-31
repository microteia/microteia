import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { IScriptRepository } from '../../domain/repositories/IScriptRepository';
import type { Script } from '../../domain/entities/Script';
import { parseArtifactRef } from '../../domain/schema/plugin/artifactRef';

const toDate = (value: unknown): Date => (value instanceof Timestamp ? value.toDate() : (value as Date));

/** O dono precisa bater, e não só o `sourceId` — ver a nota em `FirebaseWorkflowDefinitionRepository`. */
const ownedBy = (owners: string[] | null | undefined, pluginId: string): boolean =>
  Array.isArray(owners) && owners.includes(pluginId);

const mapScript = (id: string, tenantId: string, data: DocumentData): Script => ({
  id,
  tenantId,
  name: data.name,
  description: data.description ?? undefined,
  sourceTs: data.sourceTs ?? '',
  compiledJs: data.compiledJs ?? '',
  inputParams: data.inputParams ?? [],
  outputParams: data.outputParams ?? [],
  ownerPluginIds: data.ownerPluginIds ?? null,
  sourceId: data.sourceId ?? null,
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

  async findByRef(tenantId: string, ref: string): Promise<Script | null> {
    const qualified = parseArtifactRef(ref);
    if (!qualified) return this.findById(tenantId, ref);

    const snap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('scripts')
      .where('sourceId', '==', qualified.artifactId)
      .get();

    const found = snap.docs
      .map((doc) => mapScript(doc.id, tenantId, doc.data()))
      .find((script) => ownedBy(script.ownerPluginIds, qualified.pluginId));
    return found ?? null;
  }
}
