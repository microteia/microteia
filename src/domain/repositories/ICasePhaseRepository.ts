import type { CasePhaseConfig } from '../entities';

export interface ICasePhaseRepository {
  getAll(tenantId: string): Promise<CasePhaseConfig[]>;
  create(tenantId: string, key: string, label: string, color: string | undefined, createdBy: string): Promise<CasePhaseConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
