import { getFirestore } from 'firebase-admin/firestore';
import type { ITenantSettingsRepository } from '../../domain/repositories/ITenantSettingsRepository';
import { settingsValuesOf } from '../../domain/services/tenantSettings';

export class FirebaseTenantSettingsRepository implements ITenantSettingsRepository {
  private readonly db = getFirestore();

  async getTenantValues(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const doc = await this.db
        .collection('tenants')
        .doc(tenantId)
        .collection('settings')
        .doc('tenant')
        .get();

      return settingsValuesOf(doc.data());
    } catch (error) {
      console.error(`Erro ao ler configurações do escritório ${tenantId}:`, error);
      return {};
    }
  }
}
