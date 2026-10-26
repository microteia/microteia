import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
export const concatFn: ExpressionFunction = {
  name: 'concat',
  call: (args) => args.map((arg) => String(arg)).join(''),
  description: '@core.automation/expr.concat.description',
  signature: 'concat(value1, value2, ...)',
  example: 'concat("Order ", "123")',
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
      throw new LocalizedError('@core.automation/expr.arg.all.strings', { fn: 'replace' });
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
      throw new LocalizedError('@core.automation/expr.arg.first.string', { fn: 'substring' });
    }
    if (typeof start !== 'number') {
      throw new LocalizedError('@core.automation/expr.arg.second.number', { fn: 'substring' });
    }
    if (end !== undefined && typeof end !== 'number') {
      throw new LocalizedError('@core.automation/expr.arg.third.number', { fn: 'substring' });
    }
    return end === undefined ? text.substring(start) : text.substring(start, end);
  },
  description: '@core.automation/expr.substring.description',
  signature: 'substring(text, start, end?)',
  example: 'substring("Microteia", 0, 5)',
  category: '@core.automation/expr.category.text',
  minArgs: 2,
  maxArgs: 3,
};

export const startsWithFn: ExpressionFunction = {
  name: 'startsWith',
  call: ([text, prefix]) => {
    if (typeof text !== 'string' || typeof prefix !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.both.strings', { fn: 'startsWith' });
    }
    return text.startsWith(prefix);
  },
  description: '@core.automation/expr.startsWith.description',
  signature: 'startsWith(text, prefix)',
  example: 'startsWith("Microteia", "Micro")',
  category: '@core.automation/expr.category.text',
  minArgs: 2,
  maxArgs: 2,
};

export const endsWithFn: ExpressionFunction = {
  name: 'endsWith',
  call: ([text, suffix]) => {
    if (typeof text !== 'string' || typeof suffix !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.both.strings', { fn: 'endsWith' });
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
      throw new LocalizedError('@core.automation/expr.arg.both.strings', { fn: 'split' });
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
      throw new LocalizedError('@core.automation/expr.arg.first.array', { fn: 'join' });
    }
    if (typeof separator !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.second.string', { fn: 'join' });
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
      throw new LocalizedError('@core.automation/expr.arg.first.number', { fn: 'formatMoney' });
    }
    if (typeof locale !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.second.string', { fn: 'formatMoney' });
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
      throw new LocalizedError('@core.automation/expr.arg.first.template', { fn: 'interpolate' });
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
    '@core.automation/expr.interpolate.description',
  signature: 'interpolate(template, value0, value1, ...)',
  example:
    'interpolate("Task {0} created, ID: {1}", event.values.name, event.values.id) or interpolate("Hello {name}", object("name", "Ana"))',
  category: '@core.automation/expr.category.text',
  minArgs: 1,
};
