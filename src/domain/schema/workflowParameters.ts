import type { WorkflowParameter, WorkflowParameterType } from '../entities/Workflow';
import type { ScriptOutputParam } from '../entities/Script';
import { validateFieldKey } from '../services/customFieldValues';
import { isScalarParameterType } from './eventCatalog';
import type { FieldRules, FormatPreset, FormatRule, ValidateCheck, ValidateRule } from './fieldRules';

import type { LocalizedMessage } from './i18n/localizedMessage';
const isValidRegex = (pattern: string): boolean => {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
};

const isLengthLimit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export const sanitizeFieldRules = (rules: FieldRules | undefined): FieldRules | undefined => {
  if (!rules) return undefined;

  // A chave do preset não é conferida contra uma lista fixa: quem responde por ela é o catálogo
  // declarado, que varia por tenant. Chave desconhecida vira no-op na hora de aplicar.
  const format: FormatRule = {};
  if (rules.format?.preset?.trim()) format.preset = rules.format.preset.trim();
  if (rules.format?.pattern?.trim() && isValidRegex(rules.format.pattern)) {
    format.pattern = rules.format.pattern.trim();
    format.replacement = rules.format.replacement ?? '';
    if (rules.format.flags) format.flags = rules.format.flags;
  }

  const validate: ValidateRule = {};
  if (rules.validate?.check?.trim()) validate.check = rules.validate.check.trim();
  if (rules.validate?.pattern?.trim() && isValidRegex(rules.validate.pattern)) {
    validate.pattern = rules.validate.pattern.trim();
    if (rules.validate.flags) validate.flags = rules.validate.flags;
  }
  const minLength = rules.validate?.minLength;
  const maxLength = rules.validate?.maxLength;
  if (isLengthLimit(minLength)) validate.minLength = minLength;
  if (isLengthLimit(maxLength)) validate.maxLength = maxLength;
  const hasValidation = Boolean(validate.check || validate.pattern)
    || validate.minLength !== undefined || validate.maxLength !== undefined;
  if (hasValidation && rules.validate?.message?.trim()) {
    validate.message = rules.validate.message.trim();
  }

  const clean: FieldRules = {};
  if (Object.keys(format).length > 0) clean.format = format;
  if (Object.keys(validate).length > 0) clean.validate = validate;
  return Object.keys(clean).length > 0 ? clean : undefined;
};

const parseDslRules = (value: unknown): FieldRules | undefined => {
  if (!isPlainObject(value)) return undefined;

  const rawFormat = isPlainObject(value.format) ? value.format : undefined;
  const rawValidate = isPlainObject(value.validate) ? value.validate : undefined;
  if (!rawFormat && !rawValidate) return undefined;

  return sanitizeFieldRules({
    format: rawFormat
      ? {
          preset: typeof rawFormat.preset === 'string' ? (rawFormat.preset as FormatPreset) : undefined,
          pattern: typeof rawFormat.pattern === 'string' ? rawFormat.pattern : undefined,
          replacement: typeof rawFormat.replacement === 'string' ? rawFormat.replacement : undefined,
          flags: typeof rawFormat.flags === 'string' ? rawFormat.flags : undefined,
        }
      : undefined,
    validate: rawValidate
      ? {
          check: typeof rawValidate.check === 'string' ? (rawValidate.check as ValidateCheck) : undefined,
          pattern: typeof rawValidate.pattern === 'string' ? rawValidate.pattern : undefined,
          message: typeof rawValidate.message === 'string' ? rawValidate.message : undefined,
          flags: typeof rawValidate.flags === 'string' ? rawValidate.flags : undefined,
          minLength: typeof rawValidate.minLength === 'number' ? rawValidate.minLength : undefined,
          maxLength: typeof rawValidate.maxLength === 'number' ? rawValidate.maxLength : undefined,
        }
      : undefined,
  });
};

export const PARAMETER_TYPE_VALUES: WorkflowParameterType[] = [
  'String',
  'Number',
  'Date',
  'Boolean',
  'select',
  'lookup',
  'EntityReference',
  'Object',
];

interface ParameterLike {
  key: string;
  type: WorkflowParameterType;
  entityType?: string;
  lookupCollection?: string;
  fields?: ParameterLike[];
}

export const siblingParameterErrors = (
  parameters: ParameterLike[],
): (LocalizedMessage | undefined)[] => {
  const seen = new Set<string>();
  return parameters.map((parameter) => {
    const keyError = validateFieldKey(parameter.key);
    if (keyError) return keyError;
    if (seen.has(parameter.key)) return { message: '@core.automation/parameter.duplicate-key' };
    seen.add(parameter.key);
    if (parameter.type === 'EntityReference' && !parameter.entityType) {
      return { message: '@core.automation/parameter.entity-required' };
    }
    if (parameter.type === 'lookup' && !parameter.lookupCollection) {
      return { message: '@core.automation/parameter.lookup-required' };
    }
    if (parameter.type === 'Object' && (parameter.fields ?? []).length === 0) {
      return { message: '@core.automation/parameter.object-empty' };
    }
    return undefined;
  });
};

export const cloneParameterInList = <T extends { key: string; label: string }>(
  list: T[],
  index: number,
): T[] => {
  const original = list[index];
  if (!original) return list;

  const siblingKeys = new Set(list.map((item) => item.key));
  const base = original.key.replace(/\d+$/, '') || original.key;
  let n = 2;
  while (siblingKeys.has(`${base}${n}`)) n++;

  const clone = structuredClone(original);
  clone.key = `${base}${n}`;
  if (original.label) clone.label = `${original.label} ${n}`;

  const next = [...list];
  next.splice(index + 1, 0, clone);
  return next;
};

export const hasParameterErrorsDeep = (parameters: ParameterLike[]): boolean => {
  const errors = siblingParameterErrors(parameters);
  if (errors.some((error) => error !== undefined)) return true;
  return parameters.some((parameter) =>
    parameter.type === 'Object' ? hasParameterErrorsDeep(parameter.fields ?? []) : false,
  );
};

export const sanitizeWorkflowParameters = (parameters: WorkflowParameter[]): WorkflowParameter[] =>
  parameters.map((parameter) => {
    const clean: WorkflowParameter = { key: parameter.key, label: parameter.label, type: parameter.type };
    if (parameter.required) clean.required = true;
    if (parameter.list) clean.list = true;
    if (parameter.type === 'EntityReference' && parameter.entityType) clean.entityType = parameter.entityType;
    if (parameter.type === 'lookup' && parameter.lookupCollection) clean.lookupCollection = parameter.lookupCollection;
    if (parameter.type === 'select' && parameter.options) clean.options = parameter.options;
    if (parameter.type === 'Object') clean.fields = sanitizeWorkflowParameters(parameter.fields ?? []);
    if (!parameter.list && isScalarParameterType(parameter.type) && parameter.defaultValue !== undefined && parameter.defaultValue !== '') {
      clean.defaultValue = parameter.defaultValue;
    }
    const rules = sanitizeFieldRules(parameter.rules);
    if (rules) clean.rules = rules;
    return clean;
  });

export const sanitizeScriptOutputParams = (parameters: ScriptOutputParam[]): ScriptOutputParam[] =>
  parameters.map((parameter) => {
    const clean: ScriptOutputParam = { key: parameter.key, label: parameter.label, type: parameter.type };
    if (parameter.list) clean.list = true;
    if (parameter.type === 'EntityReference' && parameter.entityType) clean.entityType = parameter.entityType;
    if (parameter.type === 'lookup' && parameter.lookupCollection) clean.lookupCollection = parameter.lookupCollection;
    if (parameter.type === 'Object') clean.fields = sanitizeScriptOutputParams(parameter.fields ?? []);
    return clean;
  });

/**
 * As LISTAS DE OPÇÕES que um conjunto de parâmetros referencia, coleção a coleção. Mesmo papel do
 * `lookupCollection` de um campo de tela: é por aqui que o empacotamento de uma extensão descobre
 * que precisa carregar a lista junto com o fluxo que a pede.
 */
export const parameterLookupCollections = (parameters: ParameterLike[] = []): string[] => {
  const collections = new Set<string>();
  const walk = (list: ParameterLike[]): void => {
    for (const parameter of list) {
      if (parameter.type === 'lookup' && parameter.lookupCollection) collections.add(parameter.lookupCollection);
      if (parameter.type === 'Object') walk(parameter.fields ?? []);
    }
  };
  walk(parameters);
  return [...collections];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidType = (value: unknown): value is WorkflowParameterType =>
  typeof value === 'string' && (PARAMETER_TYPE_VALUES as string[]).includes(value);

const parameterToDslValue = (parameter: WorkflowParameter): unknown => {
  const rich: Record<string, unknown> = { type: parameter.type };
  const rules = sanitizeFieldRules(parameter.rules);
  const hasExtras =
    (parameter.label && parameter.label !== parameter.key) ||
    parameter.required ||
    parameter.list ||
    parameter.defaultValue !== undefined ||
    rules !== undefined ||
    parameter.type === 'EntityReference' ||
    parameter.type === 'lookup' ||
    parameter.type === 'select' ||
    parameter.type === 'Object';

  if (!hasExtras) return parameter.type;

  if (parameter.label && parameter.label !== parameter.key) rich.label = parameter.label;
  if (parameter.required) rich.required = true;
  if (parameter.list) rich.list = true;
  if (parameter.type === 'EntityReference' && parameter.entityType) rich.entityType = parameter.entityType;
  if (parameter.type === 'lookup' && parameter.lookupCollection) rich.lookupCollection = parameter.lookupCollection;
  if (parameter.type === 'select' && parameter.options) rich.options = parameter.options;
  if (!parameter.list && parameter.defaultValue !== undefined) rich.default = parameter.defaultValue;
  if (rules) rich.rules = rules;
  if (parameter.type === 'Object') rich.fields = parametersToDslMap(parameter.fields ?? []);
  return rich;
};

const parametersToDslMap = (parameters: WorkflowParameter[]): Record<string, unknown> => {
  const map: Record<string, unknown> = {};
  for (const parameter of parameters) map[parameter.key] = parameterToDslValue(parameter);
  return map;
};

export const parametersToDsl = (parameters: WorkflowParameter[]): string =>
  JSON.stringify(parametersToDslMap(parameters), null, 2);

const parseDslNode = (
  key: string,
  value: unknown,
  path: string,
  errors: ParameterDslError[],
): WorkflowParameter | null => {
  const keyError = validateFieldKey(key);
  if (keyError) {
    errors.push({ path, ...keyError });
    return null;
  }

  if (typeof value === 'string') {
    if (!isValidType(value)) {
      errors.push({ path, message: '@core.automation/parameter.dsl.invalid-type', messageParams: { type: value } });
      return null;
    }
    if (value === 'Object') {
      errors.push({ path, message: '@core.automation/parameter.dsl.object-needs-fields' });
      return null;
    }
    if (value === 'EntityReference') {
      errors.push({ path, message: '@core.automation/parameter.dsl.reference-needs-entity' });
      return null;
    }
    if (value === 'lookup') {
      errors.push({ path, message: '@core.automation/parameter.dsl.lookup-needs-collection' });
      return null;
    }
    return { key, label: key, type: value };
  }

  if (!isPlainObject(value)) {
    errors.push({ path, message: '@core.automation/parameter.dsl.invalid-value' });
    return null;
  }

  const hasExplicitType = isValidType(value.type);
  const type: WorkflowParameterType = hasExplicitType ? (value.type as WorkflowParameterType) : 'Object';

  if (value.type !== undefined && !hasExplicitType) {
    errors.push({
      path,
      message: '@core.automation/parameter.dsl.invalid-type',
      messageParams: { type: String(value.type) },
    });
    return null;
  }

  const parameter: WorkflowParameter = {
    key,
    label: typeof value.label === 'string' && value.label ? value.label : key,
    type,
  };
  if (value.required === true) parameter.required = true;
  if (value.list === true) parameter.list = true;

  if (type === 'EntityReference') {
    if (typeof value.entityType !== 'string' || !value.entityType) {
      errors.push({ path, message: '@core.automation/parameter.dsl.entity-type-required' });
      return null;
    }
    parameter.entityType = value.entityType;
  } else if (type === 'lookup') {
    if (typeof value.lookupCollection !== 'string' || !value.lookupCollection) {
      errors.push({ path, message: '@core.automation/parameter.dsl.lookup-collection-required' });
      return null;
    }
    parameter.lookupCollection = value.lookupCollection;
  } else if (type === 'select') {
    if (!Array.isArray(value.options)) {
      errors.push({ path, message: '@core.automation/parameter.dsl.options-required' });
      return null;
    }
    parameter.options = value.options.map((option) =>
      isPlainObject(option)
        ? { value: String(option.value ?? ''), label: String(option.label ?? option.value ?? '') }
        : { value: String(option), label: String(option) },
    );
  } else if (type === 'Object') {
    const fieldsSource = hasExplicitType ? value.fields : value;
    if (!isPlainObject(fieldsSource) || Object.keys(fieldsSource).length === 0) {
      errors.push({ path, message: '@core.automation/parameter.dsl.object-needs-one-field' });
      return null;
    }
    parameter.fields = parseDslMap(fieldsSource, path, errors);
  }

  if (!parameter.list && isScalarParameterType(type) && value.default !== undefined) parameter.defaultValue = value.default;

  const rules = parseDslRules(value.rules);
  if (rules) parameter.rules = rules;

  return parameter;
};

const parseDslMap = (
  map: Record<string, unknown>,
  parentPath: string,
  errors: ParameterDslError[],
): WorkflowParameter[] => {
  const params: WorkflowParameter[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(map)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (seen.has(key)) {
      errors.push({ path, message: '@core.automation/parameter.duplicate-key' });
      continue;
    }
    seen.add(key);
    const parsed = parseDslNode(key, value, path, errors);
    if (parsed) params.push(parsed);
  }
  return params;
};

/** O caminho é o lugar do problema no documento; a mensagem é a referência que a tela resolve. */
export interface ParameterDslError extends LocalizedMessage {
  path: string;
}

export const dslToParameters = (
  text: string,
): { params?: WorkflowParameter[]; errors?: ParameterDslError[] } => {
  const trimmed = text.trim();
  if (!trimmed) return { params: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      errors: [{
        path: '',
        message: '@core.automation/parameter.dsl.invalid-json',
        messageParams: { detail: error instanceof Error ? error.message : String(error) },
      }],
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      errors: [{ path: '', message: '@core.automation/parameter.dsl.root-must-be-object' }],
    };
  }

  const errors: ParameterDslError[] = [];
  const params = parseDslMap(parsed, '', errors);
  return errors.length > 0 ? { errors } : { params };
};
