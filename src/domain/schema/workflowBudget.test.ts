import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS,
  WORKFLOW_BUDGET_MARGIN_SECONDS,
  WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS,
  workflowBudgetProperty,
  workflowDeadlineAt,
} from './workflowBudget';
import { validateSettingValue } from './settings';

const START = 1_000_000;

describe('orçamento de tempo da execução', () => {
  it('sem configuração, vale o padrão: 300 s no evento e 60 s no botão', () => {
    expect(workflowDeadlineAt('event', START, undefined)).toBe(START + 300_000);
    expect(workflowDeadlineAt('action', START, undefined)).toBe(START + 60_000);
  });

  it('usa o valor configurado pelo escritório', () => {
    expect(workflowDeadlineAt('event', START, 120)).toBe(START + 120_000);
    expect(workflowDeadlineAt('action', START, 30)).toBe(START + 30_000);
  });

  it('valor fora da faixa ou de outro tipo cai no padrão — nunca fica sem limite', () => {
    expect(workflowDeadlineAt('event', START, 5)).toBe(START + 300_000);
    expect(workflowDeadlineAt('event', START, 99_999)).toBe(START + 300_000);
    expect(workflowDeadlineAt('action', START, '90')).toBe(START + 60_000);
    expect(workflowDeadlineAt('action', START, Number.NaN)).toBe(START + 60_000);
  });

  it('no teto, reserva a folga para gravar a execução antes de a plataforma encerrar a function', () => {
    expect(workflowDeadlineAt('event', START, WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS))
      .toBe(START + (WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS - WORKFLOW_BUDGET_MARGIN_SECONDS) * 1000);
    expect(workflowDeadlineAt('action', START, WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS))
      .toBe(START + (WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS - WORKFLOW_BUDGET_MARGIN_SECONDS) * 1000);
  });

  it('a tela recusa o que a function não honraria: o máximo de cada porta é o teto dela', () => {
    expect(validateSettingValue(workflowBudgetProperty('event'), WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS)).toBeNull();
    expect(validateSettingValue(workflowBudgetProperty('event'), WORKFLOW_EVENT_TIMEOUT_CEILING_SECONDS + 1)).not.toBeNull();
    expect(validateSettingValue(workflowBudgetProperty('action'), WORKFLOW_ACTION_TIMEOUT_CEILING_SECONDS + 1)).not.toBeNull();
    expect(workflowBudgetProperty('event').scopes).toEqual(['tenant']);
    expect(workflowBudgetProperty('action').scopes).toEqual(['tenant']);
  });
});
