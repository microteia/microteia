import type { ExpressionFunction } from '../FunctionRegistry';

export const objectFn: ExpressionFunction = {
  name: 'object',
  call: (args) => {
    if (args.length % 2 !== 0) {
      throw new Error('object: número de argumentos deve ser par (pares chave/valor)');
    }
    const result: Record<string, unknown> = {};
    for (let i = 0; i + 1 < args.length; i += 2) {
      result[String(args[i])] = args[i + 1];
    }
    return result;
  },
  description: 'Constrói um objeto a partir de pares chave/valor',
  signature: 'object(chave, valor, ...)',
  example: 'object("nome", event.client.nome, "message", "olá")',
  category: 'Operador',
  minArgs: 0,
};

export const deleteFn: ExpressionFunction = {
  name: 'delete',
  call: ([key, obj]) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }
    const clone = { ...(obj as Record<string, unknown>) };
    delete clone[String(key)];
    return clone;
  },
  description: 'Remove uma propriedade de um objeto, devolvendo uma cópia sem alterá-lo',
  signature: 'delete(chave, objeto)',
  example: 'delete("nome", event)',
  category: 'Operador',
  minArgs: 2,
  maxArgs: 2,
};
