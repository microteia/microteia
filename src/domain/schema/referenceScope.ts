import type { FieldDefinition } from '../entities/entitySchemas';

/**
 * ESCOPO HIDRATADO — FRONT-ONLY, deliberadamente fora de `SHARED_FILES` do sync-schemas.
 *
 * No front os registros referenciados já estão em memória (os stores mantêm subscription das telas),
 * então um campo de referência pode ser navegado como objeto: `produto.preco`. No backend só existe
 * o id cru, e hidratá-lo exigiria I/O dentro de uma avaliação síncrona.
 *
 * Por isso a hidratação vale APENAS nos slots que já são front-only — `hiddenWhen`, `disabledWhen` e
 * `onChange`. Os slots que rodam dos dois lados (`validate` e `compute`) continuam vendo o id, senão
 * a mesma expressão daria resultados diferentes no front e no back.
 */
export type RecordResolver = (
  refEntity: string,
  id: string,
) => Record<string, unknown> | null;

const asId = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const hydrateOne = (
  refEntity: string,
  value: unknown,
  resolve: RecordResolver,
): unknown => {
  const id = asId(value);
  if (!id) return value;

  // Registro ainda não carregado (ou de uma tela fora do escopo): devolve o id cru, que é
  // exatamente o comportamento anterior — melhor degradar do que expor undefined.
  const record = resolve(refEntity, id);
  return record ? { id, ...record } : value;
};

/**
 * Substitui, no escopo de avaliação, o id de cada campo de referência pelo registro correspondente.
 * Campos que não são referência passam intactos.
 */
export const buildHydratedFieldScope = (
  fields: FieldDefinition[],
  values: Record<string, unknown>,
  resolve: RecordResolver,
): Record<string, unknown> => {
  const referenceFields = fields.filter(
    (field) => field.type === 'reference' && Boolean(field.refEntity),
  );
  if (referenceFields.length === 0) return values;

  const scope = { ...values };

  for (const field of referenceFields) {
    const refEntity = field.refEntity as string;
    const current = values[field.key];

    if (Array.isArray(current)) {
      scope[field.key] = current.map((item) => hydrateOne(refEntity, item, resolve));
      continue;
    }

    scope[field.key] = hydrateOne(refEntity, current, resolve);
  }

  return scope;
};
