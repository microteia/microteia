import { describe, it, expect } from 'vitest';
import type { WorkflowStep } from '../../entities/Workflow';
import type { ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import {
  actionInputFromTemplate,
  buildScreenEventMap,
  rewriteStepLiteral,
  scriptInputFromTemplate,
  workflowInputFromTemplate,
  buildScreenCollectionMap,
} from './packageMaterialize';

const step = (inputId: string, value: string, extra: Partial<WorkflowStep> = {}): WorkflowStep => ({
  id: 's',
  stepDefinitionId: 'x',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: { [inputId]: { kind: 'Literal', value } },
  ...extra,
});

describe('rewriteStepLiteral', () => {
  const map = new Map([['tpl', 'real']]);

  it('reescreve o Literal do input pelo id mapeado', () => {
    const [out] = rewriteStepLiteral([step('scriptId', 'tpl')], 'scriptId', map);
    expect((out.configuration.scriptId as { value: string }).value).toBe('real');
  });

  it('deixa intacto o que não está no mapa', () => {
    const [out] = rewriteStepLiteral([step('scriptId', 'desconhecido')], 'scriptId', map);
    expect((out.configuration.scriptId as { value: string }).value).toBe('desconhecido');
  });

  /**
   * A referência a outra extensão já é universal, e é o motor que a resolve por nome. Reescrevê-la
   * para o id local de hoje é o que a deixaria pendurada quando a extensão dona fosse reinstalada.
   * Antes o comportamento certo dependia de o mapa ERRAR; agora é a guarda que o garante.
   */
  it('NÃO toca numa referência qualificada, nem quando o mapa tem aquele valor', () => {
    const armadilha = new Map([['com.acme.utils/normalizar-cpf', 'real']]);
    const [out] = rewriteStepLiteral(
      [step('scriptId', 'com.acme.utils/normalizar-cpf')],
      'scriptId',
      armadilha,
    );
    expect((out.configuration.scriptId as { value: string }).value).toBe('com.acme.utils/normalizar-cpf');
  });

  it('reescreve recursivamente em ramos e corpos de laço', () => {
    const nested: WorkflowStep = {
      id: 'ctrl', stepDefinitionId: '', type: 'Condition', order: 0, enabled: true, configuration: {},
      branches: { whenTrue: [step('scriptId', 'tpl')], whenFalse: [] },
    };
    const [out] = rewriteStepLiteral([nested], 'scriptId', map);
    expect((out.branches!.whenTrue[0].configuration.scriptId as { value: string }).value).toBe('real');
  });
});

describe('scriptInputFromTemplate', () => {
  it('remove templateId e marca o dono; sem undefined', () => {
    const input = scriptInputFromTemplate(
      { templateId: 't', name: 'S', sourceTs: 'a', compiledJs: 'b', inputParams: [], outputParams: [], description: undefined },
      'com.acme.x',
    );
    expect('templateId' in input).toBe(false);
    expect(input.ownerPluginId).toBe('com.acme.x');
    expect('description' in input).toBe(false);
  });
});

describe('workflowInputFromTemplate', () => {
  it('remove templateId, marca dono, nasce habilitado, reescreve scriptId e a tela do gatilho', () => {
    const input = workflowInputFromTemplate(
      {
        templateId: 't',
        name: 'W',
        eventName: 'venda.saved',
        version: 1,
        condition: { kind: 'AlwaysTrue' },
        steps: [step('scriptId', 'scr-tpl')],
      },
      'com.acme.x',
      new Map([['scr-tpl', 'scr-real']]),
      new Map([['venda', 'com-acme-x__venda']]),
    );
    expect('templateId' in input).toBe(false);
    expect(input.ownerPluginId).toBe('com.acme.x');
    expect(input.enabled).toBe(true);
    expect(input.eventName).toBe('com-acme-x__venda.saved');
    expect((input.steps[0].configuration.scriptId as { value: string }).value).toBe('scr-real');
  });

  it('o evento de nota ou documento acompanha a tela do pai quando a chave dela muda', () => {
    const template = { templateId: 't', name: 'W', version: 1, condition: { kind: 'AlwaysTrue' as const }, steps: [] };
    const screens = new Map([['venda', 'com-acme-x__venda']]);
    expect(workflowInputFromTemplate({ ...template, eventName: 'venda_document.saved' }, 'com.acme.x', new Map(), screens).eventName)
      .toBe('com-acme-x__venda_document.saved');
    expect(workflowInputFromTemplate({ ...template, eventName: 'outra_note.deleted' }, 'com.acme.x', new Map(), screens).eventName)
      .toBe('outra_note.deleted');
  });
});

/**
 * O gatilho é reescrito porque a CHAVE da tela pode mudar na instalação. Um prefixo declarado não
 * muda: é nome global, e reescrevê-lo faria a automação escutar um evento que ninguém publica.
 */
describe('buildScreenEventMap', () => {
  const screen = (overrides: Partial<ScreenModuleTemplate> & { key: string }): ScreenModuleTemplate => ({
    titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n',
    fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
    ...overrides,
  });

  it('mapeia a tela cujo evento leva a chave dela', () => {
    const map = buildScreenEventMap([screen({ key: 'venda' })], new Map([['venda', 'venda_2']]));
    expect(map.get('venda')).toBe('venda_2');
  });

  it('não toca no prefixo declarado, nem quando a chave da tela muda', () => {
    const map = buildScreenEventMap(
      [screen({ key: 'processos', dataCollection: 'cases', eventPrefix: 'case' })],
      new Map([['processos', 'processos_2']]),
    );
    expect(map.size).toBe(0);
  });

  it('a tela que descreve outra coleção emite por ela, não pela chave instalada', () => {
    const map = buildScreenEventMap(
      [screen({ key: 'kanban', dataCollection: 'cases' })],
      new Map([['kanban', 'kanban_2']]),
    );
    expect(map.size).toBe(0);
  });

  it('chave que atravessa a instalação intacta não vira reescrita', () => {
    const map = buildScreenEventMap([screen({ key: 'venda' })], new Map([['venda', 'venda']]));
    expect(map.size).toBe(0);
  });
});

describe('actionInputFromTemplate', () => {
  it('remove templateId, marca dono/createdBy e reescreve workflowId', () => {
    const input = actionInputFromTemplate(
      { templateId: 't', key: 'a', title: 'A', icon: 'apps', workflowId: 'wf-tpl', danger: false, enabled: true, order: 0 },
      'com.acme.x',
      new Map([['wf-tpl', 'wf-real']]),
      'u1',
    );
    expect('templateId' in input).toBe(false);
    expect(input.workflowId).toBe('wf-real');
    expect(input.ownerPluginId).toBe('com.acme.x');
    expect(input.createdBy).toBe('u1');
  });
});

describe('buildScreenCollectionMap', () => {
  const screen = (overrides: Partial<ScreenModuleTemplate> & { key: string }): ScreenModuleTemplate => ({
    titleSingular: 'T', titlePlural: 'T', icon: 'apps', titleFieldKey: 'n',
    fields: [{ key: 'n', label: 'N', type: 'text', required: true, order: 0 }],
    ...overrides,
  });

  it('a coleção de share-documents acompanha a tela que ganhou sufixo; a de nome global, não', () => {
    const map = buildScreenCollectionMap(
      [screen({ key: 'venda' }), screen({ key: 'pedido', dataCollection: 'orders' })],
      new Map([['venda', 'venda_2'], ['pedido', 'pedido_2']]),
    );
    expect([...map]).toEqual([['venda', 'venda_2']]);

    const shareStep = {
      id: 's', stepDefinitionId: 'share-documents', type: 'Action' as const, order: 0, enabled: true,
      configuration: { collection: { kind: 'Literal' as const, value: 'venda' } },
    };
    const input = workflowInputFromTemplate(
      { templateId: 't', name: 'W', eventName: 'venda.saved', version: 1, condition: { kind: 'AlwaysTrue' }, steps: [shareStep] },
      'com.acme.x',
      new Map(),
      new Map(),
      map,
    );
    expect(input.steps[0].configuration.collection).toEqual({ kind: 'Literal', value: 'venda_2' });
  });
});
