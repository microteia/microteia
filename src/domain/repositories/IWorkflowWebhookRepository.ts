import type { WebhookScheme } from '../schema/workflowWebhook';

export interface IssuedWorkflowWebhook {
  /** O token — ou o segredo da assinatura —, visível SÓ nesta resposta. */
  token: string;
  scheme: WebhookScheme;
  /** Na assinatura: o cabeçalho em que quem chama a manda. */
  header: string | null;
  /** O endereço que o sistema de fora chama. Ausente quando o servidor não sabe o projeto. */
  url: string | null;
}

export interface IWorkflowWebhookRepository {
  /** Emite um token novo para a automação — o anterior deixa de valer. */
  issue(
    tenantId: string,
    workflowId: string,
    options?: { scheme: WebhookScheme; header?: string },
  ): Promise<IssuedWorkflowWebhook>;
  /** Revoga o token: a URL passa a responder 401. */
  revoke(tenantId: string, workflowId: string): Promise<void>;
}
