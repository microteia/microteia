import type { CustomFieldValue, FieldDefinition } from '../entities';

export const slugifyFieldKey = (label: string): string =>
  label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

export const validateRequiredFields = (
  fields: FieldDefinition[],
  form: Record<string, CustomFieldValue>,
): string | null => {
  const missing = sortFieldsByOrder(fields).find(
    (field) => field.required && !hasFormValue(field, form[field.key]),
  );
  return missing ? `O campo "${missing.label}" é obrigatório.` : null;
};

export const resolveRecordTitle = (
  values: Record<string, CustomFieldValue>,
  titleFieldKey: string,
): string => {
  const value = values[titleFieldKey];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : 'Sem título';
};
