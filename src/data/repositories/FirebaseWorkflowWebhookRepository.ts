import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IssuedWorkflowWebhook, IWorkflowWebhookRepository } from '../../domain/repositories/IWorkflowWebhookRepository';

type ManageRequest = { tenantId: string; workflowId: string; action: 'issue' | 'revoke' };
type ManageResponse = { token: string | null; url: string | null; hint: string | null };

export class FirebaseWorkflowWebhookRepository implements IWorkflowWebhookRepository {
  private readonly call = httpsCallable<ManageRequest, ManageResponse>(functions, 'manageWorkflowWebhook');

  async issue(tenantId: string, workflowId: string): Promise<IssuedWorkflowWebhook> {
    const { data } = await this.call({ tenantId, workflowId, action: 'issue' });
    return { token: data.token ?? '', url: data.url };
  }

  async revoke(tenantId: string, workflowId: string): Promise<void> {
    await this.call({ tenantId, workflowId, action: 'revoke' });
  }
}
