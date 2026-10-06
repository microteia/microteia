import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  IAgentGrantRepository,
  NewAgentGrant,
  RotatedAgentGrant,
} from '../../domain/repositories/IAgentGrantRepository';
import type { AgentGrant, AgentGrantOrigin } from '../../domain/schema/agent/agentGrant';
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
      // Ausente é `manual`: todo acesso gravado antes do OAuth existir é da tela, e lê-los como
      // `oauth` daria ao `/token` o direito de rotacionar um segredo que ninguém pode renovar.
      origin: data.origin === 'oauth' ? ('oauth' as AgentGrantOrigin) : ('manual' as AgentGrantOrigin),
      accessExpiresAt: asDate(data.accessExpiresAt),
      refreshHash: typeof data.refreshHash === 'string' ? data.refreshHash : null,
      clientId: typeof data.clientId === 'string' ? data.clientId : null,
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
      origin: grant.origin ?? 'manual',
      accessExpiresAt: grant.accessExpiresAt ? Timestamp.fromDate(grant.accessExpiresAt) : null,
      refreshHash: grant.refreshHash ?? null,
      clientId: grant.clientId ?? null,
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

  /**
   * A troca acontece dentro de uma TRANSAÇÃO, e a condição é lida lá dentro.
   *
   * Conferir o hash antes e escrever depois deixaria a janela em que dois refreshes simultâneos — o
   * legítimo e o de quem copiou o token — passam os dois. A transação é o que faz o segundo perder.
   */
  async rotate(
    tenantId: string,
    grantId: string,
    expectedRefreshHash: string | null,
    next: RotatedAgentGrant,
  ): Promise<boolean> {
    const reference = this.grants(tenantId).doc(grantId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;

      const data = snapshot.data() ?? {};
      // Normalizado dos dois lados: o acesso recém-consentido ainda não tem refresh, e `null` tem de
      // casar com `null` — a primeira troca é justamente a que estreia o par.
      const current = typeof data.refreshHash === 'string' ? data.refreshHash : null;
      if (current !== (expectedRefreshHash ?? null)) return false;
      if (asDate(data.revokedAt) !== null) return false;

      transaction.update(reference, {
        secretHash: next.secretHash,
        refreshHash: next.refreshHash,
        accessExpiresAt: Timestamp.fromDate(next.accessExpiresAt),
      });
      return true;
    });
  }
}
