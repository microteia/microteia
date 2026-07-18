import type { CustomFieldValue, FieldDefinition } from '../entities/entitySchemas';

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
export const validateFieldKey = (key: string): string | undefined => {
  if (!key) {
    return 'Nome do campo não pode ser vazio';
  }
  
  if (!VALID_FIELD_KEY_PATTERN.test(key)) {
    return 'Nome inválido: deve começar com letra, underscore ou $ e conter apenas letras, números, underscore ou $';
  }
  
  if (JS_RESERVED_WORDS.has(key)) {
    return `"${key}" é uma palavra reservada do JavaScript e não pode ser usada como nome de campo`;
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

export const ensureUniqueKey = (base: string, existingKeys: Set<string>): string => {
  const safeBase = base || 'campo';
  if (!existingKeys.has(safeBase)) return safeBase;
  let suffix = 2;
  while (existingKeys.has(`${safeBase}-${suffix}`)) suffix += 1;
  return `${safeBase}-${suffix}`;
};

export const sortFieldsByOrder = (fields: FieldDefinition[]): FieldDefinition[] =>
  [...fields].sort((a, b) => a.order - b.order);

export const buildInitialFormValues = (
  fields: FieldDefinition[],
  stored?: Record<string, CustomFieldValue> | null,
): Record<string, CustomFieldValue> => {
  const form: Record<string, CustomFieldValue> = {};
  fields.forEach((field) => {
    const value = stored?.[field.key];
    switch (field.type) {
      case 'checkbox':
        form[field.key] = typeof value === 'boolean' ? value : false;
        break;
      case 'currency':
        form[field.key] = typeof value === 'number' ? value : null;
        break;
      case 'number':
        form[field.key] = typeof value === 'number' ? String(value) : '';
        break;
      case 'select':
      case 'reference':
        if (field.multi) {
          form[field.key] = Array.isArray(value) ? value : [];
        } else {
          form[field.key] = typeof value === 'string' ? value : '';
        }
        break;
      default:
        form[field.key] = typeof value === 'string' ? value : '';
    }
  });
  return form;
};

export const formValuesToStoredValues = (
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): Record<string, CustomFieldValue> => {
  const stored: Record<string, CustomFieldValue> = {};
  fields.forEach((field) => {
    const value = form[field.key];
    switch (field.type) {
      case 'checkbox':
        stored[field.key] = value === true;
        break;
      case 'currency':
        stored[field.key] = typeof value === 'number' ? value : null;
        break;
      case 'number': {
        const raw = typeof value === 'string' ? value.trim() : '';
        stored[field.key] = raw !== '' && !Number.isNaN(Number(raw)) ? Number(raw) : null;
        break;
      }
      case 'select':
      case 'reference':
        if (field.multi) {
          stored[field.key] = Array.isArray(value) ? value : [];
        } else {
          stored[field.key] = typeof value === 'string' && value !== '' ? value : null;
        }
        break;
      default: {
        const raw = typeof value === 'string' ? value.trim() : '';
        stored[field.key] = raw !== '' ? raw : null;
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

export const requiredFieldError = (field: FieldDefinition): string =>
  `O campo "${field.label}" é obrigatório.`;

export const validateRequiredFields = (
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): string | null => {
  const missing = sortFieldsByOrder(fields).find(
    (field) => field.required && !hasFormValue(field, form[field.key]),
  );
  return missing ? requiredFieldError(missing) : null;
};

export const collectRequiredErrors = (
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): Record<string, string> => {
  const errors: Record<string, string> = {};
  sortFieldsByOrder(fields).forEach((field) => {
    if (field.required && !hasFormValue(field, form[field.key])) {
      errors[field.key] = requiredFieldError(field);
    }
  });
  return errors;
};

export const resolveRecordTitle = (
  values: Record<string, CustomFieldValue>,
  titleFieldKey: string,
): string => {
  const value = values[titleFieldKey];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : 'Sem título';
};

/**
 * Escrita imutável por caminho pontilhado (espelha o readByPath do CustomFieldsSection).
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
