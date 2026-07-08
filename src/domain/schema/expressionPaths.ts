import { Parser } from 'expr-eval';

export const extractExpressionPaths = (expression: string): string[] => {
  try {
    const parsed = new Parser().parse(expression);
    const variables = parsed.variables({ withMembers: true }) as string[];
    return [...new Set(variables.filter((name) => name === 'event' || name.startsWith('event.')))];
  } catch {
    return [];
  }
};
