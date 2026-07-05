import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import type { IDeadlineRepository } from '../../domain/repositories/IDeadlineRepository';
import type { DeadlineToCreate } from '../../domain/entities/Deadline';

export class FirebaseDeadlineRepository implements IDeadlineRepository {
  constructor(private readonly db: Firestore) {}

  async createDeadline(tenantId: string, data: DeadlineToCreate): Promise<string> {
    const now = Timestamp.now();
    const ref = await this.db.collection('tenants').doc(tenantId).collection('deadlines').add({
      ...data,
      dueDate: Timestamp.fromDate(data.dueDate),
      status: 'Pendente',
      createdAt: now,
      updatedAt: now,
    });
    return ref.id;
  }
}
