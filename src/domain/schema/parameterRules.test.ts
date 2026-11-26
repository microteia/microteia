import { describe, expect, it } from 'vitest';
import type { WorkflowParameter } from '../entities/Workflow';
import { parameterAdmissionIssues } from './parameterRules';

const reason: WorkflowParameter = {
  key: 'reason', label: 'Motivo', type: 'String', required: true, rules: { validate: { maxLength: 5 } },
};
const note: WorkflowParameter = { key: 'note', label: 'Nota', type: 'String', rules: { validate: { maxLength: 3 } } };

describe('parameterAdmissionIssues — o que a admissão da execução recusaria (#39)', () => {
  it('o obrigatório ausente ou vazio é recusado, e só com a queixa de obrigatório', () => {
    for (const data of [{}, { reason: '' }]) {
      const issues = parameterAdmissionIssues([reason], data);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ path: 'reason', error: '@core.automation/parameter.required' });
    }
  });

  it('o valor preenchido que viola a regra é recusado pela regra', () => {
    const issues = parameterAdmissionIssues([reason, note], { reason: 'longo demais', note: 'abcd' });
    expect(issues.map((issue) => issue.path)).toEqual(['reason', 'note']);
    expect(issues.every((issue) => issue.error !== '@core.automation/parameter.required')).toBe(true);
  });

  it('o que a admissão aceita passa — inclusive o opcional ausente', () => {
    expect(parameterAdmissionIssues([reason, note], { reason: 'ok' })).toEqual([]);
  });
});
