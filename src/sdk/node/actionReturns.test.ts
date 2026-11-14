import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { ALL_TRAVELLING_EXAMPLES } from '../../plugins/marketplace/travellingExamples';
import { actionReturnReport } from './actionReturns';

type Workflow = MarketplacePlugin['workflows'][number];
type Action = NonNullable<MarketplacePlugin['actions']>[number];

const answer = {
  id: 'answer', stepDefinitionId: 'map', type: 'Action', order: 9, enabled: true,
  configuration: { map: { kind: 'Literal', value: { fields: [{ name: 'status', value: { kind: 'Literal', value: 'SUCCESS' } }] } } },
} as const;

const save = {
  id: 'save', stepDefinitionId: 'upsert', type: 'Action', order: 0, enabled: true,
  configuration: { upsert: { kind: 'Literal', value: { table: 'items', source: 'input' } } },
} as const;

const flow = (steps: Workflow['steps'], parameters: Workflow['parameters'] = []): Workflow => ({
  templateId: 'wf-approve', name: 'Approve', eventName: 'workflow.called', version: 1,
  condition: { kind: 'AlwaysTrue' }, parameters, steps,
});

const button = (overrides: Partial<Action> = {}): Action => ({
  templateId: 'act-approve', key: 'approve', title: 'Approve', icon: 'check', workflowId: 'wf-approve',
  order: 0, enabled: true, danger: false, ...overrides,
} as Action);

/** A tela que põe a ação como botão — sem ela, a ação só é chamada por código. */
const screen = (cardActionIds: string[]) =>
  ({ key: 'items', cardActionIds }) as unknown as NonNullable<MarketplacePlugin['screens']>[number];

const pkg = (workflow: Workflow, action: Action, wiredAs: string[] = [action.templateId]): MarketplacePlugin => ({
  summary: '',
  manifest: { id: 'com.example.approvals', version: '1.0.0', kernel: '^2.0.0', name: 'Approvals' },
  workflows: [workflow],
  actions: [action],
  screens: [screen(wiredAs)],
});

describe('o contrato entre a action e o fluxo que ela dispara', () => {
  it('avisa o fluxo de botão que termina sem responder, nomeando o passo e a forma do retorno', () => {
    const [finding] = actionReturnReport(pkg(flow([save]), button()));
    expect(finding).toMatchObject({ action: 'approve', workflow: 'Approve', kind: 'no-return' });
    expect(finding.detail).toContain('step "save" (upsert)');
    expect(finding.detail).toContain('"result", "status", "actions"');
    expect(finding.detail).toContain('"SUCCESS", "WARNING", "ERROR"');
  });

  it('o fluxo que termina no map sem nome não é avisado', () => {
    expect(actionReturnReport(pkg(flow([save, answer]), button()))).toEqual([]);
  });

  it('parameterDefaults sem promptParameters nunca é aplicado, e o aviso aponta o recordId', () => {
    const findings = actionReturnReport(pkg(flow([save, answer]), button({ parameterDefaults: { requestId: 'id' } })));
    expect(findings.map((one) => one.kind)).toEqual(['defaults-without-prompt']);
    expect(findings[0].detail).toContain('"requestId"');
    expect(findings[0].detail).toContain('"recordId"');
  });

  it('o parâmetro obrigatório que o botão sem formulário não manda — e o do sistema não conta', () => {
    const parameters: Workflow['parameters'] = [
      { key: 'recordId', label: 'Record', type: 'EntityReference', required: true },
      { key: 'reason', label: 'Reason', type: 'String', required: true },
      { key: 'channel', label: 'Channel', type: 'String', required: true, defaultValue: 'email' },
    ];
    const findings = actionReturnReport(pkg(flow([save, answer], parameters), button()));
    expect(findings.map((one) => one.kind)).toEqual(['required-unsent']);
    expect(findings[0].detail).toContain('"reason"');
    expect(findings[0].detail).not.toContain('"channel"');
  });

  /**
   * A ação que nenhuma tela põe como botão é chamada por código, com `runAction({ params })` — o
   * "Finalizar Todos" dos Pushes manda a lista que a listagem montou. Não há botão sem formulário ali.
   */
  it('a ação que nenhuma tela põe como botão não é acusada de não mandar o parâmetro', () => {
    const parameters: Workflow['parameters'] = [{ key: 'items', label: 'Items', type: 'String', required: true }];
    expect(actionReturnReport(pkg(flow([save, answer], parameters), button(), []))).toEqual([]);
  });

  it('a ação pendurada por um complemento de tela continua sendo botão', () => {
    const parameters: Workflow['parameters'] = [{ key: 'items', label: 'Items', type: 'String', required: true }];
    const plugin: MarketplacePlugin = {
      ...pkg(flow([save, answer], parameters), button(), []),
      screenPatches: [{ target: 'persons', fields: [], viewActionIds: ['act-approve'] }],
    };
    expect(actionReturnReport(plugin).map((one) => one.kind)).toEqual(['required-unsent']);
  });

  it('com promptParameters, os parâmetros são do formulário e não há o que avisar', () => {
    const parameters: Workflow['parameters'] = [{ key: 'reason', label: 'Reason', type: 'String', required: true }];
    const action = button({ promptParameters: true, parameterDefaults: { reason: 'note' } });
    expect(actionReturnReport(pkg(flow([save, answer], parameters), action))).toEqual([]);
  });

  it('a ação de comando e a que aponta para o fluxo de outra extensão ficam de fora', () => {
    expect(actionReturnReport(pkg(flow([save]), button({ command: 'copyLink' })))).toEqual([]);
    expect(actionReturnReport(pkg(flow([save]), button({ workflowId: 'com.example.other/wf-approve' })))).toEqual([]);
  });

  /** O exemplo é o molde que o autor copia: um botão dele sem resposta ensinaria o defeito. */
  it('nenhum exemplo que viaja com o SDK deixa um botão sem resposta', () => {
    const findings = ALL_TRAVELLING_EXAMPLES.flatMap((plugin) =>
      actionReturnReport(plugin).map((one) => `${plugin.manifest.id} ${one.action}: ${one.kind}`));
    expect(findings).toEqual([]);
  });
});
