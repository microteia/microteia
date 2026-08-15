import type { ExpressionFunction } from '../FunctionRegistry';

export const concatFn: ExpressionFunction = {
  name: 'concat',
  call: (args) => args.map((arg) => String(arg)).join(''),
  description: '@core.automation/expr.concat.description',
  signature: 'concat(value1, value2, ...)',
  example: 'concat("Case ", "123")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
};

export const lowerFn: ExpressionFunction = {
  name: 'lower',
  call: ([value]) => String(value).toLowerCase(),
  description: '@core.automation/expr.lower.description',
  signature: 'lower(text)',
  example: 'lower("TEXTO")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

export const upperFn: ExpressionFunction = {
  name: 'upper',
  call: ([value]) => String(value).toUpperCase(),
  description: '@core.automation/expr.upper.description',
  signature: 'upper(text)',
  example: 'upper("text")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

/**
 * Só é alcançada porque o operador `length` é DESLIGADO nas configurações de parser — o built-in do
 * `expr-eval` respondia antes e transformava `null` em `"null"`, devolvendo 4 para um campo vazio.
 * Aqui vazio é 0, que é o que `length(campo) > 0` sempre quis dizer.
 */
export const lengthFn: ExpressionFunction = {
  name: 'length',
  call: ([value]) => {
    if (value === null || value === undefined) return 0;
    if (Array.isArray(value)) return value.length;
    return String(value).length;
  },
  description: '@core.automation/expr.length.description',
  signature: 'length(value)',
  example: 'length("text")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

export const trimFn: ExpressionFunction = {
  name: 'trim',
  call: ([value]) => String(value).trim(),
  description: '@core.automation/expr.trim.description',
  signature: 'trim(text)',
  example: 'trim("  text  ")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

export const replaceFn: ExpressionFunction = {
  name: 'replace',
  call: ([text, search, replacement]) => {
    if (typeof text !== 'string' || typeof search !== 'string' || typeof replacement !== 'string') {
      throw new Error('replace: todos os argumentos devem ser strings');
    }
    if (search === '') return text;
    return text.split(search).join(replacement);
  },
  description: '@core.automation/expr.replace.description',
  signature: 'replace(text, search, replacement)',
  example: 'replace("foo bar foo", "foo", "baz")',
  category: '@core.automation/expr.category.text',
  minArgs: 3,
  maxArgs: 3,
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
  description: '@core.automation/expr.substring.description',
  signature: 'substring(text, start, end?)',
  example: 'substring("processo", 0, 4)',
  category: '@core.automation/expr.category.text',
  minArgs: 2,
  maxArgs: 3,
};

export const startsWithFn: ExpressionFunction = {
  name: 'startsWith',
  call: ([text, prefix]) => {
    if (typeof text !== 'string' || typeof prefix !== 'string') {
      throw new Error('startsWith: ambos os argumentos devem ser strings');
    }
    return text.startsWith(prefix);
  },
  description: '@core.automation/expr.startsWith.description',
  signature: 'startsWith(text, prefix)',
  example: 'startsWith("processo", "proc")',
  category: '@core.automation/expr.category.text',
  minArgs: 2,
  maxArgs: 2,
};

export const endsWithFn: ExpressionFunction = {
  name: 'endsWith',
  call: ([text, suffix]) => {
    if (typeof text !== 'string' || typeof suffix !== 'string') {
      throw new Error('endsWith: ambos os argumentos devem ser strings');
    }
    return text.endsWith(suffix);
  },
  description: '@core.automation/expr.endsWith.description',
  signature: 'endsWith(text, suffix)',
  example: 'endsWith("arquivo.pdf", ".pdf")',
  category: '@core.automation/expr.category.text',
  minArgs: 2,
  maxArgs: 2,
};

export const splitFn: ExpressionFunction = {
  name: 'split',
  call: ([text, separator]) => {
    if (typeof text !== 'string' || typeof separator !== 'string') {
      throw new Error('split: ambos os argumentos devem ser strings');
    }
    return text.split(separator);
  },
  description: '@core.automation/expr.split.description',
  signature: 'split(text, separator)',
  example: 'split("a,b,c", ",")',
  category: '@core.automation/expr.category.text',
  minArgs: 2,
  maxArgs: 2,
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
  description: '@core.automation/expr.join.description',
  signature: 'join(array, separator?)',
  example: 'join(["a", "b", "c"], ", ")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 2,
};

export const onlyNumberFn: ExpressionFunction = {
  name: 'onlyNumber',
  call: ([value]) => {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\D/g, '');
  },
  description: '@core.automation/expr.onlyNumber.description',
  signature: 'onlyNumber(value)',
  example: 'onlyNumber("123.aaa.bb-fff.45")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 1,
};

const moneyLocales: Record<string, { locale: string; currency: string }> = {
  'pt-br': { locale: 'pt-BR', currency: 'BRL' },
  'en-us': { locale: 'en-US', currency: 'USD' },
  'en-gb': { locale: 'en-GB', currency: 'GBP' },
  'es-es': { locale: 'es-ES', currency: 'EUR' },
};

export const formatMoneyFn: ExpressionFunction = {
  name: 'formatMoney',
  call: ([value, locale = 'pt-br']) => {
    const amount = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(amount)) {
      throw new Error('formatMoney: primeiro argumento deve ser um número');
    }
    if (typeof locale !== 'string') {
      throw new Error('formatMoney: segundo argumento deve ser uma string');
    }
    const config = moneyLocales[locale.toLowerCase()] ?? moneyLocales['pt-br'];
    return new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.currency })
      .format(amount)
      .replace(/[\u00A0\u202F]/g, ' ');
  },
  description: '@core.automation/expr.formatMoney.description',
  signature: 'formatMoney(value, locale?)',
  example: 'formatMoney(123.90, "pt-br")',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
  maxArgs: 2,
};

export const interpolateFn: ExpressionFunction = {
  name: 'interpolate',
  call: ([template, ...values]) => {
    if (typeof template !== 'string') {
      throw new Error('interpolate: primeiro argumento deve ser uma string (template)');
    }

    const namedSource =
      values.length === 1 && values[0] !== null && typeof values[0] === 'object' && !Array.isArray(values[0])
        ? (values[0] as Record<string, unknown>)
        : null;

    return template.replace(/\{([\w.]+)\}/g, (_match, token: string) => {
      const value = /^\d+$/.test(token)
        ? values[Number(token)]
        : token.split('.').reduce<unknown>((obj, prop) => {
            if (obj === null || typeof obj !== 'object') return undefined;
            return (obj as Record<string, unknown>)[prop];
          }, namedSource);

      if (value === null || value === undefined) {
        return '';
      }

      if (typeof value === 'object') {
        return JSON.stringify(value);
      }

      return String(value);
    });
  },
  description:
    'Preenche um template: {0}, {1}… pegam os valores seguintes na ordem; {chave} pega o campo de um objeto passado como único valor',
  signature: 'interpolate(template, value0, value1, ...)',
  example:
    'interpolate("Tarefa {0} criada, ID: {1}", event.values.nome, event.values.id) ou interpolate("Olá {nome}", object("nome", "João"))',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
};
