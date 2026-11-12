import { collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IWorkflowVersionRepository } from '../../domain/repositories/IWorkflowVersionRepository';
import { VERSIONED_ARTIFACT_COLLECTIONS, WORKFLOW_VERSIONS_SUBCOLLECTION, contentOriginOf } from '../../domain/schema/workflowVersion';
import type { ArtifactVersion, VersionedArtifact } from '../../domain/schema/workflowVersion';

export class FirebaseWorkflowVersionRepository implements IWorkflowVersionRepository {
  async listVersions(tenantId: string, artifact: VersionedArtifact, id: string, max: number): Promise<ArtifactVersion[]> {
    const versions = collection(db, 'tenants', tenantId, VERSIONED_ARTIFACT_COLLECTIONS[artifact], id, WORKFLOW_VERSIONS_SUBCOLLECTION);
    const snapshot = await getDocs(query(versions, orderBy('version', 'desc'), limit(max)));
    return snapshot.docs.map((one) => {
      const data = one.data();
      return {
        version: typeof data.version === 'number' ? data.version : Number(one.id),
        savedAt: data.savedAt instanceof Timestamp ? data.savedAt.toDate() : new Date(0),
        content: (data.content ?? {}) as Record<string, unknown>,
        origin: contentOriginOf(data.origin),
      };
    });
  }
}
