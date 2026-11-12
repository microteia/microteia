import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IReportDraftRepository, ReportDraftAvailability, ReportDraftResult } from '../../domain/repositories/IReportDraftRepository';

export class FirebaseReportDraftRepository implements IReportDraftRepository {
  private readonly call = httpsCallable<{ tenantId: string; description: string }, ReportDraftResult>(functions, 'draftReport');
  private readonly probe = httpsCallable<{ tenantId: string; probe: true }, ReportDraftAvailability>(functions, 'draftReport');

  async draftReport(tenantId: string, description: string): Promise<ReportDraftResult> {
    const { data } = await this.call({ tenantId, description });
    return data;
  }

  async availability(tenantId: string): Promise<ReportDraftAvailability> {
    const { data } = await this.probe({ tenantId, probe: true });
    return data;
  }
}
