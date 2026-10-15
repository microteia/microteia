import { describe, expect, it } from 'vitest';
import type { ActionModuleTemplate, MarketplacePlugin } from '../../entities/MarketplacePlugin';
import { packageActionIssues } from './pluginActions';
import { actionInputFromTemplate } from './packageMaterialize';
import { packageIssues } from './pluginReferences';

const base = (actions: ActionModuleTemplate[]): MarketplacePlugin => ({
  summary: 'x',
  manifest: { id: 'com.acme.x', version: '1.0.0', kernel: '^2.0.0', name: 'X' },
  workflows: [{ templateId: 'wf', name: 'W', steps: [] } as unknown as MarketplacePlugin['workflows'][number]],
  actions,
});

const common = { title: 't', icon: 'check', order: 0, enabled: true, danger: false };

describe('a ação precisa executar alguma coisa', () => {
  it('aceita a ação de fluxo e a de comando sem workflowId', () => {
    expect(packageActionIssues(base([
      { templateId: 'a', key: 'a', workflowId: 'wf', ...common },
      { templateId: 'b', key: 'b', command: 'copyLink', ...common },
    ]))).toEqual([]);
  });

  it('aceita o pacote antigo, com workflowId vazio ao lado do comando', () => {
    expect(packageActionIssues(base([{ templateId: 'a', key: 'a', workflowId: '', command: 'clone', ...common }]))).toEqual([]);
  });

  it('recusa a ação sem nenhum dos dois, dizendo qual e onde — também pela porta do pacote', () => {
    const pkg = base([
      { templateId: 'a', key: 'a', workflowId: 'wf', ...common },
      { templateId: 'b', key: 'vazia', workflowId: '  ', command: null, ...common },
    ]);
    const issue = {
      message: '@core.marketplace/issue.package.action.no-target',
      messageParams: { key: 'vazia', where: 'actions[1]' },
    };
    expect(packageActionIssues(pkg)).toEqual([issue]);
    expect(packageIssues(pkg)).toContainEqual(issue);
  });
});

describe('a ação só de comando instala com workflowId vazio', () => {
  it('grava workflowId "" e preserva o comando', () => {
    const input = actionInputFromTemplate(
      { templateId: 'b', key: 'b', command: 'copyLink', ...common },
      'com.acme.x',
      new Map(),
      'uid',
    );
    expect(input.workflowId).toBe('');
    expect(input.command).toBe('copyLink');
  });

  it('continua remapeando o workflowId do pacote', () => {
    const input = actionInputFromTemplate(
      { templateId: 'a', key: 'a', workflowId: 'wf', ...common },
      'com.acme.x',
      new Map([['wf', 'installed-wf']]),
      'uid',
    );
    expect(input.workflowId).toBe('installed-wf');
  });
});
