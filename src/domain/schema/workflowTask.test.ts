import { describe, it, expect } from 'vitest';
import { approvalOutcomesOf, DEFAULT_APPROVAL_OUTCOMES, workflowTaskId } from './workflowTask';

describe('approvalOutcomesOf', () => {
  it('sem desfecho declarado, aprovar e recusar', () => {
    expect(approvalOutcomesOf(undefined)).toEqual(DEFAULT_APPROVAL_OUTCOMES);
    expect(approvalOutcomesOf([])).toEqual(DEFAULT_APPROVAL_OUTCOMES);
  });

  it('a chave sai do texto do escritório, sem acento e com hífen; o rótulo fica como foi digitado', () => {
    expect(approvalOutcomesOf(['Aprovar com ressalva', 'Não aprovar'])).toEqual([
      { key: 'aprovar-com-ressalva', label: 'Aprovar com ressalva' },
      { key: 'nao-aprovar', label: 'Não aprovar' },
    ]);
  });

  it('repetidos e vazios saem', () => {
    expect(approvalOutcomesOf(['Sim', ' sim ', '', 'Não']).map((one) => one.key)).toEqual(['sim', 'nao']);
  });
});

describe('workflowTaskId', () => {
  it('é um por execução e por passo — a nova tentativa acha a mesma tarefa', () => {
    expect(workflowTaskId('ex1', 'aprovar')).toBe(workflowTaskId('ex1', 'aprovar'));
    expect(workflowTaskId('ex1', 'aprovar')).not.toBe(workflowTaskId('ex1', 'revisar'));
  });
});
