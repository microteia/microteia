import type { DocumentData, DocumentSnapshot, Firestore } from 'firebase-admin/firestore';
import type { IAIConnectionRepository } from '../../domain/repositories/IAIConnectionRepository';
import type { AICredentials } from '../../domain/entities/AICredentials';
import type { Provider } from '../../domain/entities/Provider';

export class FirebaseAIConnectionRepository implements IAIConnectionRepository {
  constructor(private readonly db: Firestore) {}

  async getDefaultCredentials(tenantId: string): Promise<AICredentials> {
    const connectionsSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('aiConnections')
      .where('isDefault', '==', true)
      .limit(1)
      .get();

    if (connectionsSnap.empty) {
      throw new Error('Nenhuma conexão IA padrão configurada para este escritório.');
    }

    const credentials = await this.toCredentials(tenantId, connectionsSnap.docs[0]);

    if (!credentials) {
      throw new Error('A chave de API da conexão IA padrão não está cadastrada.');
    }

    return credentials;
  }

  async getCredentialsById(tenantId: string, connectionId: string): Promise<AICredentials> {
    const snap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('aiConnections')
      .doc(connectionId)
      .get();

    if (!snap.exists) {
      throw new Error('Conexão de IA não encontrada para este escritório.');
    }

    const credentials = await this.toCredentials(tenantId, snap);

    if (!credentials) {
      throw new Error('A chave de API desta conexão de IA não está cadastrada.');
    }

    return credentials;
  }

  async getAllCredentials(tenantId: string): Promise<AICredentials[]> {
    const connectionsSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('aiConnections')
      .get();

    const loaded = await Promise.all(
      connectionsSnap.docs.map(async (doc) => ({
        isDefault: doc.data().isDefault === true,
        credentials: await this.toCredentials(tenantId, doc),
      })),
    );

    const usable = loaded.filter((item) => item.credentials !== null);

    return [
      ...usable.filter((item) => item.isDefault),
      ...usable.filter((item) => !item.isDefault),
    ].map((item) => item.credentials as AICredentials);
  }

  private async toCredentials(
    tenantId: string,
    connectionDoc: DocumentSnapshot<DocumentData>,
  ): Promise<AICredentials | null> {
    const data = connectionDoc.data() ?? {};
    const apiKey = await this.readApiKey(tenantId, connectionDoc.id, data);

    if (!apiKey) {
      return null;
    }

    return {
      provider: data.provider as Provider,
      apiKey,
      model: data.model as string,
      temperature: (data.temperature as number) ?? 0.7,
      maxTokens: (data.maxTokens as number) ?? 2048,
    };
  }

  private async readApiKey(
    tenantId: string,
    connectionId: string,
    data: DocumentData,
  ): Promise<string | undefined> {
    const secretSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('aiConnections')
      .doc(connectionId)
      .collection('secrets')
      .doc('current')
      .get();

    return (secretSnap.data()?.apiKey as string | undefined) ?? (data.apiKey as string | undefined);
  }
}
