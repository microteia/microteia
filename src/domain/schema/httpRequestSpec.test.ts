import { describe, expect, it } from 'vitest';
import {
  buildHttpUrl,
  describeHttpTarget,
  headerValueOf,
  HTTP_ALLOWED_HOSTS_PROPERTY,
  HTTP_ALLOWED_PORTS_PROPERTY,
  HTTP_MAX_FIELDS,
  httpRequestSpecWarnings,
  httpSampleFields,
  httpSamplePaths,
  isHttpHostAllowed,
  isHttpPortAllowed,
  parseHttpUrl,
  queryPairs,
  urlPlaceholders,
  validateHttpRequestSpec,
  type HttpRequestSpec,
  httpDynamicValues,
  httpSampleFromBody,
  isAsyncHttpSpec,
  isHttpOutputOfMode,
  withLiteralValues,
} from './httpRequestSpec';
import { validateSettingValue } from './settings';

const lit = (value: unknown) => ({ kind: 'Literal' as const, value });
const spec = (over: Partial<HttpRequestSpec> = {}): HttpRequestSpec => ({
  method: 'GET',
  url: lit('https://api.exemplo.com/v1/clientes'),
  ...over,
});
const errors = (value: unknown) => validateHttpRequestSpec(value).map((issue) => issue.error);

describe('validateHttpRequestSpec — a mesma função no editor, no motor e no pacote', () => {
  it('aceita a especificação mínima', () => {
    expect(validateHttpRequestSpec(spec())).toEqual([]);
  });

  it('recusa o que não é objeto, o método desconhecido e a URL ausente', () => {
    expect(errors(null)).toEqual(['@core.automation/step.http.not-configured']);
    expect(errors(spec({ method: 'TRACE' as never }))).toContain('@core.automation/step.http.issue.method');
    expect(errors(spec({ url: lit('') }))).toContain('@core.automation/step.http.issue.url-missing');
    expect(errors({ method: 'GET' })).toContain('@core.automation/step.http.issue.url-missing');
  });

  it('confere a URL fixa já no design-time: https, sem credencial, sem IP', () => {
    expect(errors(spec({ url: lit('http://api.exemplo.com') }))).toContain('@core.automation/step.http.issue.url-https');
    expect(errors(spec({ url: lit('https://u:p@api.exemplo.com') }))).toContain('@core.automation/step.http.issue.url-credentials');
    expect(errors(spec({ url: lit('https://10.0.0.1/x') }))).toContain('@core.automation/step.http.issue.url-ip');
    expect(errors(spec({ url: lit('https://[::1]/x') }))).toContain('@core.automation/step.http.issue.url-ip');
    expect(errors(spec({ url: lit('nada') }))).toContain('@core.automation/step.http.issue.url-invalid');
  });

  it('a URL que vem de expressão ou de passo anterior só é conferida em runtime', () => {
    expect(validateHttpRequestSpec(spec({ url: { kind: 'Expression', expression: 'concat("x")' } }))).toEqual([]);
    expect(validateHttpRequestSpec(spec({ url: { kind: 'Output', stepId: 's1', outputId: 'url' } }))).toEqual([]);
  });

  it('cada marcador {nome} da URL fixa precisa de um parâmetro de caminho', () => {
    const missing = validateHttpRequestSpec(spec({ url: lit('https://api.exemplo.com/clientes/{id}') }));
    expect(missing).toEqual([{ field: 'url', error: '@core.automation/step.http.issue.path-param-missing', errorParams: { name: 'id' } }]);
    expect(validateHttpRequestSpec(spec({
      url: lit('https://api.exemplo.com/clientes/{id}'),
      pathParams: [{ name: 'id', value: lit('1') }],
    }))).toEqual([]);
  });

  it('recusa cabeçalho de nome inválido, controlado pela plataforma ou repetido (sem diferenciar caixa)', () => {
    expect(errors(spec({ headers: [{ name: 'X Bad', value: lit('1') }] }))).toContain('@core.automation/step.http.issue.header-name');
    for (const name of ['Host', 'content-length', 'Accept-Encoding', 'Proxy-Authorization', 'Sec-Fetch-Mode']) {
      expect(errors(spec({ headers: [{ name, value: lit('1') }] }))).toContain('@core.automation/step.http.issue.header-forbidden');
    }
    expect(errors(spec({ headers: [{ name: 'X-A', value: lit('1') }, { name: 'x-a', value: lit('2') }] })))
      .toContain('@core.automation/step.http.issue.duplicate');
  });

  it('query aceita chave repetida (?id=1&id=2); nome vazio e valor sem origem são recusados', () => {
    expect(validateHttpRequestSpec(spec({ query: [{ name: 'id', value: lit('1') }, { name: 'id', value: lit('2') }] }))).toEqual([]);
    expect(errors(spec({ query: [{ name: ' ', value: lit('1') }] }))).toContain('@core.automation/step.http.issue.name-empty');
    expect(errors(spec({ query: [{ name: 'a', value: 'cru' as never }] }))).toContain('@core.automation/step.http.issue.value');
  });

  it(`limita cada lista a ${HTTP_MAX_FIELDS} itens`, () => {
    const many = Array.from({ length: HTTP_MAX_FIELDS + 1 }, (_, i) => ({ name: `q${i}`, value: lit(i) }));
    expect(errors(spec({ query: many }))).toContain('@core.automation/step.http.issue.too-many');
  });

  it('GET não leva corpo; os outros métodos validam o corpo pelo tipo', () => {
    expect(errors(spec({ body: { kind: 'json', fields: [] } }))).toContain('@core.automation/step.http.issue.body-get');
    expect(validateHttpRequestSpec(spec({ body: { kind: 'none' } }))).toEqual([]);
    expect(validateHttpRequestSpec(spec({ method: 'POST', body: { kind: 'json', fields: [{ name: 'a.b', value: lit(1) }] } }))).toEqual([]);
    expect(errors(spec({ method: 'POST', body: { kind: 'text', contentType: 'nada', value: lit('x') } })))
      .toContain('@core.automation/step.http.issue.content-type');
    expect(errors(spec({ method: 'POST', body: { kind: 'json-from' } as never }))).toContain('@core.automation/step.http.issue.body-value');
    expect(errors(spec({ method: 'POST', body: { kind: 'xml' } as never }))).toContain('@core.automation/step.http.issue.body-kind');
  });

  it('confere o tempo, o modo de falha, o tipo de resposta e o exemplo', () => {
    expect(errors(spec({ timeoutSeconds: 0 }))).toContain('@core.automation/step.http.issue.timeout');
    expect(errors(spec({ timeoutSeconds: 121 }))).toContain('@core.automation/step.http.issue.timeout');
    expect(errors(spec({ timeoutSeconds: 1.5 }))).toContain('@core.automation/step.http.issue.timeout');
    expect(validateHttpRequestSpec(spec({ timeoutSeconds: 120 }))).toEqual([]);
    expect(errors(spec({ failOnHttpError: 'sim' as never }))).toContain('@core.automation/step.http.issue.fail-on-error');
    expect(errors(spec({ responseType: 'xml' as never }))).toContain('@core.automation/step.http.issue.response-type');
    expect(errors(spec({ responseSample: '{ruim' }))).toContain('@core.automation/step.http.issue.sample');
    expect(validateHttpRequestSpec(spec({ responseSample: '' }))).toEqual([]);
  });
});

describe('httpRequestSpecWarnings — segredo com valor fixo', () => {
  it('avisa o cabeçalho sensível com valor fixo, e só ele', () => {
    const warnings = httpRequestSpecWarnings(spec({
      headers: [
        { name: 'Authorization', value: lit('Bearer abc') },
        { name: 'X-Api-Key', value: lit('k') },
        { name: 'X-Token', value: { kind: 'Variable', name: 'token' } },
        { name: 'Accept-Language', value: lit('pt-BR') },
        { name: 'Cookie', value: lit('') },
      ],
    }));
    expect(warnings.map((warning) => warning.errorParams?.name)).toEqual(['Authorization', 'X-Api-Key']);
  });
});

describe('montagem da requisição', () => {
  it('preenche os marcadores com encoding — um valor com / não muda o caminho', () => {
    const built = buildHttpUrl('https://api.exemplo.com/clientes/{id}/x', { id: 'a/b?c' }, []);
    expect('url' in built && built.url.toString()).toBe('https://api.exemplo.com/clientes/a%2Fb%3Fc/x');
  });

  it('marcador sem valor é recusa nomeada', () => {
    expect(buildHttpUrl('https://api.exemplo.com/{id}', { id: '' }, [])).toEqual({
      error: '@core.automation/step.http.path-param-empty',
      errorParams: { name: 'id' },
    });
  });

  it('acrescenta a query aos pares que a URL já trazia, com lista repetindo a chave', () => {
    const pairs = [...queryPairs('id', [1, 2]), ...queryPairs('q', 'a b'), ...queryPairs('nada', null)];
    const built = buildHttpUrl('https://api.exemplo.com/x?fixo=1', {}, pairs);
    expect('url' in built && built.url.search).toBe('?fixo=1&id=1&id=2&q=a+b');
  });

  it('o IP escrito como número é normalizado pela URL e recusado do mesmo jeito', () => {
    expect(parseHttpUrl('https://2130706433/')).toEqual({ error: '@core.automation/step.http.issue.url-ip' });
    expect(parseHttpUrl('https://0x7f.1/')).toEqual({ error: '@core.automation/step.http.issue.url-ip' });
  });

  it('valor de cabeçalho com quebra de linha é recusado — seria injeção de cabeçalho', () => {
    expect(headerValueOf('a\r\nX-Evil: 1')).toEqual({ error: '@core.automation/step.http.header-value-invalid' });
    expect(headerValueOf(42)).toEqual({ value: '42' });
    expect(headerValueOf({ a: 1 })).toEqual({ value: '{"a":1}' });
  });

  it('o histórico leva host e caminho, nunca a query', () => {
    expect(describeHttpTarget(new URL('https://api.exemplo.com/v1/x?token=segredo'))).toBe('api.exemplo.com/v1/x');
  });

  it('lista os marcadores sem repetir', () => {
    expect(urlPlaceholders('https://x.com/{a}/{b}/{a}')).toEqual(['a', 'b']);
  });
});

describe('lista de domínios e portas do escritório', () => {
  const allowed = ['api.exemplo.com', '*.parceiro.com.br'];

  it('lista vazia não libera nada', () => {
    expect(isHttpHostAllowed('api.exemplo.com', [])).toBe(false);
  });

  it('casa o domínio exato e, com *., só os subdomínios', () => {
    expect(isHttpHostAllowed('API.Exemplo.com', allowed)).toBe(true);
    expect(isHttpHostAllowed('api.exemplo.com.', allowed)).toBe(true);
    expect(isHttpHostAllowed('outra.exemplo.com', allowed)).toBe(false);
    expect(isHttpHostAllowed('a.b.parceiro.com.br', allowed)).toBe(true);
    expect(isHttpHostAllowed('parceiro.com.br', allowed)).toBe(false);
    expect(isHttpHostAllowed('malparceiro.com.br', allowed)).toBe(false);
    expect(isHttpHostAllowed('api.exemplo.com.evil.io', allowed)).toBe(false);
  });

  it('item malformado na lista não libera nada', () => {
    expect(isHttpHostAllowed('10.0.0.1', ['10.0.0.1'])).toBe(false);
    expect(isHttpHostAllowed('x.com', ['*'])).toBe(false);
  });

  it('a 443 está sempre liberada; outra porta, só se listada', () => {
    expect(isHttpPortAllowed(new URL('https://a.com/'), [])).toBe(true);
    expect(isHttpPortAllowed(new URL('https://a.com:8443/'), [])).toBe(false);
    expect(isHttpPortAllowed(new URL('https://a.com:8443/'), ['8443'])).toBe(true);
  });

  it('a tela de Configurações recusa pelo mesmo padrão: domínio sim, IP e porta não', () => {
    expect(validateSettingValue(HTTP_ALLOWED_HOSTS_PROPERTY, ['api.exemplo.com', '*.parceiro.com.br'])).toBeNull();
    expect(validateSettingValue(HTTP_ALLOWED_HOSTS_PROPERTY, ['10.0.0.1'])).not.toBeNull();
    expect(validateSettingValue(HTTP_ALLOWED_HOSTS_PROPERTY, ['api.exemplo.com:8443'])).not.toBeNull();
    expect(validateSettingValue(HTTP_ALLOWED_PORTS_PROPERTY, ['8443'])).toBeNull();
    expect(validateSettingValue(HTTP_ALLOWED_PORTS_PROPERTY, ['70000'])).not.toBeNull();
    expect(validateSettingValue(HTTP_ALLOWED_PORTS_PROPERTY, ['0'])).not.toBeNull();
  });
});

describe('IntelliSense — a forma do exemplo de resposta', () => {
  const sample = JSON.stringify({
    id: 7,
    ativo: true,
    cliente: { nome: 'Ana', endereco: { cidade: 'Salvador' } },
    itens: [{ sku: 'A1', qtd: 2 }],
    tags: ['x'],
  });

  it('descreve objetos, listas e escalares', () => {
    expect(httpSampleFields(sample)).toEqual([
      { key: 'id', type: 'number' },
      { key: 'ativo', type: 'boolean' },
      { key: 'cliente', type: 'object', fields: [
        { key: 'nome', type: 'string' },
        { key: 'endereco', type: 'object', fields: [{ key: 'cidade', type: 'string' }] },
      ] },
      { key: 'itens', type: 'list', fields: [{ key: 'sku', type: 'string' }, { key: 'qtd', type: 'number' }] },
      { key: 'tags', type: 'list' },
    ]);
  });

  it('as folhas viram caminhos body.<campo>; listas param no nome da lista', () => {
    expect(httpSamplePaths(httpSampleFields(sample))).toEqual([
      'body.id', 'body.ativo', 'body.cliente.nome', 'body.cliente.endereco.cidade', 'body.itens', 'body.tags',
    ]);
  });

  it('exemplo vazio, inválido ou que não é objeto não sugere nada', () => {
    expect(httpSampleFields(undefined)).toEqual([]);
    expect(httpSampleFields('{ruim')).toEqual([]);
    expect(httpSampleFields('[1,2]')).toEqual([]);
  });
});

describe('modo assíncrono — a especificação', () => {
  const base = { method: 'GET', url: { kind: 'Literal', value: 'https://api.exemplo.com/x' } };

  it('modo ausente é síncrono; tentativas de 0 a 5', () => {
    expect(isAsyncHttpSpec(base as HttpRequestSpec)).toBe(false);
    expect(isAsyncHttpSpec({ mode: 'async' })).toBe(true);
    expect(validateHttpRequestSpec({ ...base, mode: 'async', retries: 0 })).toEqual([]);
    expect(validateHttpRequestSpec({ ...base, mode: 'async', retries: 5 })).toEqual([]);
    expect(validateHttpRequestSpec({ ...base, mode: 'depois' }).map((issue) => issue.error)).toEqual(['@core.automation/step.http.issue.mode']);
    for (const retries of [-1, 6, 1.5, '2']) {
      expect(validateHttpRequestSpec({ ...base, retries }).map((issue) => issue.error)).toEqual(['@core.automation/step.http.issue.retries']);
    }
  });

  it('cada modo publica as suas saídas: o assíncrono só o id do pedido', () => {
    expect(isHttpOutputOfMode({ mode: 'async' }, 'dispatchId')).toBe(true);
    expect(isHttpOutputOfMode({ mode: 'async' }, 'status')).toBe(false);
    expect(isHttpOutputOfMode({}, 'status')).toBe(true);
    expect(isHttpOutputOfMode({}, 'dispatchId')).toBe(false);
    expect(isHttpOutputOfMode(null, 'body')).toBe(true);
  });
});

describe('teste de chamada — valores de exemplo', () => {
  const event = (path: string) => ({ kind: 'Event', path }) as const;
  const spec: HttpRequestSpec = {
    method: 'POST',
    url: { kind: 'Literal', value: 'https://api.exemplo.com/{id}' },
    pathParams: [{ name: 'id', value: event('id') }],
    query: [{ name: 'fixo', value: { kind: 'Literal', value: '1' } }, { name: 'q', value: { kind: 'Variable', name: 'busca' } }],
    headers: [{ name: 'X-Trace', value: { kind: 'Expression', expression: 'now()' } }],
    body: { kind: 'json', fields: [{ name: 'nome', value: event('cliente') }] },
  };

  it('lista só o que não é fixo, com o endereço e o nome de cada um', () => {
    expect(httpDynamicValues(spec).map(({ field, name }) => [field, name])).toEqual([
      ['pathParams[0]', 'id'],
      ['query[1]', 'q'],
      ['headers[0]', 'X-Trace'],
      ['body.fields[0]', 'nome'],
    ]);
    expect(httpDynamicValues({ ...spec, url: event('url'), body: { kind: 'json-from', value: event('obj') } }).map(({ field }) => field))
      .toEqual(['url', 'pathParams[0]', 'query[1]', 'headers[0]', 'body.value']);
  });

  it('troca cada valor dinâmico pelo exemplo, sem tocar no que já é fixo; sem exemplo, vazio', () => {
    const literal = withLiteralValues(spec, { 'pathParams[0]': 'p1', 'body.fields[0]': 'Ana' });
    expect(httpDynamicValues(literal)).toEqual([]);
    expect(literal.pathParams?.[0].value).toEqual({ kind: 'Literal', value: 'p1' });
    expect(literal.query?.[0].value).toEqual({ kind: 'Literal', value: '1' });
    expect(literal.query?.[1].value).toEqual({ kind: 'Literal', value: '' });
    expect(literal.body).toEqual({ kind: 'json', fields: [{ name: 'nome', value: { kind: 'Literal', value: 'Ana' } }] });
    expect(validateHttpRequestSpec(literal)).toEqual([]);
  });

  it('o exemplo de resposta sai do corpo: objeto indentado, texto como veio', () => {
    expect(httpSampleFromBody({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(httpSampleFromBody('ok')).toBe('ok');
    expect(httpSampleFromBody(null)).toBe('null');
  });
});
