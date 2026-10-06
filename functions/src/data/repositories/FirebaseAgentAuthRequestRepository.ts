import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type {
  ConsentedAgentAuthRequest,
  IAgentAuthRequestRepository,
  NewAgentAuthRequest,
} from '../../domain/repositories/IAgentAuthRequestRepository';
import type { AgentAuthRequest } from '../../domain/schema/agent/agentOAuth';
import { AGENT_AUTH_REQUESTS_COLLECTION } from '../../domain/schema/agent/agentOAuth';

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

export class FirebaseAgentAuthRequestRepository implements IAgentAuthRequestRepository {
  constructor(private readonly db: Firestore) {}

  private requests() {
    return this.db.collection(AGENT_AUTH_REQUESTS_COLLECTION);
  }

  async create(request: NewAgentAuthRequest): Promise<string> {
    const reference = this.requests().doc();
    await reference.set({
      clientId: request.clientId,
      clientName: request.clientName,
      redirectUri: request.redirectUri,
      state: request.state,
      codeChallenge: request.codeChallenge,
      scope: request.scope,
      resource: request.resource,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(request.expiresAt),
      tenantId: null,
      userId: null,
      grantId: null,
      codeHash: null,
      usedAt: null,
    });
    return reference.id;
  }

  async getById(requestId: string): Promise<AgentAuthRequest | null> {
    const snapshot = await this.requests().doc(requestId).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() ?? {};
    const expiresAt = asDate(data.expiresAt);
    // Um pedido sem prazo não é um pedido sem pressa: é um documento que não se sabe ler. Falha
    // fechada, como em todo o resto deste caminho.
    if (expiresAt === null) return null;

    return {
      id: snapshot.id,
      clientId: asText(data.clientId),
      clientName: asText(data.clientName),
      redirectUri: asText(data.redirectUri),
      state: typeof data.state === 'string' ? data.state : null,
      codeChallenge: asText(data.codeChallenge),
      scope: Array.isArray(data.scope) ? (data.scope as string[]) : [],
      resource: typeof data.resource === 'string' ? data.resource : null,
      createdAt: asDate(data.createdAt) ?? new Date(0),
      expiresAt,
      tenantId: typeof data.tenantId === 'string' ? data.tenantId : null,
      userId: typeof data.userId === 'string' ? data.userId : null,
      grantId: typeof data.grantId === 'string' ? data.grantId : null,
      codeHash: typeof data.codeHash === 'string' ? data.codeHash : null,
      usedAt: asDate(data.usedAt),
    };
  }

  async consent(requestId: string, consented: ConsentedAgentAuthRequest): Promise<boolean> {
    const reference = this.requests().doc(requestId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;

      const data = snapshot.data() ?? {};
      // Já consentido é recusa, e não uma segunda emissão: duas abas na mesma tela emitiriam dois
      // acessos, e a pessoa só se lembraria de ter autorizado um.
      if (data.codeHash !== null && data.codeHash !== undefined) return false;

      const expiresAt = asDate(data.expiresAt);
      if (expiresAt === null || expiresAt.getTime() <= Date.now()) return false;

      transaction.update(reference, {
        tenantId: consented.tenantId,
        userId: consented.userId,
        grantId: consented.grantId,
        codeHash: consented.codeHash,
        consentedAt: FieldValue.serverTimestamp(),
        expiresAt: Timestamp.fromDate(consented.expiresAt),
      });
      return true;
    });
  }

  async consume(requestId: string): Promise<boolean> {
    const reference = this.requests().doc(requestId);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      if (asDate(snapshot.data()?.usedAt) !== null) return false;

      transaction.update(reference, { usedAt: FieldValue.serverTimestamp() });
      return true;
    });
  }
}
