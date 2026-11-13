import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IssuedWorkflowWebhook, IWorkflowWebhookRepository } from '../../domain/repositories/IWorkflowWebhookRepository';
import type { WebhookProtection, WebhookScheme } from '../../domain/schema/workflowWebhook';

type ManageRequest = { tenantId: string; workflowId: string; action: 'issue' | 'revoke' | 'configure'; scheme?: WebhookScheme; header?: string } & WebhookProtection;
type ManageResponse = { token: string | null; url: string | null; hint: string | null; scheme?: WebhookScheme; header?: string };

export class FirebaseWorkflowWebhookRepository implements IWorkflowWebhookRepository {
  private readonly call = httpsCallable<ManageRequest, ManageResponse>(functions, 'manageWorkflowWebhook');

  async issue(
    tenantId: string,
    workflowId: string,
    options?: { scheme: WebhookScheme; header?: string } & WebhookProtection,
  ): Promise<IssuedWorkflowWebhook> {
    const { data } = await this.call({ tenantId, workflowId, action: 'issue', ...(options ?? {}) });
    return { token: data.token ?? '', url: data.url, scheme: data.scheme ?? 'token', header: data.header ?? null };
  }

  async configure(tenantId: string, workflowId: string, protection: WebhookProtection): Promise<void> {
    await this.call({ tenantId, workflowId, action: 'configure', ...protection });
  }

  async revoke(tenantId: string, workflowId: string): Promise<void> {
    await this.call({ tenantId, workflowId, action: 'revoke' });
  }
}
