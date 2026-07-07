import type { ExpressionFunction } from '../FunctionRegistry';

export const concatFn: ExpressionFunction = {
  name: 'concat',
  call: (args) => args.map((arg) => String(arg)).join(''),
  description: 'Concatena valores em uma string',
  signature: 'concat(valor1, valor2, ...)',
  example: 'concat("Processo ", "123")',
  category: 'Texto',
};

export const lowerFn: ExpressionFunction = {
  name: 'lower',
  call: ([value]) => String(value).toLowerCase(),
  description: 'Converte texto para minúsculas',
  signature: 'lower(texto)',
  example: 'lower("TEXTO")',
  category: 'Texto',
};

export const upperFn: ExpressionFunction = {
  name: 'upper',
  call: ([value]) => String(value).toUpperCase(),
  description: 'Converte texto para MAIÚSCULAS',
  signature: 'upper(texto)',
  example: 'upper("texto")',
  category: 'Texto',
};

export const lengthFn: ExpressionFunction = {
  name: 'length',
  call: ([value]) => {
    if (typeof value === 'string' || Array.isArray(value)) return value.length;
    return 0;
  },
  description: 'Retorna o tamanho de um texto ou array',
  signature: 'length(valor)',
  example: 'length("texto")',
  category: 'Texto',
};

export const trimFn: ExpressionFunction = {
  name: 'trim',
  call: ([value]) => String(value).trim(),
  description: 'Remove espaços em branco do início e fim do texto',
  signature: 'trim(texto)',
  example: 'trim("  texto  ")',
  category: 'Texto',
};

export const replaceFn: ExpressionFunction = {
  name: 'replace',
  call: ([text, search, replacement]) => {
    if (typeof text !== 'string' || typeof search !== 'string' || typeof replacement !== 'string') {
      throw new Error('replace: todos os argumentos devem ser strings');
    }
    return text.replace(new RegExp(search, 'g'), replacement);
  },
  description: 'Substitui todas as ocorrências de um texto por outro',
  signature: 'replace(texto, busca, substituição)',
  example: 'replace("foo bar foo", "foo", "baz")',
  category: 'Texto',
};

export const substringFn: ExpressionFunction = {
  name: 'substring',
  call: ([text, start, end]) => {
    if (typeof text !== 'string') {
      throw new Error('substring: primeiro argumento deve ser uma string');
    }
    if (typeof start !== 'number') {
      throw new Error('substring: segundo argumento deve ser um número');
    }
    if (end !== undefined && typeof end !== 'number') {
      throw new Error('substring: terceiro argumento deve ser um número');
    }
    return end === undefined ? text.substring(start) : text.substring(start, end);
  },
  description: 'Extrai parte de um texto entre dois índices',
  signature: 'substring(texto, início, fim?)',
  example: 'substring("processo", 0, 4)',
  category: 'Texto',
};

export const startsWithFn: ExpressionFunction = {
  name: 'startsWith',
  call: ([text, prefix]) => {
    if (typeof text !== 'string' || typeof prefix !== 'string') {
      throw new Error('startsWith: ambos os argumentos devem ser strings');
    }
    return text.startsWith(prefix);
  },
  description: 'Verifica se o texto começa com um prefixo',
  signature: 'startsWith(texto, prefixo)',
  example: 'startsWith("processo", "proc")',
  category: 'Texto',
};

export const endsWithFn: ExpressionFunction = {
  name: 'endsWith',
  call: ([text, suffix]) => {
    if (typeof text !== 'string' || typeof suffix !== 'string') {
      throw new Error('endsWith: ambos os argumentos devem ser strings');
    }
    return text.endsWith(suffix);
  },
  description: 'Verifica se o texto termina com um sufixo',
  signature: 'endsWith(texto, sufixo)',
  example: 'endsWith("arquivo.pdf", ".pdf")',
  category: 'Texto',
};

export const splitFn: ExpressionFunction = {
  name: 'split',
  call: ([text, separator]) => {
    if (typeof text !== 'string' || typeof separator !== 'string') {
      throw new Error('split: ambos os argumentos devem ser strings');
    }
    return text.split(separator);
  },
  description: 'Divide um texto em um array usando um separador',
  signature: 'split(texto, separador)',
  example: 'split("a,b,c", ",")',
  category: 'Texto',
};

export const joinFn: ExpressionFunction = {
  name: 'join',
  call: ([array, separator = '']) => {
    if (!Array.isArray(array)) {
      throw new Error('join: primeiro argumento deve ser um array');
    }
    if (typeof separator !== 'string') {
      throw new Error('join: segundo argumento deve ser uma string');
    }
    return array.map((item) => String(item)).join(separator);
  },
  description: 'Junta os elementos de um array em uma string',
  signature: 'join(array, separador?)',
  example: 'join(["a", "b", "c"], ", ")',
  category: 'Texto',
};

export const interpolateFn: ExpressionFunction = {
  name: 'interpolate',
  call: ([template, data]) => {
    if (typeof template !== 'string') {
      throw new Error('interpolate: primeiro argumento deve ser uma string (template)');
    }
    
    if (data === null || data === undefined) {
      throw new Error('interpolate: segundo argumento (dados) não pode ser nulo ou indefinido');
    }
    
    if (typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('interpolate: segundo argumento deve ser um objeto com propriedades');
    }

    return template.replace(/\{([\w.]+)\}/g, (match, key: string) => {
      // Resolve caminhos aninhados como 'user.name' ou 'event.payload.id'
      const value = key.split('.').reduce<unknown>((obj, prop) => {
        if (obj === null || obj === undefined) return undefined;
        if (typeof obj !== 'object') return undefined;
        return (obj as Record<string, unknown>)[prop];
      }, data);

      // Converte para string, tratando valores especiais
      if (value === null || value === undefined) {
        return ''; // Substitui por string vazia se não encontrado
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value); // Serializa objetos/arrays
      }
      
      return String(value);
    });
  },
  description: 'Substitui {chaves} em um template pelos valores correspondentes de um objeto',
  signature: 'interpolate(template, dados)',
  example: 'interpolate("Olá, {nome}!", {nome: "João"})',
  category: 'Texto',
};
