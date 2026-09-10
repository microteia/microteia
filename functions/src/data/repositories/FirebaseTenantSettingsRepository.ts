import { getFirestore } from 'firebase-admin/firestore';
import type { ITenantSettingsRepository } from '../../domain/repositories/ITenantSettingsRepository';
import { settingsValuesOf } from '../../domain/services/tenantSettings';

export class FirebaseTenantSettingsRepository implements ITenantSettingsRepository {
  private readonly db = getFirestore();

  async getTenantValues(tenantId: string): Promise<Record<string, unknown>> {
    return this.read(tenantId, 'tenant');
  }

  async getUserValues(tenantId: string, userId: string): Promise<Record<string, unknown>> {
    return this.read(tenantId, `user_${userId}`);
  }

  // O uid vai no NOME do documento, e não em subcoleção, para que a regra do Firestore decida a
  // escrita só pelo caminho, sem ler o documento.
  private async read(tenantId: string, documentId: string): Promise<Record<string, unknown>> {
    try {
      const doc = await this.db
        .collection('tenants')
        .doc(tenantId)
        .collection('settings')
        .doc(documentId)
        .get();

      return settingsValuesOf(doc.data());
    } catch (error) {
      console.error(`Erro ao ler configurações ${documentId} do escritório ${tenantId}:`, error);
      return {};
    }
  }
}
