import { getFirestore } from 'firebase-admin/firestore';
import type { ITenantRepository } from '../../domain/repositories/ITenantRepository';
import type { Tenant } from '../../domain/entities/Tenant';

export class FirebaseTenantRepository implements ITenantRepository {
  private readonly db = getFirestore();

  async getById(tenantId: string): Promise<Tenant | null> {
    try {
      const doc = await this.db.collection('tenants').doc(tenantId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      return {
        id: doc.id,
        name: data.name,
        ownerId: data.ownerId,
        cnpj: data.cnpj ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        logoURL: data.logoURL ?? null,
        allowedSenders: data.allowedSenders ?? [],
        allowedSubjects: data.allowedSubjects ?? [],
        createdAt: data.createdAt?.toDate() ?? new Date(),
        updatedAt: data.updatedAt?.toDate() ?? new Date(),
      };
    } catch (error) {
      console.error(`Erro ao buscar tenant ${tenantId}:`, error);
      return null;
    }
  }
}
