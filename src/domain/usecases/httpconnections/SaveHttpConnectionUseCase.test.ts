import { describe, expect, it } from 'vitest';
import { makeSaveHttpConnectionUseCase } from './SaveHttpConnectionUseCase';
import type { IHttpConnectionRepository } from '../../repositories/IHttpConnectionRepository';
import type { HttpConnection, HttpConnectionData } from '../../schema/httpConnection';

const fakeRepo = () => {
  const calls: { op: string; data?: HttpConnectionData; secret?: string; id?: string }[] = [];
  const repo: IHttpConnectionRepository = {
    list: async () => [],
    subscribe: () => () => undefined,
    create: async (_tenantId, data, secret) => {
      calls.push({ op: 'create', data, secret });
      return { ...data, id: 'novo', hasSecret: true };
    },
    update: async (_tenantId, id, data, secret) => { calls.push({ op: 'update', id, data, secret }); },
    remove: async () => undefined,
  };
  return { repo, calls };
};

const data = (over: Partial<HttpConnectionData> = {}): HttpConnectionData => ({
  key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.exemplo.com'], ...over,
});
const existente: HttpConnection = { ...data(), id: 'c1', hasSecret: true };

describe('SaveHttpConnectionUseCase', () => {
  it('cria com o segredo, normalizando domínios e descartando o que não vale para o esquema', async () => {
    const { repo, calls } = fakeRepo();
    const result = await makeSaveHttpConnectionUseCase(repo).execute({
      tenantId: 't1',
      data: data({ name: ' CRM ', hosts: [' API.Exemplo.com ', 'api.exemplo.com'], username: 'sobra', paramName: 'sobra' }),
      secret: ' sk ',
      existing: [],
    });
    expect(result.ok).toBe(true);
    expect(calls).toEqual([{
      op: 'create',
      data: { key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.exemplo.com'] },
      secret: 'sk',
    }]);
  });

  it('criar sem segredo é recusado, e nada é gravado', async () => {
    const { repo, calls } = fakeRepo();
    const result = await makeSaveHttpConnectionUseCase(repo).execute({ tenantId: 't1', data: data(), secret: '  ', existing: [] });
    expect(result.ok === false && result.issues.map((issue) => issue.field)).toEqual(['secret']);
    expect(calls).toEqual([]);
  });

  it('editar sem segredo mantém o gravado', async () => {
    const { repo, calls } = fakeRepo();
    const result = await makeSaveHttpConnectionUseCase(repo).execute({
      tenantId: 't1', id: 'c1', data: data({ name: 'CRM novo' }), secret: '', existing: [existente],
    });
    expect(result.ok).toBe(true);
    expect(calls[0]).toMatchObject({ op: 'update', id: 'c1', secret: undefined });
  });

  it('a chave é única entre as OUTRAS credenciais — a própria não conta', async () => {
    const { repo } = fakeRepo();
    const save = makeSaveHttpConnectionUseCase(repo);
    const repetida = await save.execute({ tenantId: 't1', data: data(), secret: 'x', existing: [existente] });
    expect(repetida.ok === false && repetida.issues.map((issue) => issue.error)).toEqual(['@core.automation/http-connection.issue.key-taken']);
    const propria = await save.execute({ tenantId: 't1', id: 'c1', data: data(), secret: '', existing: [existente] });
    expect(propria.ok).toBe(true);
  });
});
