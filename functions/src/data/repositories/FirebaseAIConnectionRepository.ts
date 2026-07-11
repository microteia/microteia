import type { DocumentData, Firestore } from 'firebase-admin/firestore';
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

    return this.toCredentials(connectionsSnap.docs[0].data());
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

    return this.toCredentials(snap.data() ?? {});
  }

  private toCredentials(data: DocumentData): AICredentials {
    return {
      provider: data.provider as Provider,
      apiKey: data.apiKey as string,
      model: data.model as string,
      temperature: (data.temperature as number) ?? 0.7,
      maxTokens: (data.maxTokens as number) ?? 2048,
    };
  }

  async getAllCredentials(tenantId: string): Promise<AICredentials[]> {
    const connectionsSnap = await this.db
      .collection('tenants')
      .doc(tenantId)
      .collection('aiConnections')
      .get();

    if (connectionsSnap.empty) {
      return [];
    }

    const defaultCreds: AICredentials[] = [];
    const otherCreds: AICredentials[] = [];

    // Separar default das outras
    for (const doc of connectionsSnap.docs) {
      const data = doc.data();
      const cred: AICredentials = {
        provider: data.provider as Provider,
        apiKey: data.apiKey as string,
        model: data.model as string,
        temperature: (data.temperature as number) ?? 0.7,
        maxTokens: (data.maxTokens as number) ?? 2048,
      };

      if (data.isDefault === true) {
        defaultCreds.push(cred);
      } else {
        otherCreds.push(cred);
      }
    }

    // Retornar com default primeiro
    return [...defaultCreds, ...otherCreds];
  }
}
