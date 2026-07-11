import type { WorkflowParameter, WorkflowParameterType } from '../entities/Workflow';
import type { ScriptOutputParam } from '../entities/Script';
import { validateFieldKey } from '../services/customFieldValues';
import { isScalarParameterType } from './eventCatalog';

export const PARAMETER_TYPE_VALUES: WorkflowParameterType[] = [
  'String',
  'Number',
  'Date',
  'Boolean',
  'select',
  'EntityReference',
  'Object',
];

interface ParameterLike {
  key: string;
  type: WorkflowParameterType;
  entityType?: string;
  fields?: ParameterLike[];
}

export const siblingParameterErrors = (parameters: ParameterLike[]): (string | undefined)[] => {
  const seen = new Set<string>();
  return parameters.map((parameter) => {
    const keyError = validateFieldKey(parameter.key);
    if (keyError) return keyError;
    if (seen.has(parameter.key)) return 'Chave duplicada';
    seen.add(parameter.key);
    if (parameter.type === 'EntityReference' && !parameter.entityType) return 'Selecione a entidade referenciada';
    if (parameter.type === 'Object' && (parameter.fields ?? []).length === 0) return 'Adicione ao menos um campo ao objeto';
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
    if (parameter.type === 'EntityReference') {
      if (parameter.entityType) clean.entityType = parameter.entityType;
      if (parameter.multi) clean.multi = true;
    }
    if (parameter.type === 'select' && parameter.options) clean.options = parameter.options;
    if (parameter.type === 'Object') clean.fields = sanitizeWorkflowParameters(parameter.fields ?? []);
    if (isScalarParameterType(parameter.type) && parameter.defaultValue !== undefined && parameter.defaultValue !== '') {
      clean.defaultValue = parameter.defaultValue;
    }
    return clean;
  });

export const sanitizeScriptOutputParams = (parameters: ScriptOutputParam[]): ScriptOutputParam[] =>
  parameters.map((parameter) => {
    const clean: ScriptOutputParam = { key: parameter.key, label: parameter.label, type: parameter.type };
    if (parameter.type === 'EntityReference' && parameter.entityType) clean.entityType = parameter.entityType;
    if (parameter.type === 'Object') clean.fields = sanitizeScriptOutputParams(parameter.fields ?? []);
    return clean;
  });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidType = (value: unknown): value is WorkflowParameterType =>
  typeof value === 'string' && (PARAMETER_TYPE_VALUES as string[]).includes(value);

const parameterToDslValue = (parameter: WorkflowParameter): unknown => {
  const rich: Record<string, unknown> = { type: parameter.type };
  const hasExtras =
    (parameter.label && parameter.label !== parameter.key) ||
    parameter.required ||
    parameter.defaultValue !== undefined ||
    parameter.type === 'EntityReference' ||
    parameter.type === 'select' ||
    parameter.type === 'Object';

  if (!hasExtras) return parameter.type;

  if (parameter.label && parameter.label !== parameter.key) rich.label = parameter.label;
  if (parameter.required) rich.required = true;
  if (parameter.type === 'EntityReference') {
    if (parameter.entityType) rich.entityType = parameter.entityType;
    if (parameter.multi) rich.multi = true;
  }
  if (parameter.type === 'select' && parameter.options) rich.options = parameter.options;
  if (parameter.defaultValue !== undefined) rich.default = parameter.defaultValue;
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

const parseDslNode = (key: string, value: unknown, path: string, errors: string[]): WorkflowParameter | null => {
  const keyError = validateFieldKey(key);
  if (keyError) {
    errors.push(`${path}: ${keyError}`);
    return null;
  }

  if (typeof value === 'string') {
    if (!isValidType(value)) {
      errors.push(`${path}: tipo inválido "${value}"`);
      return null;
    }
    if (value === 'Object') {
      errors.push(`${path}: um objeto precisa declarar seus campos ("fields")`);
      return null;
    }
    if (value === 'EntityReference') {
      errors.push(`${path}: uma referência precisa da forma completa com "entityType"`);
      return null;
    }
    return { key, label: key, type: value };
  }

  if (!isPlainObject(value)) {
    errors.push(`${path}: valor inválido`);
    return null;
  }

  const hasExplicitType = isValidType(value.type);
  const type: WorkflowParameterType = hasExplicitType ? (value.type as WorkflowParameterType) : 'Object';

  if (value.type !== undefined && !hasExplicitType) {
    errors.push(`${path}: tipo inválido "${String(value.type)}"`);
    return null;
  }

  const parameter: WorkflowParameter = {
    key,
    label: typeof value.label === 'string' && value.label ? value.label : key,
    type,
  };
  if (value.required === true) parameter.required = true;

  if (type === 'EntityReference') {
    if (typeof value.entityType !== 'string' || !value.entityType) {
      errors.push(`${path}: referência a entidade exige "entityType"`);
      return null;
    }
    parameter.entityType = value.entityType;
    if (value.multi === true) parameter.multi = true;
  } else if (type === 'select') {
    if (!Array.isArray(value.options)) {
      errors.push(`${path}: lista de opções exige "options" (array)`);
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
      errors.push(`${path}: um objeto precisa de ao menos um campo em "fields"`);
      return null;
    }
    parameter.fields = parseDslMap(fieldsSource, path, errors);
  }

  if (isScalarParameterType(type) && value.default !== undefined) parameter.defaultValue = value.default;

  return parameter;
};

const parseDslMap = (map: Record<string, unknown>, parentPath: string, errors: string[]): WorkflowParameter[] => {
  const params: WorkflowParameter[] = [];
  const seen = new Set<string>();
  for (const [key, value] of Object.entries(map)) {
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (seen.has(key)) {
      errors.push(`${path}: chave duplicada`);
      continue;
    }
    seen.add(key);
    const parsed = parseDslNode(key, value, path, errors);
    if (parsed) params.push(parsed);
  }
  return params;
};

export const dslToParameters = (text: string): { params?: WorkflowParameter[]; errors?: string[] } => {
  const trimmed = text.trim();
  if (!trimmed) return { params: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return { errors: [`JSON inválido: ${error instanceof Error ? error.message : String(error)}`] };
  }

  if (!isPlainObject(parsed)) {
    return { errors: ['A estrutura raiz deve ser um objeto { "chave": ... }'] };
  }

  const errors: string[] = [];
  const params = parseDslMap(parsed, '', errors);
  return errors.length > 0 ? { errors } : { params };
};
