import { onCall } from 'firebase-functions/v2/https';
import { expressionFunctions } from '../../domain/engine/expression/FunctionRegistry';
import { operatorRegistry } from '../../domain/engine/expression/OperatorRegistry';

export const getExpressionFunctions = onCall(
  { region: 'us-central1', cors: true },
  async () => {
    const functionDefinitions = expressionFunctions.getAllDefinitions();
    const operatorDefinitions = operatorRegistry.getAllDefinitions();

    // Retorna funções e operadores como "functions" (compatibilidade com frontend)
    // Operadores são convertidos para o formato de função para exibição
    const operatorsAsFunctions = operatorDefinitions.map((op) => ({
      name: op.symbol,
      description: op.description,
      signature: op.usage,
      example: op.example,
      category: op.category,
    }));

    return {
      functions: [...functionDefinitions, ...operatorsAsFunctions],
    };
  },
);
