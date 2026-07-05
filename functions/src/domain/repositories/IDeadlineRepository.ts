import type { DeadlineToCreate } from '../entities/Deadline';

export interface IDeadlineRepository {
  createDeadline(tenantId: string, data: DeadlineToCreate): Promise<string>;
}
