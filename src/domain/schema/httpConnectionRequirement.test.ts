import { describe, expect, it } from 'vitest';
import {
  httpConnectionRequirementContribution,
  httpConnectionRequirementIssues,
  httpConnectionRequirementState,
  httpConnectionRequirementsOf,
  isHostCovered,
  type HttpConnectionRequirement,
} from './httpConnectionRequirement';
import type { HttpConnection } from './httpConnection';

const requirement: HttpConnectionRequirement = {
  pluginId: 'com.acme.crm',
  key: 'crm',
  name: '@com.acme.crm/connection.crm',
  scheme: 'header',
  paramName: 'X-Api-Key',
  hosts: ['api.crm.com'],
};

const connection = (over: Partial<HttpConnection> = {}): HttpConnection => ({
  id: 'c1',
  key: 'crm',
  name: 'CRM',
  scheme: 'header',
  paramName: 'x-api-key',
  hosts: ['api.crm.com'],
  hasSecret: true,
  ...over,
});

describe('credencial declarada pela extensão — o estado no escritório', () => {
  it('a declaração lida do pacote instalado guarda o dono e descarta o que não tem forma', () => {
    const contributes = [
      httpConnectionRequirementContribution({ key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['API.crm.com'] }),
      { point: 'http.connection', id: 'x', apiVersion: '1.0.0', metadata: { key: 'X', scheme: 'bearer', hosts: ['a.com'] } },
      { point: 'http.connection', id: 'y', apiVersion: '1.0.0', metadata: { key: 'sem-dominio', scheme: 'bearer', hosts: [] } },
    ];
    expect(httpConnectionRequirementsOf('com.acme.crm', contributes)).toEqual([
      { pluginId: 'com.acme.crm', key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['api.crm.com'] },
    ]);
  });

  it('cada estado, na ordem do que impede a chamada', () => {
    const office = ['api.crm.com'];
    expect(httpConnectionRequirementState(requirement, [], office)).toBe('missing');
    expect(httpConnectionRequirementState(requirement, [connection({ scheme: 'bearer' })], office)).toBe('scheme');
    expect(httpConnectionRequirementState(requirement, [connection({ paramName: 'X-Token' })], office)).toBe('scheme');
    expect(httpConnectionRequirementState(requirement, [connection({ hosts: ['outra.com'] })], office)).toBe('hosts');
    expect(httpConnectionRequirementState(requirement, [connection({ hasSecret: false })], office)).toBe('no-secret');
    expect(httpConnectionRequirementState(requirement, [connection()], [])).toBe('office-hosts');
    expect(httpConnectionRequirementState(requirement, [connection()], office)).toBe('ok');
  });

  it('o cabeçalho é comparado sem caixa; o parâmetro de query, com', () => {
    const query = { ...requirement, scheme: 'query' as const, paramName: 'apiKey' };
    expect(httpConnectionRequirementState(query, [connection({ scheme: 'query', paramName: 'apikey' })], ['api.crm.com'])).toBe('scheme');
    expect(httpConnectionRequirementState(query, [connection({ scheme: 'query', paramName: 'apiKey' })], ['api.crm.com'])).toBe('ok');
  });

  it('curinga declarado só é coberto por curinga que o contenha', () => {
    expect(isHostCovered('*.crm.com', ['api.crm.com'])).toBe(false);
    expect(isHostCovered('*.crm.com', ['*.crm.com'])).toBe(true);
    expect(isHostCovered('*.eu.crm.com', ['*.crm.com'])).toBe(true);
    expect(isHostCovered('api.crm.com', ['*.crm.com'])).toBe(true);
    expect(isHostCovered('api.crm.com', ['crm.com'])).toBe(false);
  });

  it('a declaração passa pela mesma conferência do formulário, menos o usuário do basic', () => {
    expect(httpConnectionRequirementIssues({ key: 'crm', name: 'CRM', scheme: 'basic', hosts: ['api.crm.com'] })).toEqual([]);
    expect(httpConnectionRequirementIssues({ key: 'crm', name: 'CRM', scheme: 'header', hosts: ['http://x'] })
      .map((issue) => issue.field)).toEqual(['paramName', 'hosts']);
  });
});
