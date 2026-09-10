import { Timestamp, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../infrastructure/firebase/config';
import type { AgentGrant } from '../../domain/schema/agent/agentGrant';
import { AGENT_GRANTS_COLLECTION } from '../../domain/schema/agent/agentGrant';
import {
  AGENT_CREATE_GRANT_FUNCTION,
  AGENT_REVOKE_GRANT_FUNCTION,
} from '../../domain/schema/agent/agentBackend';
import type {
  AgentGrantInput,
  IAgentGrantRepository,
  IssuedAgentGrant,
} from '../../domain/repositories/IAgentGrantRepository';

const grantsRef = (tenantId: string) => collection(db, 'tenants', tenantId, AGENT_GRANTS_COLLECTION);

const asDate = (value: unknown): Date | null =>
  value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;

const mapGrant = (id: string, tenantId: string, data: Record<string, unknown>): AgentGrant => ({
  id,
  tenantId,
  userId: typeof data.userId === 'string' ? data.userId : '',
  name: typeof data.name === 'string' ? data.name : '',
  permissions: Array.isArray(data.permissions) ? (data.permissions as string[]) : [],
  // O hash NÃO é segredo — o segredo é o que o gera. Mas ele também não serve à tela para nada, e
  // por isso não desce: o que não é usado não precisa atravessar a rede.
  secretHash: '',
  expiresAt: asDate(data.expiresAt),
  revokedAt: asDate(data.revokedAt),
  lastUsedAt: asDate(data.lastUsedAt),
  createdAt: asDate(data.createdAt) ?? new Date(),
  createdBy: typeof data.createdBy === 'string' ? data.createdBy : '',
});

export class FirebaseAgentGrantRepository implements IAgentGrantRepository {
  subscribe(
    tenantId: string,
    onUpdate: (grants: AgentGrant[]) => void,
    onError?: (error: Error) => void,
  ): () => void {
    // `orderBy` no servidor sobre um campo único: servido pelo índice que toda coleção ganha de
    // graça, sem índice composto a declarar. Sem `limit` porque a coleção é limitada por natureza —
    // são os acessos que as pessoas de um escritório emitiram, não dado de negócio.
    return onSnapshot(
      query(grantsRef(tenantId), orderBy('createdAt', 'desc')),
      (snapshot) => onUpdate(snapshot.docs.map((one) => mapGrant(one.id, tenantId, one.data()))),
      (error) => onError?.(error),
    );
  }

  async issue(tenantId: string, input: AgentGrantInput): Promise<IssuedAgentGrant> {
    const call = httpsCallable<
      { tenantId: string } & AgentGrantInput,
      IssuedAgentGrant
    >(functions, AGENT_CREATE_GRANT_FUNCTION);
    return (await call({ tenantId, ...input })).data;
  }

  async revoke(tenantId: string, grantId: string): Promise<boolean> {
    const call = httpsCallable<{ tenantId: string; grantId: string }, { revoked: boolean }>(
      functions,
      AGENT_REVOKE_GRANT_FUNCTION,
    );
    return (await call({ tenantId, grantId })).data.revoked;
  }
}
