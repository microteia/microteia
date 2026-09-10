import { onRequest } from 'firebase-functions/v2/https';
import type { MessageCatalog } from '../../domain/schema/i18n/messages';
import type { AgentResourceUri } from '../../domain/schema/agent/agentOps';
import { AGENT_RESOURCES, AGENT_TOOLS, agentToolByName } from '../../domain/schema/agent/agentOps';
import { getDI } from '../di/container';
import type { AgentAuthRefusal, AgentSession } from '../agent/authenticateAgent';
import { agentAuthDeps, authenticateAgent } from '../agent/authenticateAgent';
import { agentCatalog } from '../agent/agentMessages';
import { agentLocale } from '../agent/agentLocale';
import { runAgentOperation } from '../agent/runAgentOperation';
import { officeInfo, officeReports, officeWorkflows } from '../agent/agentResources';
import { officeScreens } from '../agent/describeScreen';
import type { JsonRpcRequest } from '../agent/mcpProtocol';
import {
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_INVALID_REQUEST,
  JSON_RPC_METHOD_NOT_FOUND,
  MCP_PROTOCOL_VERSION,
  initializeResult,
  resourceContent,
  resourcesListResult,
  rpcError,
  rpcResult,
  toolContent,
  toolFailure,
  toolsListResult,
} from '../agent/mcpProtocol';

const REGION = 'southamerica-east1';

/**
 * De quanto em quanto tempo o uso de um acesso é carimbado.
 *
 * Um agente conversando faz dezenas de chamadas por minuto, e uma escrita por chamada seria o custo
 * dominante do gateway — para uma informação cuja utilidade é "foi usado hoje?". Cinco minutos
 * respondem essa pergunta pelo preço de nenhuma.
 */
const TOUCH_INTERVAL_MS = 5 * 60_000;

/**
 * O que cada recusa de autenticação diz a quem apresentou o token.
 *
 * Expirado e revogado são DITOS porque são acionáveis e quem os recebe é o dono legítimo do acesso —
 * um pede outro token, o outro pede falar com quem revogou. `unknown` continua ambíguo de propósito:
 * ele cobre "não existe" e "segredo errado" com a mesma frase.
 */
const REFUSAL_MESSAGE: Readonly<Record<AgentAuthRefusal, string>> = {
  malformed: 'Missing or malformed access token. Send it as "Authorization: Bearer mt_...".',
  inactive: 'AI agent access is not enabled for this organization.',
  unknown: 'This access token is not valid.',
  revoked: 'This access has been revoked.',
  expired: 'This access has expired.',
  'no-access':
    'This access no longer grants anything: the person who issued it no longer holds any of the '
    + 'permissions it declares.',
};

const bearer = (header: unknown): string => {
  const value = typeof header === 'string' ? header : '';
  return value.toLowerCase().startsWith('bearer ') ? value.slice(7).trim() : '';
};

const isResourceUri = (value: string): value is AgentResourceUri =>
  AGENT_RESOURCES.some((resource) => resource.uri === value);

const readResource = async (
  uri: AgentResourceUri,
  session: AgentSession,
  catalog: MessageCatalog,
): Promise<unknown> => {
  switch (uri) {
    case 'microteia://office/info': {
      const tenant = await getDI().getTenantRepository().getById(session.tenantId);
      return officeInfo(session, tenant?.name ?? session.tenantId);
    }
    case 'microteia://office/screens': {
      const schema = await getDI().getScreenDefinitionCache().getSchemaContext(session.tenantId);
      return officeScreens(schema, catalog, session);
    }
    case 'microteia://office/reports':
      return officeReports(session, catalog);
    case 'microteia://office/workflows':
      return officeWorkflows(session, catalog);
  }
};

/**
 * O acesso de um agente de IA ao escritório, falado em MCP sobre HTTP.
 *
 * **É o primeiro `onRequest` do produto, e a razão é o alcance:** um endpoint HTTP é o que um cliente
 * de IA sabe consumir sem nada instalado. As dezesseis callables existentes falam o protocolo do
 * Firebase, que nenhum deles conhece.
 *
 * `cli/src/console/functionGate.ts` lista `onRequest` entre os construtores que exigem
 * `forEachInstalledOffice`, porque o evento de um `onRequest` não carrega `{tenantId}` no caminho e
 * uma function assim agiria sobre o projeto inteiro. Aqui há uma TERCEIRA saída, e é ela que torna a
 * recusa daquele portão inaplicável a este caso: **o escritório vem do token**, e
 * `authenticateAgent` confere explicitamente que alguma extensão instalada e ativa reivindica esta
 * function antes de qualquer outra coisa. Não é ausência de portão — é o portão feito pela pergunta
 * inversa, que é a única que um `onRequest` pode fazer.
 *
 * Sem sessão de propósito: cada requisição se autentica sozinha e nada é guardado entre elas. A spec
 * permite responder `application/json` em vez de abrir um fluxo SSE, e um servidor sem estado é o que
 * sobrevive a uma instância de Cloud Function que morre entre duas chamadas.
 */
export const agentMcp = onRequest(
  { region: REGION, cors: true },
  async (request, response): Promise<void> => {
    // Só POST. A spec prevê um GET que abre um fluxo de mensagens iniciadas pelo servidor, e este
    // servidor não inicia nenhuma — dizer 405 é mais honesto que abrir um fluxo que nunca fala.
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Use POST with a JSON-RPC body.' });
      return;
    }

    const auth = await authenticateAgent(bearer(request.headers.authorization), agentAuthDeps());
    if (!auth.ok) {
      // 401, e não um erro de JSON-RPC: é o código que faz um cliente MCP saber que precisa de
      // credencial, em vez de tratar a resposta como uma falha da chamada.
      response.status(401).json({ error: REFUSAL_MESSAGE[auth.refusal], reason: auth.refusal });
      return;
    }

    const { session } = auth;

    // Um LOTE do JSON-RPC é um array, e este servidor não o atende. A recusa é explícita porque o
    // erro genérico seria "falta o método" — que manda procurar no lugar errado, e num transporte de
    // MCP significa uma conexão que simplesmente não abre, sem pista nenhuma para quem a configurou.
    if (Array.isArray(request.body)) {
      response.json(rpcError(
        null,
        JSON_RPC_INVALID_REQUEST,
        'This server does not accept batched JSON-RPC requests. Send one request per POST.',
      ));
      return;
    }

    const body = (typeof request.body === 'object' && request.body !== null ? request.body : {}) as JsonRpcRequest;
    const { id, method } = body;

    // Notificação não se responde — e responder uma faz um cliente estrito abortar a sessão.
    if (typeof method === 'string' && method.startsWith('notifications/')) {
      response.status(202).end();
      return;
    }

    if (typeof method !== 'string') {
      response.json(rpcError(id ?? null, JSON_RPC_INVALID_REQUEST, 'Missing "method".'));
      return;
    }

    if (method === 'initialize') {
      response.json(rpcResult(id, initializeResult()));
      return;
    }
    if (method === 'ping') {
      response.json(rpcResult(id, {}));
      return;
    }
    if (method === 'tools/list') {
      response.json(rpcResult(id, toolsListResult()));
      return;
    }
    if (method === 'resources/list') {
      response.json(rpcResult(id, resourcesListResult()));
      return;
    }

    if (method !== 'tools/call' && method !== 'resources/read') {
      response.json(rpcError(id, JSON_RPC_METHOD_NOT_FOUND, `Unknown method "${method}".`));
      return;
    }

    const catalog = agentCatalog(
      await getDI().getInstalledExtensionCache().messageBundles(session.tenantId),
      await agentLocale(session.tenantId, session.userId),
    );

    if (method === 'resources/read') {
      const uri = typeof body.params?.uri === 'string' ? body.params.uri : '';
      if (!isResourceUri(uri)) {
        response.json(rpcError(id, JSON_RPC_INVALID_PARAMS, `Unknown resource "${uri}".`));
        return;
      }
      response.json(rpcResult(id, resourceContent(uri, await readResource(uri, session, catalog))));
      await touch(session);
      return;
    }

    const name = typeof body.params?.name === 'string' ? body.params.name : '';
    // Nome desconhecido é recusa de PROTOCOLO, não de permissão — e a resposta NOMEIA as que
    // existem: um modelo que errou o nome acerta na chamada seguinte se souber os certos, e um
    // "ação não encontrada" o mandaria procurar uma ação de registro que não é o que ele pediu.
    if (agentToolByName(name) === null) {
      response.json(rpcError(
        id,
        JSON_RPC_INVALID_PARAMS,
        `Unknown tool "${name}". This server has: ${AGENT_TOOLS.map((tool) => tool.name).join(', ')}.`,
      ));
      return;
    }

    const input = (typeof body.params?.arguments === 'object' && body.params.arguments !== null
      ? body.params.arguments
      : {}) as Record<string, unknown>;

    const outcome = await runAgentOperation(name, input, session, catalog);
    response.json(rpcResult(id, outcome.ok ? toolContent(outcome.value) : toolFailure(outcome.error)));
    await touch(session);
  },
);

const touch = async (session: AgentSession): Promise<void> => {
  const last = session.lastUsedAt?.getTime() ?? 0;
  if (Date.now() - last < TOUCH_INTERVAL_MS) return;
  try {
    await getDI().getAgentGrantRepository().touchLastUsed(session.tenantId, session.grantId);
  } catch (error) {
    // O carimbo é informação, não autorização: falhar aqui não pode desfazer uma resposta já enviada.
    console.error('[agentMcp] Falha ao carimbar o uso do acesso:', error);
  }
};

export { MCP_PROTOCOL_VERSION };
