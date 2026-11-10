import { describe, it, expect } from 'vitest';
import { runWorkflow } from '../../../domain/engine/WorkflowExecutor';
import type { StepRegistry } from '../../../domain/engine/StepRegistry';
import type { StepDefinition } from '../../../domain/engine/StepDefinition';
import type { WorkflowServices } from '../../../domain/entities/WorkflowContext';
import type { Condition, InputMapping, WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../../../domain/entities/Workflow';
import type { HttpRequestSpec } from '../../../domain/schema/httpRequestSpec';
import {
  HttpClientError,
  type HttpClientFailureCode,
  type HttpClientLimits,
  type HttpIncomingResponse,
  type HttpOutgoingRequest,
  type IHttpClient,
} from '../../../domain/repositories/IHttpClient';
import { makeHttpRequestStepDefinition, type HttpPolicy } from './HttpRequestStep';
import type { IHttpCredentialRepository } from '../../../domain/repositories/IHttpCredentialRepository';
import type { HttpConnection } from '../../../domain/schema/httpConnection';
import type { HttpDispatchInput, IHttpDispatchQueue } from '../../../domain/repositories/IHttpDispatchRepository';

const NOW = new Date('2026-11-09T12:00:00Z');

/** Cliente que nunca toca a rede: guarda o que receberia e devolve o que o teste mandar. */
class FakeHttpClient implements IHttpClient {
  readonly sent: { request: HttpOutgoingRequest; limits: HttpClientLimits }[] = [];
  constructor(private readonly answer: Partial<HttpIncomingResponse> | HttpClientFailureCode) {}

  async send(request: HttpOutgoingRequest, limits: HttpClientLimits): Promise<HttpIncomingResponse> {
    this.sent.push({ request, limits });
    if (typeof this.answer === 'string') throw new HttpClientError(this.answer, 'ECONNRESET');
    return { status: 200, headers: {}, bodyText: '', durationMs: 12, ...this.answer };
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Partial<HttpIncomingResponse> => ({
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  bodyText: JSON.stringify(body),
});

const OPEN: HttpPolicy = { allowedHosts: ['api.exemplo.com'], allowedPorts: [] };

const NO_CREDENTIALS: IHttpCredentialRepository = { findByKey: async () => null };

const makeRegistry = (
  client: IHttpClient,
  seen: unknown[],
  policy: HttpPolicy = OPEN,
  credentials: IHttpCredentialRepository = NO_CREDENTIALS,
  dispatches?: IHttpDispatchQueue,
): StepRegistry => {
  const http = makeHttpRequestStepDefinition({ client, policyOf: async () => policy, credentials, ...(dispatches ? { dispatches } : {}) });
  const record: StepDefinition = {
    id: 'record',
    version: 1,
    name: 'Record',
    description: '',
    icon: 'x',
    category: 'Action',
    type: 'Action',
    configurable: true,
    inputs: [{ id: 'value', label: 'Value', required: false, type: 'String' }],
    outputDefinitions: [],
    createExecutor: () => ({
      execute: async (inputs) => {
        seen.push(inputs.value);
        return { success: true, outputs: {} };
      },
    }),
  };
  return {
    register: () => undefined,
    resolve: (id) => (id === 'http-request' ? http : id === 'record' ? record : undefined),
    list: () => [http, record],
  };
};

const lit = (value: unknown): InputMapping => ({ kind: 'Literal', value });

const callStep = (spec: Partial<HttpRequestSpec>, order = 0): WorkflowStep => ({
  id: 'call',
  stepDefinitionId: 'http-request',
  type: 'Action',
  order,
  configuration: {
    request: lit({ method: 'GET', url: lit('https://api.exemplo.com/v1/clientes'), ...spec }),
  },
  enabled: true,
});

const recordStep = (value: InputMapping, order: number, id = `rec-${order}`): WorkflowStep => ({
  id,
  stepDefinitionId: 'record',
  type: 'Action',
  order,
  configuration: { value },
  enabled: true,
});

const definition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  id: 'wf',
  tenantId: 't1',
  name: 'API',
  eventName: 'pedido.saved',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps,
  createdAt: NOW,
  updatedAt: NOW,
});

const event: WorkflowEvent = {
  id: 'ev',
  tenantId: 't1',
  name: 'pedido.saved',
  payload: { id: 'p/1', cliente: 'Ana Souza', total: 150, token: 'tk-123' },
  timestamp: NOW,
};

const servicesWith = (over: Partial<WorkflowServices> = {}): WorkflowServices => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => NOW,
  ...over,
});

const run = (
  steps: WorkflowStep[],
  client: IHttpClient,
  seen: unknown[] = [],
  options: {
    policy?: HttpPolicy;
    services?: WorkflowServices;
    credentials?: IHttpCredentialRepository;
    dispatches?: IHttpDispatchQueue;
    payload?: Record<string, unknown>;
  } = {},
) =>
  runWorkflow({
    definition: definition(steps),
    event: options.payload ? { ...event, payload: { ...event.payload, ...options.payload } } : event,
    registry: makeRegistry(client, seen, options.policy, options.credentials, options.dispatches),
    services: options.services ?? servicesWith(),
  });

const messages = (result: Awaited<ReturnType<typeof run>>) => result.logs.map((entry) => entry.message);

describe('passo http-request — montagem a partir dos mappings', () => {
  it('preenche caminho, query e cabeçalho vindos do evento, com encoding', async () => {
    const client = new FakeHttpClient(json({ ok: true }));
    const result = await run([callStep({
      url: lit('https://api.exemplo.com/v1/pedidos/{id}'),
      pathParams: [{ name: 'id', value: { kind: 'Event', path: 'id' } }],
      query: [{ name: 'cliente', value: { kind: 'Event', path: 'cliente' } }, { name: 'vazio', value: lit(null) }],
      headers: [{ name: 'X-Token', value: { kind: 'Event', path: 'token' } }],
    })], client);

    expect(result.status).toBe('SUCCESS');
    const sent = client.sent[0].request;
    expect(sent.url.toString()).toBe('https://api.exemplo.com/v1/pedidos/p%2F1?cliente=Ana+Souza');
    expect(sent.headers['x-token']).toBe('tk-123');
    expect(sent.headers.accept).toContain('application/json');
    expect(sent.body).toBeUndefined();
  });

  it('corpo JSON campo a campo aninha pelo ponto e põe o content-type', async () => {
    const client = new FakeHttpClient(json({}, 201));
    await run([callStep({
      method: 'POST',
      body: { kind: 'json', fields: [
        { name: 'cliente.nome', value: { kind: 'Event', path: 'cliente' } },
        { name: 'total', value: { kind: 'Event', path: 'total' } },
        { name: 'origem', value: lit('microteia') },
      ] },
    })], client);
    const sent = client.sent[0].request;
    expect(JSON.parse(sent.body ?? '')).toEqual({ cliente: { nome: 'Ana Souza' }, total: 150, origem: 'microteia' });
    expect(sent.headers['content-type']).toBe('application/json');
  });

  it('corpo de formulário e de texto; o content-type informado pelo autor vence', async () => {
    const form = new FakeHttpClient(json({}));
    await run([callStep({
      method: 'POST',
      body: { kind: 'form', fields: [{ name: 'q', value: lit('a b') }, { name: 'ids', value: lit([1, 2]) }] },
    })], form);
    expect(form.sent[0].request.body).toBe('q=a+b&ids=1&ids=2');
    expect(form.sent[0].request.headers['content-type']).toBe('application/x-www-form-urlencoded');

    const text = new FakeHttpClient(json({}));
    await run([callStep({
      method: 'PUT',
      headers: [{ name: 'Content-Type', value: lit('application/xml; charset=utf-8') }],
      body: { kind: 'text', contentType: 'application/xml', value: lit('<a/>') },
    })], text);
    expect(text.sent[0].request.body).toBe('<a/>');
    expect(text.sent[0].request.headers['content-type']).toBe('application/xml; charset=utf-8');
  });

  it('a falha de uma expressão diz qual campo falhou, e nada sai pela rede', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({
      query: [{ name: 'quebrado', value: { kind: 'Expression', expression: 'naoExiste(' } }],
    })], client);
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.value-failed');
    expect(client.sent).toHaveLength(0);
  });

  it('valor de cabeçalho com quebra de linha é recusado — injeção de cabeçalho', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({ headers: [{ name: 'X-A', value: lit('a\r\nX-Evil: 1') }] })], client);
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.header-value-invalid');
    expect(client.sent).toHaveLength(0);
  });
});

describe('passo http-request — o retorno usado no próximo passo', () => {
  it('a resposta JSON vira `body`, e o passo seguinte lê um caminho dela', async () => {
    const client = new FakeHttpClient(json({ cliente: { nome: 'Ana' }, itens: [{ sku: 'A1' }] }, 200, { 'set-cookie': 's=1', 'x-req': 'r1' }));
    const seen: unknown[] = [];
    const result = await run([
      callStep({}, 0),
      recordStep({ kind: 'Output', stepId: 'call', outputId: 'body.cliente.nome' }, 1),
      recordStep({ kind: 'Output', stepId: 'call', outputId: 'status' }, 2),
      recordStep({ kind: 'Output', stepId: 'call', outputId: 'headers' }, 3),
    ], client, seen);

    expect(result.status).toBe('SUCCESS');
    expect(seen[0]).toBe('Ana');
    expect(seen[1]).toBe(200);
    // Cookie de sessão do terceiro não vira dado do fluxo.
    expect(seen[2]).toEqual({ 'content-type': 'application/json; charset=utf-8', 'x-req': 'r1' });
  });

  it('a Condição seguinte decide pelo status quando o passo não para o fluxo', async () => {
    const client = new FakeHttpClient(json({ erro: 'não achou' }, 404));
    const seen: unknown[] = [];
    const branch: Condition = { kind: 'FieldComparison', fieldPath: 'outputs.call.status', operator: '==', value: 404, valueType: 'literal' };
    const condition: WorkflowStep = {
      id: 'cond',
      stepDefinitionId: '',
      type: 'Condition',
      order: 1,
      configuration: {},
      enabled: true,
      condition: branch,
      branches: {
        whenTrue: [recordStep(lit('não encontrado'), 0, 't')],
        whenFalse: [recordStep(lit('outro'), 0, 'f')],
      },
    };
    const result = await run([callStep({ failOnHttpError: false }, 0), condition], client, seen);
    expect(result.status).toBe('SUCCESS');
    expect(seen).toEqual(['não encontrado']);
    expect(messages(result)).toContain('@core.automation/step.http.done-not-ok');
  });

  it('texto continua texto; JSON inválido em `auto` segue como texto, em `json` falha', async () => {
    const seen: unknown[] = [];
    await run([callStep({}, 0), recordStep({ kind: 'Output', stepId: 'call', outputId: 'body' }, 1)],
      new FakeHttpClient({ headers: { 'content-type': 'text/plain' }, bodyText: 'pong' }), seen);
    expect(seen).toEqual(['pong']);

    const lenient: unknown[] = [];
    await run([callStep({}, 0), recordStep({ kind: 'Output', stepId: 'call', outputId: 'body' }, 1)],
      new FakeHttpClient({ headers: { 'content-type': 'application/json' }, bodyText: '<html>' }), lenient);
    expect(lenient).toEqual(['<html>']);

    const strict = await run([callStep({ responseType: 'json' })], new FakeHttpClient({ bodyText: '<html>' }));
    expect(strict.status).toBe('FAILED');
    expect(messages(strict)).toContain('@core.automation/step.http.invalid-json');
  });

  it('o histórico diz host e caminho, nunca a query', async () => {
    const result = await run([callStep({ query: [{ name: 'token', value: lit('segredo') }] })], new FakeHttpClient(json({})));
    const done = result.logs.find((entry) => entry.message === '@core.automation/step.http.done');
    expect(done?.messageParams).toMatchObject({ method: 'GET', target: 'api.exemplo.com/v1/clientes', status: '200' });
    expect(JSON.stringify(done?.messageParams)).not.toContain('segredo');
  });
});

describe('passo http-request — falhas do servidor de fora', () => {
  it('status fora de 2xx para o fluxo, por padrão', async () => {
    const seen: unknown[] = [];
    const result = await run([callStep({}, 0), recordStep(lit('depois'), 1)], new FakeHttpClient(json({}, 500)), seen);
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.status-failed');
    expect(seen).toEqual([]);
  });

  it('tempo esgotado e rede: falha por padrão, saída com `failOnHttpError: false`', async () => {
    const strict = await run([callStep({})], new FakeHttpClient('timeout'));
    expect(strict.status).toBe('FAILED');
    expect(messages(strict)).toContain('@core.automation/step.http.timeout');

    const seen: unknown[] = [];
    const lenient = await run([
      callStep({ failOnHttpError: false }, 0),
      recordStep({ kind: 'Output', stepId: 'call', outputId: 'timedOut' }, 1),
      recordStep({ kind: 'Output', stepId: 'call', outputId: 'ok' }, 2),
    ], new FakeHttpClient('timeout'), seen);
    expect(lenient.status).toBe('SUCCESS');
    expect(seen).toEqual([true, false]);

    const network = await run([callStep({ failOnHttpError: false })], new FakeHttpClient('network'));
    expect(network.status).toBe('SUCCESS');
    expect(messages(network)).toContain('@core.automation/step.http.network');
  });

  it('endereço interno falha SEMPRE — `failOnHttpError: false` não desliga a fronteira', async () => {
    const result = await run([callStep({ failOnHttpError: false })], new FakeHttpClient('address-blocked'));
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.address-blocked');
  });
});

describe('passo http-request — a política do escritório', () => {
  it('sem nenhum domínio liberado, nada sai', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({ failOnHttpError: false })], client, [], { policy: { allowedHosts: [], allowedPorts: [] } });
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.no-allowed-hosts');
    expect(client.sent).toHaveLength(0);
  });

  it('domínio fora da lista e porta não liberada são recusados antes da rede', async () => {
    const client = new FakeHttpClient(json({}));
    const host = await run([callStep({ url: lit('https://outra.com/x') })], client);
    expect(messages(host)).toContain('@core.automation/step.http.host-not-allowed');

    const port = await run([callStep({ url: lit('https://api.exemplo.com:8443/x') })], client);
    expect(messages(port)).toContain('@core.automation/step.http.port-not-allowed');

    const allowed = await run([callStep({ url: lit('https://api.exemplo.com:8443/x') })], client, [], {
      policy: { allowedHosts: ['api.exemplo.com'], allowedPorts: ['8443'] },
    });
    expect(allowed.status).toBe('SUCCESS');
    expect(client.sent).toHaveLength(1);
  });

  it('a URL que vem de um valor dinâmico também passa pela lista', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({ url: { kind: 'Event', path: 'cliente' } })], client);
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.issue.url-invalid');
    expect(client.sent).toHaveLength(0);
  });

  it('especificação inválida não sai pela rede', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({ method: 'GET', body: { kind: 'json', fields: [] } })], client);
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.issue.body-get');
    expect(client.sent).toHaveLength(0);
  });
});

describe('passo http-request — o tempo de espera', () => {
  it('sem orçamento da execução, a espera é limitada a 30 s', async () => {
    const client = new FakeHttpClient(json({}));
    await run([callStep({ timeoutSeconds: 120 })], client);
    expect(client.sent[0].limits.timeoutMs).toBe(30_000);
    expect(client.sent[0].limits.maxBytes).toBe(100 * 1024);
  });

  it('com orçamento, espera o pedido pelo passo, mas nunca além do que resta', async () => {
    const roomy = new FakeHttpClient(json({}));
    await run([callStep({ timeoutSeconds: 90 })], roomy, [], { services: servicesWith({ deadlineAt: NOW.getTime() + 300_000 }) });
    expect(roomy.sent[0].limits.timeoutMs).toBe(90_000);

    const tight = new FakeHttpClient(json({}));
    await run([callStep({ timeoutSeconds: 90 })], tight, [], { services: servicesWith({ deadlineAt: NOW.getTime() + 20_000 }) });
    expect(tight.sent[0].limits.timeoutMs).toBe(20_000);
  });

  it('orçamento quase esgotado: recusa sem chamar', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({})], client, [], { services: servicesWith({ deadlineAt: NOW.getTime() + 500 }) });
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.no-time-left');
    expect(client.sent).toHaveLength(0);
  });
});

describe('passo http-request — credencial de integração', () => {
  const SECRET = 'sk_live_9f8e7d6c';
  const credential = (over: Partial<HttpConnection> = {}, secret: string | null = SECRET): IHttpCredentialRepository => ({
    findByKey: async (_tenantId, key) => (key === 'crm'
      ? { connection: { id: 'c1', key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.exemplo.com'], hasSecret: secret !== null, ...over }, secret }
      : null),
  });

  it('o servidor põe o segredo no pedido; a automação só nomeia a chave', async () => {
    const client = new FakeHttpClient(json({ ok: true }));
    const result = await run([callStep({ connection: 'crm' })], client, [], { credentials: credential() });
    expect(result.status).toBe('SUCCESS');
    expect(client.sent[0].request.headers.authorization).toBe(`Bearer ${SECRET}`);
    expect(JSON.stringify(result.logs)).not.toContain(SECRET);
  });

  it('basic, cabeçalho próprio e query', async () => {
    const basic = new FakeHttpClient(json({}));
    await run([callStep({ connection: 'crm' })], basic, [], { credentials: credential({ scheme: 'basic', username: 'ana' }) });
    expect(basic.sent[0].request.headers.authorization).toBe(`Basic ${Buffer.from(`ana:${SECRET}`).toString('base64')}`);

    const header = new FakeHttpClient(json({}));
    await run([callStep({ connection: 'crm' })], header, [], { credentials: credential({ scheme: 'header', paramName: 'X-Api-Key' }) });
    expect(header.sent[0].request.headers['x-api-key']).toBe(SECRET);

    const query = new FakeHttpClient(json({}));
    await run([callStep({ connection: 'crm' })], query, [], { credentials: credential({ scheme: 'query', paramName: 'apikey' }) });
    expect(query.sent[0].request.url.searchParams.get('apikey')).toBe(SECRET);
  });

  it('o segredo que a API devolve é apagado do histórico e da saída — em todas as formas', async () => {
    const basicToken = Buffer.from(`ana:${SECRET}`).toString('base64');
    const client = new FakeHttpClient(json({ eco: `Basic ${basicToken}`, chave: SECRET, [SECRET]: 1 }));
    const seen: unknown[] = [];
    const result = await run(
      [callStep({ connection: 'crm' }, 0), recordStep({ kind: 'Output', stepId: 'call', outputId: 'body' }, 1)],
      client, seen, { credentials: credential({ scheme: 'basic', username: 'ana' }) },
    );
    const everything = JSON.stringify({ logs: result.logs, outputs: result.outputs, seen });
    expect(everything).not.toContain(SECRET);
    expect(everything).not.toContain(basicToken);
    expect(seen[0]).toEqual({ eco: 'Basic [redacted]', chave: '[redacted]', '[redacted]': 1 });
  });

  it('o segredo só vai para os domínios DA credencial, mesmo que o escritório libere outro', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({ connection: 'crm', url: lit('https://outra.exemplo.com/x') })], client, [], {
      policy: { allowedHosts: ['*.exemplo.com', 'api.exemplo.com'], allowedPorts: [] },
      credentials: credential(),
    });
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.connection.host');
    expect(client.sent).toHaveLength(0);
  });

  it('a lista do escritório continua valendo por cima da credencial', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([callStep({ connection: 'crm' })], client, [], {
      policy: { allowedHosts: ['outro.com'], allowedPorts: [] },
      credentials: credential(),
    });
    expect(messages(result)).toContain('@core.automation/step.http.host-not-allowed');
    expect(client.sent).toHaveLength(0);
  });

  it('credencial inexistente, sem segredo, ou em conflito com um cabeçalho do autor: recusa sem chamar', async () => {
    const client = new FakeHttpClient(json({}));
    const missing = await run([callStep({ connection: 'erp' })], client, [], { credentials: credential() });
    expect(messages(missing)).toContain('@core.automation/step.http.connection.missing');

    const empty = await run([callStep({ connection: 'crm' })], client, [], { credentials: credential({}, null) });
    expect(messages(empty)).toContain('@core.automation/step.http.connection.no-secret');

    const conflict = await run([callStep({ connection: 'crm', headers: [{ name: 'Authorization', value: lit('x') }] })], client, [], {
      credentials: credential(),
    });
    expect(messages(conflict)).toContain('@core.automation/step.http.connection.conflict');
    expect(client.sent).toHaveLength(0);
  });

  it('sem `connection`, a credencial nem é procurada', async () => {
    let looked = 0;
    const credentials: IHttpCredentialRepository = { findByKey: async () => { looked += 1; return null; } };
    await run([callStep({})], new FakeHttpClient(json({})), [], { credentials });
    expect(looked).toBe(0);
  });
});

/** Fila em memória: guarda o que receberia. */
class FakeQueue implements IHttpDispatchQueue {
  readonly queued: { tenantId: string; input: HttpDispatchInput; now: Date }[] = [];
  async enqueue(tenantId: string, input: HttpDispatchInput, now: Date): Promise<string> {
    this.queued.push({ tenantId, input, now });
    return `d${this.queued.length}`;
  }
}

const asyncStep = (spec: Partial<HttpRequestSpec>, extra: Record<string, InputMapping> = {}): WorkflowStep => {
  const step = callStep({ mode: 'async', ...spec });
  return { ...step, configuration: { ...step.configuration, ...extra } };
};

describe('passo http-request — modo assíncrono', () => {
  it('põe o pedido montado na fila e segue sem esperar; a saída é o id do pedido', async () => {
    const client = new FakeHttpClient(json({}));
    const queue = new FakeQueue();
    const seen: unknown[] = [];
    const result = await run([
      asyncStep({
        method: 'POST',
        url: lit('https://api.exemplo.com/v1/pedidos/{id}'),
        pathParams: [{ name: 'id', value: { kind: 'Event', path: 'id' } }],
        body: { kind: 'json', fields: [{ name: 'cliente', value: { kind: 'Event', path: 'cliente' } }] },
        retries: 2,
        timeoutSeconds: 40,
      }),
      recordStep({ kind: 'Output', stepId: 'call', outputId: 'dispatchId' }, 1),
    ], client, seen, { dispatches: queue });

    expect(result.status).toBe('SUCCESS');
    expect(client.sent).toHaveLength(0);
    expect(seen).toEqual(['d1']);
    expect(messages(result)).toContain('@core.automation/step.http.queued');
    const { input, tenantId, now } = queue.queued[0];
    expect(tenantId).toBe('t1');
    expect(now).toEqual(NOW);
    expect(input.request).toEqual({
      method: 'POST',
      url: 'https://api.exemplo.com/v1/pedidos/p%2F1',
      headers: { accept: expect.any(String), 'content-type': 'application/json' },
      body: JSON.stringify({ cliente: 'Ana Souza' }),
    });
    expect(input.maxAttempts).toBe(3);
    expect(input.timeoutSeconds).toBe(40);
    expect(input.origin).toEqual({ workflowId: 'wf', executionId: expect.any(String) });
    expect(input.callback).toBeUndefined();
  });

  it('sem `retries`, tenta 1 + 3 vezes', async () => {
    const queue = new FakeQueue();
    await run([asyncStep({})], new FakeHttpClient(json({})), [], { dispatches: queue });
    expect(queue.queued[0].input.maxAttempts).toBe(4);
  });

  it('a fronteira é conferida ANTES de enfileirar: domínio fora da lista falha o passo, e nada entra na fila', async () => {
    const queue = new FakeQueue();
    const result = await run([asyncStep({ url: lit('https://outro.com/x') })], new FakeHttpClient(json({})), [], { dispatches: queue });
    expect(result.status).toBe('FAILED');
    expect(messages(result)).toContain('@core.automation/step.http.host-not-allowed');
    expect(queue.queued).toHaveLength(0);
  });

  it('o segredo NUNCA é gravado na fila: a credencial vai pela chave', async () => {
    const SECRET = 'sk_live_fila';
    const credentials: IHttpCredentialRepository = {
      findByKey: async () => ({
        connection: { id: 'c1', key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.exemplo.com'], hasSecret: true },
        secret: SECRET,
      }),
    };
    const queue = new FakeQueue();
    await run([asyncStep({ connection: 'crm' })], new FakeHttpClient(json({})), [], { dispatches: queue, credentials });
    expect(queue.queued[0].input.connection).toBe('crm');
    expect(JSON.stringify(queue.queued[0].input)).not.toContain(SECRET);
  });

  it('credencial inexistente falha já na automação', async () => {
    const queue = new FakeQueue();
    const result = await run([asyncStep({ connection: 'erp' })], new FakeHttpClient(json({})), [], { dispatches: queue });
    expect(messages(result)).toContain('@core.automation/step.http.connection.missing');
    expect(queue.queued).toHaveLength(0);
  });

  it('o callback leva o fluxo-alvo e os parâmetros resolvidos AGORA, um nível abaixo na cadeia', async () => {
    const queue = new FakeQueue();
    await run([asyncStep({}, {
      targetWorkflowId: lit('wf-retorno'),
      'param.pedido': { kind: 'Event', path: 'id' },
      'param.cliente.nome': { kind: 'Event', path: 'cliente' },
    })], new FakeHttpClient(json({})), [], { dispatches: queue, payload: { __callDepth: 2 } });
    expect(queue.queued[0].input.callback).toEqual({
      workflowId: 'wf-retorno',
      params: { pedido: 'p/1', cliente: { nome: 'Ana Souza' } },
      callDepth: 3,
    });
  });

  it('no teto da cadeia de chamadas, o callback é recusado — um fluxo que se chama em laço para', async () => {
    const queue = new FakeQueue();
    const result = await run([asyncStep({}, { targetWorkflowId: lit('wf-retorno') })], new FakeHttpClient(json({})), [], {
      dispatches: queue,
      payload: { __callDepth: 10 },
    });
    expect(messages(result)).toContain('@core.automation/step.call-workflow.max-depth');
    expect(queue.queued).toHaveLength(0);
  });

  it('pedido grande demais para a fila é recusado', async () => {
    const queue = new FakeQueue();
    const result = await run([asyncStep({
      method: 'POST',
      body: { kind: 'text', contentType: 'text/plain', value: lit('x'.repeat(300 * 1024)) },
    })], new FakeHttpClient(json({})), [], { dispatches: queue });
    expect(messages(result)).toContain('@core.automation/step.http.async.too-large');
    expect(queue.queued).toHaveLength(0);
  });

  it('onde não há fila, o assíncrono falha dizendo isso — nunca vira síncrono calado', async () => {
    const client = new FakeHttpClient(json({}));
    const result = await run([asyncStep({})], client);
    expect(messages(result)).toContain('@core.automation/step.http.async.unavailable');
    expect(client.sent).toHaveLength(0);
  });

  it('no modo síncrono, o callback é ignorado com aviso, e a chamada segue como sempre', async () => {
    const client = new FakeHttpClient(json({ ok: true }));
    const queue = new FakeQueue();
    const result = await run([{ ...callStep({}), configuration: { ...callStep({}).configuration, targetWorkflowId: lit('wf-retorno') } }], client, [], {
      dispatches: queue,
    });
    expect(result.status).toBe('SUCCESS');
    expect(client.sent).toHaveLength(1);
    expect(queue.queued).toHaveLength(0);
    expect(messages(result)).toContain('@core.automation/step.http.callback-ignored');
  });
});
