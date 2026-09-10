import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IAgentGrantRepository, NewAgentGrant } from '../../domain/repositories/IAgentGrantRepository';
import type { AgentGrant } from '../../domain/schema/agent/agentGrant';
import { AGENT_GRANTS_COLLECTION } from '../../domain/schema/agent/agentGrant';

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;

export class FirebaseAgentGrantRepository implements IAgentGrantRepository {
  constructor(private readonly db: Firestore) {}

  private grants(tenantId: string) {
    return this.db.collection('tenants').doc(tenantId).collection(AGENT_GRANTS_COLLECTION);
  }

  async getById(tenantId: string, grantId: string): Promise<AgentGrant | null> {
    const snapshot = await this.grants(tenantId).doc(grantId).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() ?? {};
    const secretHash = typeof data.secretHash === 'string' ? data.secretHash : '';
    const userId = typeof data.userId === 'string' ? data.userId : '';
    // Um documento sem hash ou sem dono não é um acesso incompleto: é um acesso que não pode
    // autenticar ninguém. Tratá-lo como ausente é a mesma falha fechada de todo o resto.
    if (!secretHash || !userId) return null;

    return {
      id: snapshot.id,
      tenantId,
      userId,
      name: typeof data.name === 'string' ? data.name : '',
      permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
      secretHash,
      expiresAt: asDate(data.expiresAt),
      revokedAt: asDate(data.revokedAt),
      lastUsedAt: asDate(data.lastUsedAt),
      createdAt: asDate(data.createdAt) ?? new Date(0),
      createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
    };
  }

  async create(tenantId: string, grant: NewAgentGrant): Promise<string> {
    const reference = this.grants(tenantId).doc();
    await reference.set({
      userId: grant.userId,
      name: grant.name,
      permissions: grant.permissions,
      secretHash: grant.secretHash,
      expiresAt: grant.expiresAt === null ? null : Timestamp.fromDate(grant.expiresAt),
      revokedAt: null,
      lastUsedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: grant.createdBy,
    });
    return reference.id;
  }

  async revoke(tenantId: string, grantId: string, actorId: string): Promise<boolean> {
    const reference = this.grants(tenantId).doc(grantId);
    const snapshot = await reference.get();
    if (!snapshot.exists) return false;
    if (asDate(snapshot.data()?.revokedAt) !== null) return false;

    await reference.update({
      revokedAt: FieldValue.serverTimestamp(),
      revokedBy: actorId,
    });
    return true;
  }

  async touchLastUsed(tenantId: string, grantId: string): Promise<void> {
    await this.grants(tenantId).doc(grantId).update({ lastUsedAt: FieldValue.serverTimestamp() });
  }
}
