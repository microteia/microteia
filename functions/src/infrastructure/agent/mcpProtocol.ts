import { AGENT_RESOURCES, AGENT_TOOLS } from '../../domain/schema/agent/agentOps';
import { KERNEL_VERSION } from '../../domain/schema/plugin/kernelVersion';

/**
 * A revisão do MCP que este servidor fala.
 *
 * `2025-03-26` e não a que o MCP de AUTORIA declara (`2024-11-05`) porque é ela que introduziu o
 * transporte HTTP — e é o transporte, não a superfície, que difere entre os dois servidores.
 */
export const MCP_PROTOCOL_VERSION = '2025-03-26';

export const MCP_SERVER_NAME = 'microteia-office';

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: unknown;
  method?: string;
  params?: Record<string, unknown>;
}

export const JSON_RPC_PARSE_ERROR = -32700;
export const JSON_RPC_INVALID_REQUEST = -32600;
export const JSON_RPC_METHOD_NOT_FOUND = -32601;
export const JSON_RPC_INVALID_PARAMS = -32602;

export const rpcResult = (id: unknown, result: unknown): Record<string, unknown> =>
  ({ jsonrpc: '2.0', id, result });

export const rpcError = (id: unknown, code: number, message: string): Record<string, unknown> =>
  ({ jsonrpc: '2.0', id, error: { code, message } });

export const initializeResult = (): Record<string, unknown> => ({
  protocolVersion: MCP_PROTOCOL_VERSION,
  capabilities: { tools: {}, resources: {} },
  serverInfo: { name: MCP_SERVER_NAME, version: KERNEL_VERSION },
});

export const toolsListResult = (): Record<string, unknown> => ({
  tools: AGENT_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  })),
});

export const resourcesListResult = (): Record<string, unknown> => ({
  resources: AGENT_RESOURCES.map((resource) => ({
    uri: resource.uri,
    name: resource.name,
    description: resource.description,
    mimeType: 'application/json',
  })),
});

/**
 * O conteúdo de uma ferramenta, sempre como TEXTO.
 *
 * Um modelo lê texto, não objeto — a mesma decisão do MCP de autoria. O JSON vai indentado porque a
 * diferença de custo é pequena e a de legibilidade não é.
 */
export const toolContent = (value: unknown): Record<string, unknown> => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
});

/**
 * A falha de uma ferramenta volta como CONTEÚDO, com `isError`, e não como erro de protocolo.
 *
 * É o que permite ao modelo LER o motivo e corrigir na chamada seguinte, em vez de a chamada só
 * falhar. A mesma decisão — e o mesmo motivo — do MCP de autoria.
 */
export const toolFailure = (value: unknown): Record<string, unknown> => ({
  content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
  isError: true,
});

export const resourceContent = (uri: string, value: unknown): Record<string, unknown> => ({
  contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }],
});
