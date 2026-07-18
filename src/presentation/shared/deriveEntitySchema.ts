import type { EntityKey, FkSpec, NativeFieldSpec } from '../../domain/schema/entityRegistry';
import { ENTITY_REGISTRY } from '../../domain/schema/entityRegistry';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';

const controlFor = (spec: NativeFieldSpec): CustomFieldType => {
  if (spec.ui?.control) return spec.ui.control;
  if (spec.refEntity) return 'reference';
  if (spec.lookupCollection) return 'select';
  switch (spec.type) {
    case 'date': return 'date';
    case 'number': return 'number';
    case 'boolean': return 'checkbox';
    case 'stringArray': return 'select';
    default: return 'text';
  }
};

const toFieldDefinition = (spec: NativeFieldSpec, key: string, order: number): FieldDefinition => ({
  key,
  label: spec.label,
  type: controlFor(spec),
  required: spec.required ?? false,
  order,
  section: spec.ui?.section ?? null,
  placeholder: spec.ui?.placeholder ?? null,
  mask: spec.ui?.mask ?? null,
  lookupCollection: spec.lookupCollection ?? null,
  refEntity: spec.refEntity ?? null,
  multi: spec.multi ?? (spec.type === 'stringArray' ? true : undefined),
  optionsAllowUserAdd: spec.optionsAllowUserAdd,
  optionsColored: spec.optionsColored,
  options: spec.options,
  logic: spec.logic ?? null,
});

/**
 * Relações (`fks`) viram campos `reference` do formulário — o controle genérico resolve as opções
 * via `useReferenceOptions` (persons/members/cases/contracts/financials/deadlines/telas dinâmicas).
 * FKs de etiquetas ficam de fora marcando `ui: { form: false }` (quem trata é o TagManager).
 */
const fkToFieldDefinition = (fk: FkSpec, order: number): FieldDefinition => ({
  key: fk.key,
  label: fk.label,
  type: 'reference',
  required: fk.required ?? false,
  order,
  section: fk.ui?.section ?? null,
  placeholder: fk.ui?.placeholder ?? null,
  mask: null,
  lookupCollection: null,
  refEntity: fk.targetCollection,
  multi: fk.multi,
  logic: null,
});

export interface DeriveFormOptions {
  overrides?: Record<string, Partial<FieldDefinition>>;
  extra?: FieldDefinition[];
}

/**
 * Deriva os campos de formulário de uma entidade a partir do ENTITY_REGISTRY (fonte única).
 * Achata campos `object` para chaves-com-ponto (ex.: `address.city`). Aplica `overrides` por chave
 * e concatena campos `extra` exclusivos da view.
 */
export const deriveFormFields = (entityKey: EntityKey, opts: DeriveFormOptions = {}): FieldDefinition[] => {
  const entity = ENTITY_REGISTRY[entityKey];
  const derived: FieldDefinition[] = [];
  let auto = 0;

  const walk = (specs: NativeFieldSpec[], prefix: string): void => {
    for (const spec of specs) {
      if (spec.type === 'object' && spec.objectFields) {
        walk(spec.objectFields, `${prefix}${spec.key}.`);
        continue;
      }
      if (spec.ui?.form === false) {
        auto += 1;
        continue;
      }
      derived.push(toFieldDefinition(spec, `${prefix}${spec.key}`, spec.ui?.order ?? auto));
      auto += 1;
    }
  };

  walk(entity.fields, '');

  for (const fk of entity.fks) {
    if (fk.ui?.form === false) {
      auto += 1;
      continue;
    }
    derived.push(fkToFieldDefinition(fk, fk.ui?.order ?? auto));
    auto += 1;
  }

  const withOverrides = derived.map((field) =>
    opts.overrides?.[field.key] ? { ...field, ...opts.overrides[field.key] } : field,
  );
  const ordered = [...withOverrides].sort((a, b) => a.order - b.order);
  return opts.extra ? [...ordered, ...opts.extra] : ordered;
};

export interface DerivedListRow {
  key: string;
  icon: string;
  /** Controle do campo — permite ao card formatar moeda/data corretamente. */
  type: CustomFieldType;
}

/**
 * Deriva as linhas do card de listagem: campos com `ui.list`, ordenados por `ui.list.order`.
 */
export const deriveListRows = (entityKey: EntityKey): DerivedListRow[] => {
  const entity = ENTITY_REGISTRY[entityKey];
  const rows: (DerivedListRow & { order: number })[] = [];

  const walk = (specs: NativeFieldSpec[], prefix: string): void => {
    for (const spec of specs) {
      if (spec.type === 'object' && spec.objectFields) {
        walk(spec.objectFields, `${prefix}${spec.key}.`);
        continue;
      }
      if (spec.ui?.list) {
        rows.push({
          key: `${prefix}${spec.key}`,
          icon: spec.ui.list.icon ?? '',
          type: controlFor(spec),
          order: spec.ui.list.order ?? 0,
        });
      }
    }
  };

  walk(entity.fields, '');
  return rows.sort((a, b) => a.order - b.order).map(({ key, icon, type }) => ({ key, icon, type }));
};
