import { describe, expect, it } from 'vitest';
import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { WorkflowStep } from '../../entities/Workflow';
import { workflowStepIssues } from './workflowIntegrity';

/**
 * Cada caso aqui é um defeito que COMPILAVA e passava por toda a validação de pacote, e só falava no
 * log do motor com o fluxo em execução. A lista saiu do comentário de
 * `scripts/declarativeWorkflow.test.ts`, que já a tinha escrito anos antes de alguém a reprovar.
 */

const pacote = (steps: WorkflowStep[], dependencies?: Record<string, string>): MarketplacePlugin =>
  ({
    manifest: {
      id: 'com.example.test',
      version: '1.0.0',
      kernel: '^2.0.0',
      name: 'Test',
      ...(dependencies ? { dependencies } : {}),
    },
    summary: 'Teste',
    workflows: [{
      templateId: 'wf-teste',
      name: 'Teste',
      description: 'Teste',
      eventName: 'records.saved',
      version: 1,
      steps,
    }],
  } as unknown as MarketplacePlugin);

const mensagens = (steps: WorkflowStep[], dependencies?: Record<string, string>): string[] =>
  workflowStepIssues(pacote(steps, dependencies)).map((issue) => issue.message);

const passo = (extra: Partial<WorkflowStep>): WorkflowStep => ({
  id: 'p1',
  stepDefinitionId: 'notify',
  type: 'Action',
  order: 0,
  enabled: true,
  configuration: {
    title: { kind: 'Literal', value: 'Oi' },
    message: { kind: 'Literal', value: 'Olá' },
  },
  ...extra,
} as WorkflowStep);

describe('integridade de passo de automação', () => {
  it('um passo correto não gera problema nenhum', () => {
    expect(mensagens([passo({})])).toEqual([]);
  });

  it('reprova o id de passo que não existe no catálogo', () => {
    expect(mensagens([passo({ stepDefinitionId: 'notificar' })]))
      .toContain('@core.marketplace/issue.step.unknown-definition');
  });

  it('aceita o id desconhecido quando o pacote declara dependência — o passo pode ser de outra extensão', () => {
    expect(mensagens([passo({ stepDefinitionId: 'x.custom' })], { 'com.other.ext': '^1.0.0' }))
      .toEqual([]);
  });

  it('reprova a entrada obrigatória ausente', () => {
    expect(mensagens([passo({ configuration: { title: { kind: 'Literal', value: 'Oi' } } })]))
      .toContain('@core.marketplace/issue.step.missing-input');
  });

  it('reprova a entrada que o passo não tem', () => {
    const issues = mensagens([passo({
      configuration: {
        title: { kind: 'Literal', value: 'Oi' },
        message: { kind: 'Literal', value: 'Olá' },
        severidade: { kind: 'Literal', value: 'ALTA' },
      },
    })]);
    expect(issues).toContain('@core.marketplace/issue.step.unknown-input');
  });

  it('reprova o valor cru onde se espera um InputMapping', () => {
    expect(mensagens([passo({
      configuration: { title: 'Oi', message: { kind: 'Literal', value: 'Olá' } },
    } as unknown as Partial<WorkflowStep>)]))
      .toContain('@core.marketplace/issue.step.input-not-mapping');
  });

  it('reprova o kind de mapping que a entrada não aceita', () => {
    // `set-variable.name` só aceita Literal: o nome da variável tem de ser conhecido em design-time.
    expect(mensagens([passo({
      stepDefinitionId: 'set-variable',
      configuration: {
        name: { kind: 'Expression', expression: 'concat("a", "b")' },
        value: { kind: 'Literal', value: 1 },
      },
    })]))
      .toContain('@core.marketplace/issue.step.mapping-kind');
  });

  it('reprova o nome de variável que o motor recusaria', () => {
    expect(mensagens([passo({
      stepDefinitionId: 'set-variable',
      configuration: {
        name: { kind: 'Literal', value: 'class' },
        value: { kind: 'Literal', value: 1 },
      },
    })]))
      .toContain('@core.marketplace/issue.step.input-invalid');
  });

  it('reprova o tipo Delay, que esta versão não executa', () => {
    expect(mensagens([passo({ type: 'Delay', stepDefinitionId: '' })]))
      .toContain('@core.marketplace/issue.step.type-unimplemented');
  });

  it('reprova o passo que não nomeia entrada de catálogo nenhuma', () => {
    expect(mensagens([passo({ stepDefinitionId: '' })]))
      .toContain('@core.marketplace/issue.step.no-definition');
  });

  it('o nó de controle Condition sem condição é reprovado; com condição, passa', () => {
    expect(mensagens([passo({ type: 'Condition', stepDefinitionId: '', configuration: {} })]))
      .toContain('@core.marketplace/issue.step.control-incomplete');

    expect(mensagens([passo({
      type: 'Condition',
      stepDefinitionId: '',
      configuration: {},
      condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: [], whenFalse: [] },
    })])).toEqual([]);
  });

  it('reprova a saída lida de um passo que não existe', () => {
    expect(mensagens([passo({
      configuration: {
        title: { kind: 'Output', stepId: 'inexistente', outputId: 'id' },
        message: { kind: 'Literal', value: 'Olá' },
      },
    })]))
      .toContain('@core.marketplace/issue.step.output-unknown-step');
  });

  it('reprova a saída que o passo-alvo não publica', () => {
    const issues = mensagens([
      passo({
        id: 'gravar',
        stepDefinitionId: 'upsert',
        configuration: { upsert: { kind: 'Literal', value: { table: 'records', source: 'event' } } },
      }),
      passo({
        id: 'avisar',
        configuration: {
          title: { kind: 'Output', stepId: 'gravar', outputId: 'quantidade' },
          message: { kind: 'Literal', value: 'Olá' },
        },
      }),
    ]);
    expect(issues).toContain('@core.marketplace/issue.step.output-unknown-id');
  });

  it('aceita a saída que o passo-alvo publica de fato', () => {
    expect(mensagens([
      passo({
        id: 'gravar',
        stepDefinitionId: 'upsert',
        configuration: { upsert: { kind: 'Literal', value: { table: 'records', source: 'event' } } },
      }),
      passo({
        id: 'avisar',
        configuration: {
          title: { kind: 'Output', stepId: 'gravar', outputId: 'id' },
          message: { kind: 'Literal', value: 'Olá' },
        },
      }),
    ])).toEqual([]);
  });

  it('não reprova saída de passo com saídas dinâmicas — o nome só existe em runtime', () => {
    expect(mensagens([
      passo({
        id: 'buscar',
        stepDefinitionId: 'query',
        configuration: { query: { kind: 'Literal', value: { table: 'records' } } },
      }),
      passo({
        id: 'avisar',
        configuration: {
          title: { kind: 'Output', stepId: 'buscar', outputId: 'first.title' },
          message: { kind: 'Literal', value: 'Olá' },
        },
      }),
    ])).toEqual([]);
  });

  it('alcança os passos dentro de ramos e de repetição', () => {
    expect(mensagens([passo({
      type: 'Condition',
      stepDefinitionId: '',
      configuration: {},
      condition: { kind: 'AlwaysTrue' },
      branches: {
        whenTrue: [passo({ id: 'dentro', stepDefinitionId: 'inexistente' })],
        whenFalse: [],
      },
    })]))
      .toContain('@core.marketplace/issue.step.unknown-definition');
  });

  it('a entrada obrigatória com defaultValue não é cobrada', () => {
    // `register-audit.severity` é obrigatória e tem `defaultValue: 'LOW'`.
    expect(mensagens([passo({
      stepDefinitionId: 'register-audit',
      configuration: {
        title: { kind: 'Literal', value: 'Oi' },
        message: { kind: 'Literal', value: 'Olá' },
      },
    })])).toEqual([]);
  });

  it('aceita os inputs dinâmicos `param.*` de call-workflow', () => {
    expect(mensagens([passo({
      stepDefinitionId: 'call-workflow',
      configuration: {
        targetWorkflowId: { kind: 'Literal', value: 'wf-outro' },
        'param.cliente': { kind: 'Event', path: 'id' },
      },
    })])).toEqual([]);
  });
});

describe('integridade do gatilho de horário', () => {
  const agendada = (schedule: unknown): MarketplacePlugin => {
    const base = pacote([]);
    return {
      ...base,
      manifest: { ...base.manifest, kernel: '^2.32.0' },
      workflows: [{ ...base.workflows[0], eventName: 'schedule', schedule }],
    } as unknown as MarketplacePlugin;
  };

  it('aceita o horário que o relógio lê', () => {
    expect(workflowStepIssues(agendada({ cron: '0 8 * * MON-FRI' }))).toEqual([]);
  });

  it('recusa o horário ausente, inválido ou frequente demais, dizendo o motivo', () => {
    for (const [schedule, detail] of [
      [undefined, '@core.automation/schedule.missing'],
      [{ cron: 'todo dia às 8' }, '@core.automation/schedule.cron-invalid'],
      [{ cron: '* * * * *' }, '@core.automation/schedule.too-frequent'],
    ] as const) {
      const [issue] = workflowStepIssues(agendada(schedule));
      expect(issue?.message).toBe('@core.marketplace/issue.workflow.schedule-invalid');
      expect(issue?.messageParams?.detail).toBe(detail);
    }
  });

  it('não olha `schedule` em automação que não é de horário', () => {
    const base = pacote([]);
    const outra = { ...base, workflows: [{ ...base.workflows[0], schedule: { cron: 'x' } }] } as unknown as MarketplacePlugin;
    expect(workflowStepIssues(outra)).toEqual([]);
  });
});

describe('integridade do gatilho de data', () => {
  const comData = (eventName: string, dateReached: unknown, kernel = '^2.33.0'): MarketplacePlugin => {
    const base = pacote([]);
    return {
      ...base,
      manifest: { ...base.manifest, kernel },
      screens: [{
        key: 'prazo',
        fields: [
          { key: 'dueDate', label: 'Vencimento', type: 'date' },
          { key: 'title', label: 'Título', type: 'text' },
        ],
      }],
      workflows: [{ ...base.workflows[0], eventName, dateReached }],
    } as unknown as MarketplacePlugin;
  };

  it('aceita o campo de data da tela do pacote', () => {
    expect(workflowStepIssues(comData('prazo.dateReached', { field: 'dueDate', offset: '-3d' }))).toEqual([]);
  });

  it('recusa o campo que não é de data da tela, e o deslocamento malformado', () => {
    const details = workflowStepIssues(comData('prazo.dateReached', { field: 'title', offset: '3' }))
      .map((issue) => issue.messageParams?.detail);
    expect(details).toEqual(['@core.automation/date-reached.field-not-date', '@core.automation/date-reached.offset-invalid']);
  });

  it('a tela de fora do pacote tem só a forma conferida', () => {
    expect(workflowStepIssues(comData('case.dateReached', { field: 'qualquer', offset: '0d' }))).toEqual([]);
  });

  it('cobra o intervalo de kernel que inclui um kernel anterior ao relógio', () => {
    const [issue] = workflowStepIssues(comData('prazo.dateReached', { field: 'dueDate', offset: '0d' }, '^2.32.0'));
    expect(issue?.message).toBe('@core.marketplace/issue.workflow.trigger-kernel');
    expect(issue?.messageParams?.minimum).toBe('2.33.0');
  });
});
