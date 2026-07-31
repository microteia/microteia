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
export const toDateFieldInput = (value: unknown): string => {
  const date = value instanceof Date ? value : isTimestampLike(value) ? value.toDate() : null;
  if (date) {
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }
  return typeof value === 'string' ? value.slice(0, 10) : '';
};

/**
 * `stored` é o REGISTRO INTEIRO — os campos moram na raiz do documento, então basta ler pela chave.
 * Aceita `object` para que uma entidade tipada (Person, Case…) seja passada diretamente: interfaces
 * não são atribuíveis a `Record<string, unknown>`, e o cast ficaria em cada chamada.
 */
export const buildInitialFormValues = (
  fields: FieldDefinition[],
  stored?: object | null,
): Record<string, CustomFieldValue> => {
  const record = stored as Record<string, unknown> | null | undefined;
  const form: Record<string, CustomFieldValue> = {};
  fields.forEach((field) => {
    const value = record?.[field.key] as CustomFieldValue | undefined;
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
      case 'date':
        form[field.key] = toDateFieldInput(value);
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

/** Nome de exibição do registro — o valor do campo eleito como título na tela. */
/**
 * Texto CRU de um campo do registro, ou vazio — a diferença para `resolveRecordTitle` é não inventar
 * "Sem título": quem chama precisa distinguir "não tem" para cair no próximo candidato (o nome da
 * tela, o campo-título). Chave vazia devolve vazio, então um `subtitleFieldKey` ausente não vira texto.
 */
export const readRecordText = (values: object, fieldKey: string): string => {
  if (!fieldKey) return '';
  const value = (values as Record<string, unknown>)[fieldKey];
  return typeof value === 'string' ? value.trim() : '';
};

export const resolveRecordTitle = (
  values: object,
  titleFieldKey: string,
): string => {
  const value = (values as Record<string, unknown>)[titleFieldKey];
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
