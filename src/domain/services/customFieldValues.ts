import type { CustomFieldValue, FieldDefinition } from '../entities/entitySchemas';

import type { LocalizedMessage } from '../schema/i18n/localizedMessage';
import type { TranslateFn } from '../../presentation/shared/i18n/useT';
// Palavras reservadas do JavaScript que não podem ser usadas como nomes de campos
const JS_RESERVED_WORDS = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let',
  'new', 'null', 'return', 'static', 'super', 'switch', 'this', 'throw',
  'true', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield',
]);

const VALID_FIELD_KEY_PATTERN = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Valida se um fieldKey é compatível com JavaScript.
 * Retorna mensagem de erro se inválido, undefined se válido.
 */
export const validateFieldKey = (key: string): LocalizedMessage | undefined => {
  if (!key) {
    return { message: '@core.automation/field-key.empty' };
  }

  if (!VALID_FIELD_KEY_PATTERN.test(key)) {
    return { message: '@core.automation/field-key.invalid' };
  }

  if (JS_RESERVED_WORDS.has(key)) {
    return {
      message: '@core.automation/field-key.reserved',
      messageParams: { key },
    };
  }

  return undefined;
};

/**
 * Converte um label em um fieldKey válido para JavaScript.
 * Usa underscore no lugar de hífens para compatibilidade total.
 */
export const slugifyFieldKey = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, '_$1'); // Se começar com número, adiciona underscore

/**
 * Desambigua uma chave já em uso com sufixo numérico. O separador é `_` pelo mesmo motivo do
 * `slugifyFieldKey`: hífen é recusado tanto por `VALID_FIELD_KEY_PATTERN` (chave de campo) quanto por
 * `COLLECTION_NAME_PATTERN` (nome de coleção), então um sufixo com hífen gerava uma chave que o
 * próprio validador rejeitava em seguida.
 */
export const ensureUniqueKey = (base: string, existingKeys: Set<string>): string => {
  const safeBase = base || 'campo';
  if (!existingKeys.has(safeBase)) return safeBase;
  let suffix = 2;
  while (existingKeys.has(`${safeBase}_${suffix}`)) suffix += 1;
  return `${safeBase}_${suffix}`;
};

export const sortFieldsByOrder = (fields: FieldDefinition[]): FieldDefinition[] =>
  [...fields].sort((a, b) => a.order - b.order);

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  !!value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function';

/**
 * Um campo de data é gravado como data e volta como `Date` (ou Timestamp, se veio cru do Firestore);
 * o controle do formulário fala `aaaa-mm-dd`. A conversão usa o fuso local, o mesmo em que a data
 * foi montada na gravação, para o dia exibido ser o dia escolhido.
 */
const BR_DATE = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;

export const toDateFieldInput = (value: unknown): string => {
  const date = value instanceof Date ? value : isTimestampLike(value) ? value.toDate() : null;
  if (date) {
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
  if (typeof value !== 'string') return '';
  // Uma data também chega como TEXTO — de uma importação, de um script, de uma automação que gravou
  // o que o usuário digitou. Em `dd/mm/aaaa` o corte cru devolvia "15/08/2026" no lugar de uma data
  // ISO: o formulário exibia vazio e a comparação de intervalo passava a mentir em silêncio (a ordem
  // alfabética de "15/..." e "2026-..." não é a cronológica).
  const br = BR_DATE.exec(value.trim());
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : '';
};

/**
 * `stored` é o REGISTRO INTEIRO — os campos moram na raiz do documento, então basta ler pela chave.
 * Aceita `object` para que uma entidade tipada (Person, Contract…) seja passada diretamente: interfaces
 * não são atribuíveis a `Record<string, unknown>`, e o cast ficaria em cada chamada.
 */
export const buildInitialFormValues = (
  fields: FieldDefinition[],
  stored?: object | null,
): Record<string, CustomFieldValue> => {
  const record = (stored ?? {}) as object;
  // Registro NOVO: é onde o valor declarado de partida entra. Num registro existente, o que vale é
  // o que está gravado — inclusive o vazio que o usuário deixou de propósito.
  const isNew = stored === null || stored === undefined;
  let form: Record<string, CustomFieldValue> = {};
  const put = (key: string, value: CustomFieldValue): void => {
    form = setValueByPath(form, key, value);
  };

  fields.forEach((field) => {
    const stored = readValueByPath(record, field.key) as CustomFieldValue | undefined;
    const value = isNew && stored === undefined && field.defaultValue !== undefined
      ? field.defaultValue
      : stored;
    switch (field.type) {
      case 'checkbox':
        put(field.key, typeof value === 'boolean' ? value : false);
        break;
      case 'currency':
        put(field.key, typeof value === 'number' ? value : null);
        break;
      case 'number':
        put(field.key, typeof value === 'number' ? String(value) : '');
        break;
      case 'date':
        put(field.key, toDateFieldInput(value));
        break;
      case 'select':
      case 'reference':
        if (field.multi) {
          put(field.key, Array.isArray(value) ? value : []);
        } else {
          put(field.key, typeof value === 'string' ? value : '');
        }
        break;
      default:
        put(field.key, typeof value === 'string' ? value : '');
    }
  });
  return form;
};

export const formValuesToStoredValues = (
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): Record<string, CustomFieldValue> => {
  let stored: Record<string, CustomFieldValue> = {};
  const put = (key: string, value: CustomFieldValue): void => {
    stored = setValueByPath(stored, key, value);
  };

  fields.forEach((field) => {
    const value = readValueByPath(form, field.key) as CustomFieldValue | undefined;
    switch (field.type) {
      case 'checkbox':
        put(field.key, value === true);
        break;
      case 'currency':
        put(field.key, typeof value === 'number' ? value : null);
        break;
      case 'number': {
        const raw = typeof value === 'string' ? value.trim() : '';
        put(field.key, raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null);
        break;
      }
      case 'select':
      case 'reference':
        if (field.multi) {
          put(field.key, Array.isArray(value) ? value : []);
        } else {
          put(field.key, typeof value === 'string' && value !== '' ? value : null);
        }
        break;
      default: {
        const raw = typeof value === 'string' ? value.trim() : '';
        put(field.key, raw !== '' ? raw : null);
      }
    }
  });
  return stored;
};

const hasFormValue = (field: FieldDefinition, value: CustomFieldValue | undefined): boolean => {
  switch (field.type) {
    case 'checkbox':
      return true;
    case 'currency':
      return typeof value === 'number';
    case 'select':
    case 'reference':
      if (field.multi) return Array.isArray(value) && value.length > 0;
      return typeof value === 'string' && value !== '';
    default:
      return typeof value === 'string' && value.trim() !== '';
  }
};

/**
 * O tradutor entra como PRIMEIRO parâmetro — o padrão do projeto para função pura que produz texto.
 * Aqui ele evita trocar `Record<string, string>` por `Record<string, LocalizedMessage>` em todo o
 * caminho até o formulário, só para o erro atravessar um nível.
 */
export const requiredFieldError = (t: TranslateFn, field: FieldDefinition): string =>
  t('@core.automation/parameter.required', { label: field.label });

export const validateRequiredFields = (
  t: TranslateFn,
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): string | null => {
  const missing = sortFieldsByOrder(fields).find(
    (field) => field.required && !hasFormValue(field, readValueByPath(form, field.key) as CustomFieldValue | undefined),
  );
  return missing ? requiredFieldError(t, missing) : null;
};

export const collectRequiredErrors = (
  t: TranslateFn,
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): Record<string, string> => {
  const errors: Record<string, string> = {};
  sortFieldsByOrder(fields).forEach((field) => {
    if (field.required && !hasFormValue(field, readValueByPath(form, field.key) as CustomFieldValue | undefined)) {
      errors[field.key] = requiredFieldError(t, field);
    }
  });
  return errors;
};

/**
 * Leitura por caminho pontilhado — o par de `setValueByPath`.
 *
 * A chave de um campo é um CAMINHO, não um nome: um objeto aninhado (`address`) é declarado campo a
 * campo (`address.city`), e é assim que ele chega ao formulário, ao card e aos filtros. Ler pela
 * raiz devolvia `undefined` para todo campo dentro de um objeto — a cidade sumia do cartão e o
 * filtro por ela não casava nada, sem erro nenhum.
 */
export const readValueByPath = (values: object, key: string): unknown => {
  if (!key) return undefined;
  if (!key.includes('.')) return (values as Record<string, unknown>)[key];
  return key.split('.').reduce<unknown>(
    (acc, part) => (acc !== null && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    values,
  );
};

/**
 * Texto CRU de um campo do registro, ou vazio — a diferença para `resolveRecordTitle` é não inventar
 * "Sem título": quem chama precisa distinguir "não tem" para cair no próximo candidato (o nome da
 * tela, o campo-título). Chave vazia devolve vazio, então um `subtitleFieldKey` ausente não vira texto.
 */
export const readRecordText = (values: object, fieldKey: string): string => {
  if (!fieldKey) return '';
  const value = readValueByPath(values, fieldKey);
  return typeof value === 'string' ? value.trim() : '';
};

/** Nome de exibição do registro — o valor do campo eleito como título na tela. */
export const resolveRecordTitle = (
  values: object,
  titleFieldKey: string,
): string => {
  const value = readValueByPath(values, titleFieldKey);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '@core.records/record.untitled';
};

/**
 * Rótulo da ABA de um registro: o campo-TÍTULO.
 *
 * É por ele que o usuário reconhece o que está aberto, e é o mesmo nome que a listagem, a busca e
 * uma menção mostram — a aba discordar das outras três é o que fazia o mesmo registro parecer dois.
 * O subtítulo entra só quando o título está vazio, para a aba não ficar "Sem título".
 */
export const resolveRecordTabTitle = (
  values: object,
  titleFieldKey: string,
  subtitleFieldKey: string,
): string =>
  readRecordText(values, titleFieldKey)
  || readRecordText(values, subtitleFieldKey)
  || resolveRecordTitle(values, titleFieldKey);

/**
 * Escrita imutável por caminho pontilhado (espelha `readValueByPath`).
 * Chave sem "." grava no topo; "address.street" grava aninhado, criando o ramo se preciso.
 */
export const setValueByPath = (
  values: Record<string, CustomFieldValue>,
  key: string,
  value: CustomFieldValue,
): Record<string, CustomFieldValue> => {
  if (!key.includes('.')) return { ...values, [key]: value };
  const [head, ...rest] = key.split('.');
  const current = (values as Record<string, unknown>)[head];
  const branch =
    current !== null && typeof current === 'object' && !Array.isArray(current)
      ? (current as Record<string, CustomFieldValue>)
      : ({} as Record<string, CustomFieldValue>);
  const updated = setValueByPath(branch, rest.join('.'), value);
  return { ...values, [head]: updated as unknown as CustomFieldValue };
};
