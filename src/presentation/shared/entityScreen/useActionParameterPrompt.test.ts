import { describe, expect, it } from 'vitest';
import { buildPromptInitialValues } from './useActionParameterPrompt';
import type { ActionExprContext } from '../../../domain/schema/actionExpression';
import type { ActionDefinition } from '../../../domain/entities';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';

const action = (over: Partial<ActionDefinition> = {}): ActionDefinition => ({
  id: 'act-push-gerar-prazo',
  tenantId: 't1',
  key: 'push_gerar_prazo',
  title: 'Gerar prazo',
  icon: 'time',
  workflowId: 'wf-push-gerar-prazo',
  danger: false,
  enabled: true,
  order: 0,
  createdAt: new Date(),
  createdBy: 'u1',
  updatedAt: new Date(),
  ...over,
});

const param = (key: string): WorkflowParameter => ({ key, label: key, type: 'String', required: false });

const context = (values: Record<string, unknown>): ActionExprContext => ({
  values,
  record: values,
  isNew: false,
  isDirty: false,
  role: 'admin',
  surface: 'list',
});

describe('buildPromptInitialValues', () => {
  it('o campo de MESMO NOME preenche o parâmetro, sem mapa nenhum', () => {
    const values = buildPromptInitialValues(action(), [param('type')], context({ type: 'Petição' }));
    expect(values).toEqual({ type: 'Petição' });
  });

  /** O caso que motivou o mapa: a tela guarda `processNumber`, o fluxo pede `caseNumber`. */
  it('a expressão declarada vence o casamento por nome', () => {
    const values = buildPromptInitialValues(
      action({ parameterDefaults: { caseNumber: 'processNumber' } }),
      [param('caseNumber')],
      context({ processNumber: '0801234-56.2024.8.05.0001', caseNumber: 'ignorado' }),
    );
    expect(values).toEqual({ caseNumber: '0801234-56.2024.8.05.0001' });
  });

  it('a expressão pode DERIVAR o valor, e não só copiar um campo', () => {
    const values = buildPromptInitialValues(
      action({ parameterDefaults: { description: 'concat("Gerado a partir do push: ", subject)' } }),
      [param('description')],
      context({ subject: 'Intimação' }),
    );
    expect(values).toEqual({ description: 'Gerado a partir do push: Intimação' });
  });

  /**
   * O formulário abre EM BRANCO no que não souber responder — nunca com `null` ou `undefined`
   * escrito no campo, que é o que o usuário leria como valor.
   */
  it('parâmetro sem expressão e sem campo correspondente não entra', () => {
    const values = buildPromptInitialValues(
      action({ parameterDefaults: { dueDate: '   ' } }),
      [param('dueDate'), param('priority')],
      context({ subject: 'Intimação', priority: null }),
    );
    expect(values).toEqual({});
  });

  it('expressão em branco cai no casamento por nome', () => {
    const values = buildPromptInitialValues(
      action({ parameterDefaults: { type: '' } }),
      [param('type')],
      context({ type: 'Recurso' }),
    );
    expect(values).toEqual({ type: 'Recurso' });
  });
});
