import type { CaseDistrictConfig } from '../entities';

export interface ICaseDistrictRepository {
  getAll(tenantId: string): Promise<CaseDistrictConfig[]>;
  subscribe(tenantId: string, onChange: (items: CaseDistrictConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseDistrictConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
