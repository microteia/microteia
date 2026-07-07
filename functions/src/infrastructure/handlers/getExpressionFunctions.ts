import { onCall } from 'firebase-functions/v2/https';
import { expressionFunctions } from '../../domain/engine/expression/FunctionRegistry';

export const getExpressionFunctions = onCall(
  { region: 'us-central1', cors: true },
  async () => {
    const definitions = expressionFunctions.getAllDefinitions();
    
    // Adicionar operadores matemáticos que não estão no registry mas são suportados
    const operators = [
      {
        name: '+',
        description: 'Soma números ou adiciona dias a uma data',
        signature: 'a + b',
        example: 'today() + 5',
        category: 'Operador',
      },
      {
        name: '-',
        description: 'Subtrai números ou remove dias de uma data',
        signature: 'a - b',
        example: 'today() - 3',
        category: 'Operador',
      },
    ];

    return {
      functions: [...definitions, ...operators],
    };
  },
);
