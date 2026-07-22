import { onCall } from 'firebase-functions/v2/https';
import { loadedExpressionFunctions } from '../../domain/engine/expression/ExpressionEngine';
import { operatorRegistry } from '../../domain/engine/expression/OperatorRegistry';

export const getExpressionFunctions = onCall(
  { region: 'southamerica-east1', cors: true },
  async () => {
    const functionDefinitions = loadedExpressionFunctions().getAllDefinitions();
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
