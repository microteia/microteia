// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowWebhook.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowWebhook.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowParameter } from '../entities/Workflow';

/** O gatilho de uma automação que um sistema DE FORA dispara por HTTP. */
export const WORKFLOW_WEBHOOK_EVENT = 'webhook.received';

export const WORKFLOW_WEBHOOK_SINCE_KERNEL = '2.116.0';

/**
 * Onde mora o HASH do token de cada automação com webhook: `tenants/{t}/workflow_webhooks/{workflowId}`.
 * Fora da definição de propósito — a definição é lida por todo membro, e nem o hash de uma credencial
 * precisa estar onde qualquer um lê.
 */
export const WORKFLOW_WEBHOOKS_COLLECTION = 'workflow_webhooks';

/**
 * O teto do corpo. O payload vira o evento, e o evento é um documento: um corpo grande estouraria a
 * gravação depois de aceito, e quem enviou receberia 202 de uma chamada que nunca roda.
 */
export const WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

/**
 * Como quem chama prova que pode: com o TOKEN no cabeçalho (`Authorization: Bearer`), ou ASSINANDO o
 * corpo com HMAC-SHA256 e um segredo combinado — o molde de GitHub, Shopify e Stripe. A assinatura é o que
 * deixa receber de um sistema que não manda cabeçalho de autorização nenhum, mas assina o que envia.
 */
export const WEBHOOK_SCHEMES = ['token', 'hmac'] as const;
export type WebhookScheme = typeof WEBHOOK_SCHEMES[number];

/** O cabeçalho da assinatura quando quem configura não escolhe outro. */
export const WEBHOOK_DEFAULT_SIGNATURE_HEADER = 'x-signature-256';

/** Nome de cabeçalho HTTP aceitável: letras, dígitos e hífen. É ele que o servidor procura na chamada. */
export const isWebhookHeaderName = (value: string): boolean => /^[A-Za-z0-9-]{1,64}$/.test(value);

/**
 * Os parâmetros OBRIGATÓRIOS que o corpo não trouxe. Só o primeiro nível: o corpo é DADO de fora, e
 * conferir o que a automação declarou é o que dá a quem chama um 422 com o nome do que faltou, em vez
 * de uma execução que falha três passos depois.
 */
export const missingWebhookParameters = (
  parameters: readonly WorkflowParameter[] | undefined,
  body: Record<string, unknown>,
): string[] =>
  (parameters ?? [])
    .filter((parameter) => parameter.required === true)
    .filter((parameter) => body[parameter.key] === undefined || body[parameter.key] === null || body[parameter.key] === '')
    .map((parameter) => parameter.key);
