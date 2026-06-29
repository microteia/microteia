import type { CaseJudgeConfig } from '../entities';

export interface ICaseJudgeRepository {
  getAll(tenantId: string): Promise<CaseJudgeConfig[]>;
  create(tenantId: string, key: string, label: string, createdBy: string): Promise<CaseJudgeConfig>;
  delete(tenantId: string, key: string): Promise<void>;
}
