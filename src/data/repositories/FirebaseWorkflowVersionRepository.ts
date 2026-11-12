import { collection, getDocs, limit, orderBy, query, Timestamp } from 'firebase/firestore';
import { db } from '../../infrastructure/firebase/config';
import type { IWorkflowVersionRepository } from '../../domain/repositories/IWorkflowVersionRepository';
import { WORKFLOW_VERSIONS_SUBCOLLECTION, contentOriginOf } from '../../domain/schema/workflowVersion';
import type { WorkflowVersion, WorkflowVersionContent } from '../../domain/schema/workflowVersion';

export class FirebaseWorkflowVersionRepository implements IWorkflowVersionRepository {
  async listVersions(tenantId: string, workflowId: string, max: number): Promise<WorkflowVersion[]> {
    const versions = collection(db, 'tenants', tenantId, 'workflow_definitions', workflowId, WORKFLOW_VERSIONS_SUBCOLLECTION);
    const snapshot = await getDocs(query(versions, orderBy('version', 'desc'), limit(max)));
    return snapshot.docs.map((one) => {
      const data = one.data();
      return {
        version: typeof data.version === 'number' ? data.version : Number(one.id),
        savedAt: data.savedAt instanceof Timestamp ? data.savedAt.toDate() : new Date(0),
        content: (data.content ?? {}) as WorkflowVersionContent,
        origin: contentOriginOf(data.origin),
      };
    });
  }
}
