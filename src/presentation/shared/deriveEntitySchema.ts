import type { EntityKey, FkSpec, NativeFieldSpec } from '../../domain/schema/entityRegistry';
import { ENTITY_REGISTRY } from '../../domain/schema/entityRegistry';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import { nativeSpecToFieldDefinition, resolveEntity } from '../../domain/schema/screenEntity';
import type { CustomFieldType, FieldDefinition } from '../../domain/entities';

/**
 * Relações (`fks`) viram campos `reference` do formulário — o controle genérico resolve as opções
 * via `useReferenceOptions`. FKs de etiquetas ficam de fora marcando `ui: { form: false }` (quem
 * trata é o TagManager).
 */
const fkToFieldDefinition = (fk: FkSpec, order: number): FieldDefinition => ({
  key: fk.key,
  label: fk.label,
  type: 'reference',
  required: fk.required ?? false,
  order,
  origin: 'builtin',
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
 * Campos do formulário de uma COLEÇÃO qualquer — fixa, de extensão ou do Form Design. A lista sai
 * de `resolveEntity`, que já mesclou o que o código declara com o que a tela do tenant declara;
 * aqui só resta achatar objetos aninhados em chaves-com-ponto (`address.city`), esconder o que não
 * vai ao formulário e ordenar.
 */
export const deriveFormFields = (
  ctx: SchemaContext,
  collection: EntityKey,
  opts: DeriveFormOptions = {},
): FieldDefinition[] => {
  const entity = resolveEntity(ctx, collection);
  if (!entity) return opts.extra ?? [];

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
      derived.push(nativeSpecToFieldDefinition(spec, `${prefix}${spec.key}`, spec.ui?.order ?? auto));
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

  const withOverrides = derived.map(
    (field) => (opts.overrides?.[field.key] ? { ...field, ...opts.overrides[field.key] } : field),
  );

  const ordered = [...withOverrides].sort((a, b) => a.order - b.order);
  return opts.extra ? [...ordered, ...opts.extra] : ordered;
};

export interface DerivedListRow {
  key: string;
  icon: string;
  /** Controle do campo — permite ao card formatar moeda/data corretamente. */
  type: CustomFieldType;
  /** Presente nas relações: o card resolve o ID para o rótulo via useReferenceOptions. */
  refEntity?: string;
}

const controlFor = (spec: NativeFieldSpec): CustomFieldType =>
  nativeSpecToFieldDefinition(spec, spec.key, 0).type;

/**
 * Linhas do card de listagem de uma entidade FIXA: campos com `ui.list`, ordenados por
 * `ui.list.order`. Não depende do tenant — é o layout que o código declara.
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

  for (const fk of entity.fks) {
    if (!fk.ui?.list) continue;
    rows.push({
      key: fk.key,
      icon: fk.ui.list.icon ?? '',
      type: 'reference',
      refEntity: fk.targetCollection,
      order: fk.ui.list.order ?? 0,
    });
  }

  return rows
    .sort((a, b) => a.order - b.order)
    .map(({ key, icon, type, refEntity }) => ({ key, icon, type, refEntity }));
};
