import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { normalizeFirestoreValue } from '../../domain/services/normalizeFirestoreValue';
import { WORKFLOW_VERSIONS_SUBCOLLECTION, contentOriginOf } from '../../domain/schema/workflowVersion';
import type { WorkflowContentOrigin, WorkflowVersionContent } from '../../domain/schema/workflowVersion';
import type { StoredVersionHead } from '../../domain/services/workflowVersions';

/** O código gRPC de "documento já existe" — a versão já estava guardada, e isso não é erro. */
const ALREADY_EXISTS = 6;

export class FirestoreWorkflowVersionRepository {
  constructor(private readonly db: Firestore) {}

  private definitionRef(tenantId: string, definitionId: string) {
    return this.db.collection('tenants').doc(tenantId).collection('workflow_definitions').doc(definitionId);
  }

  private versionRef(tenantId: string, definitionId: string, version: number) {
    return this.definitionRef(tenantId, definitionId).collection(WORKFLOW_VERSIONS_SUBCOLLECTION).doc(String(version));
  }

  async saveVersionIfAbsent(
    tenantId: string, definitionId: string, version: number, content: WorkflowVersionContent, origin: WorkflowContentOrigin,
  ): Promise<void> {
    try {
      await this.versionRef(tenantId, definitionId, version).create({ version, content, origin, savedAt: Timestamp.now() });
    } catch (error) {
      if ((error as { code?: number }).code !== ALREADY_EXISTS) throw error;
    }
  }

  async replaceVersion(
    tenantId: string, definitionId: string, version: number, content: WorkflowVersionContent, origin: WorkflowContentOrigin,
  ): Promise<void> {
    await this.versionRef(tenantId, definitionId, version).set({ version, content, origin, savedAt: Timestamp.now() });
  }

  async latestVersion(tenantId: string, definitionId: string): Promise<StoredVersionHead | null> {
    const snapshot = await this.definitionRef(tenantId, definitionId).collection(WORKFLOW_VERSIONS_SUBCOLLECTION)
      .orderBy('version', 'desc').limit(1).get();
    const head = snapshot.docs[0];
    if (!head) return null;
    const version = head.get('version');
    return typeof version === 'number' ? { version, origin: head.get('origin') ? contentOriginOf(head.get('origin')) : null } : null;
  }

  async setDefinitionVersion(tenantId: string, definitionId: string, version: number): Promise<void> {
    await this.definitionRef(tenantId, definitionId).update({ version });
  }

  async findVersion(tenantId: string, definitionId: string, version: number): Promise<WorkflowVersionContent | null> {
    const snapshot = await this.versionRef(tenantId, definitionId, version).get();
    const content = snapshot.exists ? snapshot.get('content') : null;
    return content && typeof content === 'object' ? normalizeFirestoreValue(content as Record<string, unknown>) : null;
  }
}
