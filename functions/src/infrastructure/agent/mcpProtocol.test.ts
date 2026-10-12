import { describe, expect, it } from 'vitest';
import {
  MCP_PROTOCOL_VERSION,
  initializeResult,
  resourceContent,
  resourcesListResult,
  rpcError,
  rpcResult,
  toolContent,
  toolFailure,
  toolsListResult,
} from './mcpProtocol';
import { AGENT_OPERATIONS, AGENT_RESOURCES, AGENT_TOOLS } from '../../domain/schema/agent/agentOps';

/**
 * A SUPERFÍCIE, carimbada por extenso.
 *
 * É o mesmo cuidado que `mcp.test.ts` toma com o servidor de autoria, e pelo mesmo motivo: nome de
 * ferramenta e URI de recurso são contrato com quem já configurou o servidor, e renomear qualquer um
 * dos dois quebra a configuração de alguém SEM erro em lugar nenhum — a ferramenta simplesmente
 * deixa de ser encontrada. A URI é a mais frágil das duas, porque nada no cliente a valida.
 */
describe('a superfície publicada', () => {
  it('publica exatamente estas quinze ferramentas, nesta ordem', () => {
    expect(AGENT_TOOLS.map((tool) => tool.name)).toEqual([
      'list_screens',
      'describe_screen',
      'search_records',
      'get_record',
      'create_record',
      'update_record',
      'delete_record',
      'list_documents',
      'attach_document',
      'run_report',
      'describe_workflow',
      'run_workflow',
      'get_workflow_run',
      'run_action',
      'search_audit_log',
    ]);
  });

  it('publica exatamente estas quatro URIs', () => {
    expect(AGENT_RESOURCES.map((resource) => resource.uri)).toEqual([
      'microteia://office/info',
      'microteia://office/screens',
      'microteia://office/reports',
      'microteia://office/workflows',
    ]);
  });

  it('a lista de operações e a de ferramentas são a mesma', () => {
    expect([...AGENT_OPERATIONS].sort()).toEqual(AGENT_TOOLS.map((tool) => tool.name).sort());
  });

  // A coleção é ARGUMENTO, e é a propriedade inteira do desenho: é o que faz a superfície valer para
  // qualquer extensão instalada sem o kernel conhecer nenhuma. Ela se perderia na primeira
  // `search_clientes` acrescentada "só para facilitar" — e a lista fechada acima é o que a barra.
  it('toda ferramenta cobrada por coleção recebe a coleção como argumento', () => {
    for (const tool of AGENT_TOOLS.filter((one) => one.permission.kind === 'collection')) {
      const properties = (tool.inputSchema.properties ?? {}) as Record<string, unknown>;
      expect(Object.keys(properties), tool.name).toContain('collection');
      expect((tool.inputSchema.required ?? []) as string[], tool.name).toContain('collection');
    }
  });

  // A regra original era "toda ferramenta recebe argumento — nenhuma é documento disfarçado", e ela
  // pressupunha um cliente que busca recurso sozinho. Onde o cliente não busca, o recurso é material
  // que a PESSOA anexa: o modelo nunca lê o mapa rótulo→coleção, e o escritório só responde a quem
  // digita o nome técnico. `list_screens` é a exceção NOMEADA, não uma brecha — é o ponto de entrada
  // sem o qual nenhuma das outras é alcançável, e é por isso que ela é a única que pode não receber
  // nada. Uma segunda sem argumento é documento disfarçado, e este teste a reprova.
  it('só o ponto de entrada não recebe argumento; toda outra ferramenta recebe', () => {
    for (const tool of AGENT_TOOLS.filter((one) => one.name !== 'list_screens')) {
      const properties = (tool.inputSchema.properties ?? {}) as Record<string, unknown>;
      expect(Object.keys(properties).length, tool.name).toBeGreaterThan(0);
    }
  });

  it('toda ferramenta tem descrição que explica, não que repete o nome', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(60);
    }
  });

  // O esquema é o que o modelo lê para montar a chamada. Um `required` apontando para propriedade
  // que não existe faz um cliente estrito recusar a ferramenta inteira.
  it('todo obrigatório de um esquema existe entre as propriedades dele', () => {
    for (const tool of AGENT_TOOLS) {
      const properties = Object.keys((tool.inputSchema.properties ?? {}) as Record<string, unknown>);
      for (const required of (tool.inputSchema.required ?? []) as string[]) {
        expect(properties, `${tool.name}.${required}`).toContain(required);
      }
    }
  });

  // `run_workflow` conta como escrita mesmo publicando um evento: o que ele dispara grava. Contá-lo
  // como leitura faria um acesso somente-leitura poder mudar dado por via indireta.
  it('as que gravam são exatamente estas seis', () => {
    expect(AGENT_TOOLS.filter((tool) => tool.writes).map((tool) => tool.name)).toEqual([
      'create_record',
      'update_record',
      'delete_record',
      'attach_document',
      'run_workflow',
      'run_action',
    ]);
  });
});

describe('o protocolo', () => {
  // `2025-03-26` e não a do servidor de autoria (`2024-11-05`): é a revisão que introduziu o
  // transporte HTTP, e é o transporte que difere entre os dois.
  it('declara a revisão que tem transporte HTTP', () => {
    expect(MCP_PROTOCOL_VERSION).toBe('2025-03-26');
    expect(initializeResult().protocolVersion).toBe(MCP_PROTOCOL_VERSION);
  });

  it('anuncia só as capacidades que serve', () => {
    expect(initializeResult().capabilities).toEqual({ tools: {}, resources: {} });
  });

  it('a listagem entrega nome, descrição e esquema de cada ferramenta', () => {
    const { tools } = toolsListResult() as { tools: { name: string; inputSchema: unknown }[] };
    expect(tools).toHaveLength(AGENT_TOOLS.length);
    for (const tool of tools) expect(tool.inputSchema).toBeDefined();
  });

  it('a listagem de recursos declara o tipo do conteúdo', () => {
    const { resources } = resourcesListResult() as { resources: { mimeType: string }[] };
    for (const resource of resources) expect(resource.mimeType).toBe('application/json');
  });

  it('envelopa resultado e erro no formato do JSON-RPC', () => {
    expect(rpcResult(7, { a: 1 })).toEqual({ jsonrpc: '2.0', id: 7, result: { a: 1 } });
    expect(rpcError(7, -32601, 'x')).toEqual({ jsonrpc: '2.0', id: 7, error: { code: -32601, message: 'x' } });
  });

  it('a resposta de uma ferramenta é TEXTO — um modelo lê texto, não objeto', () => {
    const content = toolContent({ count: 2 }) as { content: { type: string; text: string }[] };
    expect(content.content[0].type).toBe('text');
    expect(JSON.parse(content.content[0].text)).toEqual({ count: 2 });
  });

  /**
   * A falha volta como CONTEÚDO com `isError`, e não como erro de protocolo.
   *
   * É o que permite ao modelo LER o motivo e corrigir na chamada seguinte, em vez de a chamada só
   * falhar sem explicação. Mesma decisão do servidor de autoria, e o mesmo motivo.
   */
  it('a falha de uma ferramenta é conteúdo legível, não erro de protocolo', () => {
    const failure = toolFailure({ text: 'CPF inválido', ref: '@core.records/field.invalid-format' });
    expect(failure.isError).toBe(true);
    const content = failure.content as { text: string }[];
    expect(JSON.parse(content[0].text).text).toBe('CPF inválido');
  });

  it('o conteúdo de um recurso carrega a URI que o originou', () => {
    const read = resourceContent('microteia://office/info', { office: 'Acme' });
    const contents = read.contents as { uri: string; text: string }[];
    expect(contents[0].uri).toBe('microteia://office/info');
    expect(JSON.parse(contents[0].text)).toEqual({ office: 'Acme' });
  });
});
