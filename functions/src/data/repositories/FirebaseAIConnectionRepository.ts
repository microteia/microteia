import type { Firestore } from 'firebase-admin/firestore';
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

    const data = connectionsSnap.docs[0].data();
    return {
      provider: data.provider as Provider,
      apiKey: data.apiKey as string,
      model: data.model as string,
      temperature: (data.temperature as number) ?? 0.7,
      maxTokens: (data.maxTokens as number) ?? 2048,
    };
  }
}
