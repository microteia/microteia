import type { CaseJudgeConfig } from '../entities';

export interface ICaseJudgeRepository {
  getAll(tenantId: string): Promise<CaseJudgeConfig[]>;
  subscribe(tenantId: string, onChange: (items: CaseJudgeConfig[]) => void): () => void;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseJudgeConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
