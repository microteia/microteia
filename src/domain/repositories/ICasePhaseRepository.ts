import type { CasePhaseConfig } from '../entities';

export interface ICasePhaseRepository {
  getAll(tenantId: string): Promise<CasePhaseConfig[]>;
  subscribe(tenantId: string, onChange: (items: CasePhaseConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, color: string | undefined, createdBy: string): Promise<CasePhaseConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
