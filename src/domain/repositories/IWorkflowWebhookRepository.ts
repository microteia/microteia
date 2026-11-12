export interface IssuedWorkflowWebhook {
  /** O token, visível SÓ nesta resposta: o servidor guarda o hash. */
  token: string;
  /** O endereço que o sistema de fora chama. Ausente quando o servidor não sabe o projeto. */
  url: string | null;
}

export interface IWorkflowWebhookRepository {
  /** Emite um token novo para a automação — o anterior deixa de valer. */
  issue(tenantId: string, workflowId: string): Promise<IssuedWorkflowWebhook>;
  /** Revoga o token: a URL passa a responder 401. */
  revoke(tenantId: string, workflowId: string): Promise<void>;
}
