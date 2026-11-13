import { describe, expect, it } from 'vitest';
import { httpConnectionPackageIssues } from './httpConnectionIntegrity';
import { httpConnectionRequirementContribution } from '../../schema/httpConnectionRequirement';
import type { MarketplacePlugin, WorkflowModuleTemplate } from '../../entities/MarketplacePlugin';
import type { WorkflowStep } from '../../entities/Workflow';

const callApi = (id: string, connection: string, url: string): WorkflowStep => ({
  id,
  stepDefinitionId: 'http-request',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: { request: { kind: 'Literal', value: { method: 'GET', url: { kind: 'Literal', value: url }, connection } } },
} as unknown as WorkflowStep);

const workflow = (steps: WorkflowStep[]): WorkflowModuleTemplate => ({
  templateId: 'wf-sync', name: 'Sync', eventName: 'workflow.called', enabled: true, version: 1,
  condition: { kind: 'AlwaysTrue' }, steps,
} as unknown as WorkflowModuleTemplate);

const crm = httpConnectionRequirementContribution({ key: 'crm', name: 'CRM', scheme: 'bearer', hosts: ['*.crm.com'] });

const pkg = (kernel: string, contributes = [crm], steps = [callApi('s1', 'crm', 'https://api.crm.com/contacts/{id}')]): MarketplacePlugin => ({
  manifest: { id: 'com.acme.crm', version: '1.0.0', kernel, name: 'CRM', contributes },
  workflows: [workflow(steps)],
} as unknown as MarketplacePlugin);

const messages = (p: MarketplacePlugin) => httpConnectionPackageIssues(p).map((issue) => issue.message);

describe('credencial declarada — as contas do pacote', () => {
  it('declarada, usada e com o domínio coberto: nada a dizer', () => {
    expect(httpConnectionPackageIssues(pkg('^2.123.0'))).toEqual([]);
  });

  it('declarar exige o kernel que conhece o ponto', () => {
    expect(messages(pkg('^2.122.0'))).toEqual(['@core.marketplace/issue.http-connection.kernel']);
  });

  it('usada e não declarada: recusa no pacote que mira o ponto, e passa no que é anterior a ele', () => {
    expect(httpConnectionPackageIssues(pkg('^2.123.0', []))).toEqual([{
      message: '@core.marketplace/issue.http-connection.undeclared',
      messageParams: { workflow: 'wf-sync', step: 's1', connection: 'crm' },
    }]);
    expect(messages(pkg('^2.100.0', []))).toEqual([]);
  });

  it('URL fixa fora dos domínios declarados é recusada; a que vem de marcador só se sabe na execução', () => {
    expect(httpConnectionPackageIssues(pkg('^2.123.0', [crm], [callApi('s1', 'crm', 'https://evil.com/x')]))).toEqual([{
      message: '@core.marketplace/issue.http-connection.host',
      messageParams: { workflow: 'wf-sync', step: 's1', connection: 'crm', host: 'evil.com' },
    }]);
    expect(messages(pkg('^2.123.0', [crm], [callApi('s1', 'crm', 'https://{tenant}.crm.com/x')]))).toEqual([]);
  });

  it('declaração repetida ou sem forma de credencial é recusada', () => {
    expect(messages(pkg('^2.123.0', [crm, crm]))).toEqual(['@core.marketplace/issue.http-connection.duplicate']);
    const semDominio = httpConnectionRequirementContribution({ key: 'crm', name: 'CRM', scheme: 'bearer', hosts: [] });
    expect(httpConnectionPackageIssues(pkg('^2.123.0', [semDominio]))).toContainEqual({
      message: '@core.marketplace/issue.http-connection.invalid',
      messageParams: { connection: 'crm', detail: '@core.automation/http-connection.issue.hosts-empty' },
    });
  });
});
