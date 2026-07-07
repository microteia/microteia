/**
 * Representa um operador built-in do expr-eval documentado para o usuário.
 * Diferente de ExpressionFunction, operadores não têm implementação customizada
 * (já estão no parser), servem apenas para documentação e autocomplete.
 */
export interface ExpressionOperator {
  /** Símbolo do operador (ex: '+', '==', '?:') */
  symbol: string;
  
  /** Nome descritivo (ex: 'Adição', 'Igual a') */
  name: string;
  
  /** Descrição do que o operador faz */
  description: string;
  
  /** Exemplo de uso (ex: 'a + b', 'x == 5') */
  usage: string;
  
  /** Exemplo concreto (ex: '10 + 5 → 15') */
  example: string;
  
  /** Categoria (Aritmético, Lógico, Comparação, Matemática) */
  category: string;
}

class OperatorRegistryImpl {
  private operators: Map<string, ExpressionOperator> = new Map();

  register(operator: ExpressionOperator): void {
    this.operators.set(operator.symbol, operator);
  }

  resolve(symbol: string): ExpressionOperator | undefined {
    return this.operators.get(symbol);
  }

  getAllDefinitions(): ExpressionOperator[] {
    return Array.from(this.operators.values());
  }
}

export const operatorRegistry = new OperatorRegistryImpl();
