import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IReportDraftRepository, ReportDraftResult } from '../../domain/repositories/IReportDraftRepository';

export class FirebaseReportDraftRepository implements IReportDraftRepository {
  private readonly call = httpsCallable<{ tenantId: string; description: string }, ReportDraftResult>(functions, 'draftReport');

  async draftReport(tenantId: string, description: string): Promise<ReportDraftResult> {
    const { data } = await this.call({ tenantId, description });
    return data;
  }
}
