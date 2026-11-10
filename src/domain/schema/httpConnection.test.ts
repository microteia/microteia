import { describe, expect, it } from 'vitest';
import {
  applyHttpCredential,
  asHttpConnection,
  redactSecrets,
  validateHttpConnection,
  type HttpConnection,
  type HttpConnectionData,
} from './httpConnection';
import { validateHttpRequestSpec } from './httpRequestSpec';

const data = (over: Partial<HttpConnectionData> = {}): HttpConnectionData => ({
  key: 'crm',
  name: 'CRM',
  scheme: 'bearer',
  hosts: ['api.exemplo.com'],
  ...over,
});
const fields = (over: Partial<HttpConnectionData>, keys: string[] = []) =>
  validateHttpConnection(data(over), keys).map((issue) => issue.field);

const connection = (over: Partial<HttpConnection> = {}): HttpConnection => ({ id: 'c1', hasSecret: true, ...data(), ...over });
const b64 = (text: string): string => btoa(String.fromCharCode(...new TextEncoder().encode(text)));
const target = (url = 'https://api.exemplo.com/v1?x=1', headers: Record<string, string> = {}) => ({ url: new URL(url), headers });

describe('validateHttpConnection — a mesma conferência na tela e no servidor', () => {
  it('aceita a credencial completa', () => {
    expect(validateHttpConnection(data())).toEqual([]);
  });

  it('a chave é um identificador estável e único no escritório', () => {
    expect(fields({ key: 'CRM' })).toEqual(['key']);
    expect(fields({ key: 'c' })).toEqual(['key']);
    expect(fields({ key: '1crm' })).toEqual(['key']);
    expect(validateHttpConnection(data(), ['crm'])).toEqual([
      { field: 'key', error: '@core.automation/http-connection.issue.key-taken', errorParams: { key: 'crm' } },
    ]);
  });

  it('cada esquema pede o que precisa', () => {
    expect(fields({ scheme: 'basic' })).toEqual(['username']);
    expect(fields({ scheme: 'basic', username: 'a:b' })).toEqual(['username']);
    expect(fields({ scheme: 'basic', username: 'ana' })).toEqual([]);
    expect(fields({ scheme: 'header' })).toEqual(['paramName']);
    expect(fields({ scheme: 'header', paramName: 'Host' })).toEqual(['paramName']);
    expect(fields({ scheme: 'header', paramName: 'X-Api-Key' })).toEqual([]);
    expect(fields({ scheme: 'query', paramName: 'api key' })).toEqual(['paramName']);
    expect(fields({ scheme: 'query', paramName: 'apikey' })).toEqual([]);
    expect(fields({ scheme: 'oauth' as never })).toEqual(['scheme']);
  });

  it('os domínios da credencial são obrigatórios e no formato da lista do escritório', () => {
    expect(fields({ hosts: [] })).toEqual(['hosts']);
    expect(fields({ hosts: ['10.0.0.1'] })).toEqual(['hosts']);
    expect(fields({ hosts: ['*.exemplo.com'] })).toEqual([]);
  });
});

describe('applyHttpCredential', () => {
  it('bearer e basic vão em Authorization; o basic em UTF-8', () => {
    const bearer = applyHttpCredential(connection(), 's3cr3t', target());
    expect('target' in bearer && bearer.target.headers.authorization).toBe('Bearer s3cr3t');

    const basic = applyHttpCredential(connection({ scheme: 'basic', username: 'joão' }), 'sênha', target());
    expect('target' in basic && basic.target.headers.authorization)
      .toBe(`Basic ${b64('joão:sênha')}`);
    expect('target' in basic && basic.secretForms).toContain(b64('joão:sênha'));
  });

  it('header próprio e query, sem tocar o que já estava', () => {
    const header = applyHttpCredential(connection({ scheme: 'header', paramName: 'X-Api-Key' }), 's3cr3t', target());
    expect('target' in header && header.target.headers['x-api-key']).toBe('s3cr3t');

    const query = applyHttpCredential(connection({ scheme: 'query', paramName: 'key' }), 'a b&c', target());
    expect('target' in query && query.target.url.search).toBe('?x=1&key=a+b%26c');
    expect('target' in query && query.secretForms).toContain('a+b%26c');
  });

  it('não envia para domínio fora da credencial', () => {
    expect(applyHttpCredential(connection(), 's3cr3t', target('https://evil.com/'))).toEqual({
      error: '@core.automation/step.http.connection.host',
      errorParams: { key: 'crm', host: 'evil.com' },
    });
  });

  it('recusa o conflito com o que o autor já pôs, em vez de sobrescrever', () => {
    expect(applyHttpCredential(connection(), 's', target(undefined, { authorization: 'x' })))
      .toMatchObject({ error: '@core.automation/step.http.connection.conflict' });
    expect(applyHttpCredential(connection({ scheme: 'query', paramName: 'x' }), 's3cr3t', target()))
      .toMatchObject({ error: '@core.automation/step.http.connection.conflict', errorParams: { name: 'x' } });
  });

  it('não altera o pedido recebido', () => {
    const original = target();
    applyHttpCredential(connection({ scheme: 'query', paramName: 'key' }), 's3cr3t', original);
    expect(original.url.search).toBe('?x=1');
    expect(original.headers).toEqual({});
  });
});

describe('redactSecrets', () => {
  it('apaga em textos, chaves e listas, e preserva o resto', () => {
    const when = new Date('2026-01-01T00:00:00Z');
    expect(redactSecrets({ a: 'x s3cr3t y', s3cr3t: [1, 's3cr3t'], n: 2, when }, ['s3cr3t'])).toEqual({
      a: 'x [redacted] y',
      '[redacted]': [1, '[redacted]'],
      n: 2,
      when,
    });
  });

  it('sem formas, devolve o mesmo valor', () => {
    const value = { a: 1 };
    expect(redactSecrets(value, [])).toBe(value);
  });
});

describe('asHttpConnection e a chave na especificação do passo', () => {
  it('documento sem forma de credencial vira null; o segredo nunca está nele', () => {
    expect(asHttpConnection('x', { key: 'Ruim', scheme: 'bearer' })).toBeNull();
    expect(asHttpConnection('x', { key: 'crm', scheme: 'oauth' })).toBeNull();
    expect(asHttpConnection('x', { key: 'crm', scheme: 'bearer', hosts: ['a.com', 3], hasSecret: true }))
      .toEqual({ id: 'x', key: 'crm', name: 'crm', scheme: 'bearer', hosts: ['a.com'], hasSecret: true });
  });

  it('o passo aceita uma chave de credencial e recusa o que não é chave', () => {
    const spec = { method: 'GET', url: { kind: 'Literal', value: 'https://api.exemplo.com' } };
    expect(validateHttpRequestSpec({ ...spec, connection: 'crm' })).toEqual([]);
    expect(validateHttpRequestSpec({ ...spec, connection: 'Bearer abc' }).map((issue) => issue.error))
      .toEqual(['@core.automation/step.http.issue.connection']);
  });
});
