import type { Deadline, DeadlineStatus } from '../entities';

export interface IDeadlineRepository {
  getDeadlines(tenantId: string): Promise<Deadline[]>;
  getDeadlinesByCase(tenantId: string, caseId: string): Promise<Deadline[]>;
  getDeadlineById(tenantId: string, deadlineId: string): Promise<Deadline | null>;
  createDeadline(tenantId: string, data: Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>): Promise<Deadline>;
  updateDeadline(tenantId: string, deadlineId: string, data: Partial<Omit<Deadline, 'id' | 'tenantId' | 'createdAt' | 'createdBy'>>): Promise<void>;
  updateDeadlineStatus(tenantId: string, deadlineId: string, status: DeadlineStatus, completedBy?: string): Promise<void>;
  deleteDeadline(tenantId: string, deadlineId: string): Promise<void>;
}
