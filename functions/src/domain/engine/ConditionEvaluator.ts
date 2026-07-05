import type { Condition } from '../entities/Workflow';

export const evaluateCondition = (condition: Condition): boolean => {
  if (condition.kind === 'AlwaysTrue') return true;
  throw new Error(`Tipo de condição não suportado: "${condition.kind}"`);
};
