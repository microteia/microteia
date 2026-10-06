import { AGENT_MCP_FUNCTION } from '../../domain/schema/agent/agentBackend';
import { hostingOrigin, httpFunctionEndpoint } from '../../domain/schema/agent/agentOAuth';

export const AGENT_REGION = 'southamerica-east1';

/**
 * O projeto em que esta function está rodando.
 *
 * Vem do ambiente e nunca de configuração nossa: o mesmo artefato roda no projeto de cada escritório,
 * e um projeto escrito à mão apontaria todos eles para o nosso. É a regra que `bundleAudit` já cobra
 * do lado do bundle, aplicada ao backend.
 */
const projectId = (): string => process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? '';

/**
 * O emissor do servidor de autorização — a origem do Hosting do escritório.
 *
 * É o Hosting e não o host das functions porque é ele que serve a tela de consentimento, e um
 * emissor tem de ser a origem em que o cliente realmente conversa. O `.web.app` é o domínio que o
 * Console imprime ao fim de todo deploy; domínio próprio não é oferecido pela instalação hoje, e no
 * dia em que for, este é o ponto único que muda.
 */
export const installationIssuer = (): string => hostingOrigin(projectId());

/**
 * A URL que o escritório anuncia como endpoint MCP — a mesma que a tela manda copiar.
 *
 * Tem de ser idêntica à que a pessoa digitou no cliente: é o valor do campo `resource` dos metadados,
 * e a comparação que o cliente faz com ele é literal. Por isso ela sai da mesma fórmula que o front
 * usa, e não de uma segunda montagem.
 */
export const mcpResourceUrl = (): string =>
  httpFunctionEndpoint(AGENT_REGION, projectId(), AGENT_MCP_FUNCTION);
