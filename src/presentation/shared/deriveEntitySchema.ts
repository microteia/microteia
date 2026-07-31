import type { EntityKey, FkSpec, NativeFieldSpec } from '../../domain/schema/entityRegistry';
import type { SchemaContext } from '../../domain/schema/pathResolver';
import { createSchemaContext, nativeSpecToFieldDefinition, resolveEntity } from '../../domain/schema/screenEntity';
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
  filterable: fk.ui?.filter === true,
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
  const emitted = new Set<string>();
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
      emitted.add(`${prefix}${spec.key}`);
      auto += 1;
    }
  };

  walk(entity.fields, '');

  // A MESMA relação pode chegar pelos dois lados: como `fk` do registro e como campo `reference`
  // declarado pela tela que descreve a coleção. A declaração da tela vence — ela é a que sobrevive
  // à saída da entidade do kernel —, e a `fk` correspondente é descartada em vez de duplicar o campo.
  for (const fk of entity.fks) {
    if (fk.ui?.form === false || emitted.has(fk.key)) {
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
 * Meta-linhas do card de listagem de uma coleção: os campos com ÍCONE de listagem
 * (`ui.list.icon` — `listIcon` na forma de autoria), ordenados por `ui.list.order`.
 *
 * A lista sai de `resolveEntity`, então a declaração vale igual venha ela do `entityRegistry` (as
 * entidades que ainda estão no kernel) ou da TELA que descreve a coleção (extensão ou Form Design).
 * É o que permite uma extensão reproduzir — e depois substituir — o card de uma tela fixa.
 *
 * Sem ícone o campo não vira linha: continua no bloco de campos adicionais (`showInList`), que é
 * mais rico (rótulo, badges coloridos, markdown). São duas apresentações diferentes de propósito.
 */
export const deriveListRows = (ctx: SchemaContext, collection: EntityKey): DerivedListRow[] => {
  const entity = resolveEntity(ctx, collection);
  if (!entity) return [];
  const rows: (DerivedListRow & { order: number })[] = [];

  const walk = (specs: NativeFieldSpec[], prefix: string): void => {
    for (const spec of specs) {
      if (spec.type === 'object' && spec.objectFields) {
        walk(spec.objectFields, `${prefix}${spec.key}.`);
        continue;
      }
      if (spec.ui?.list?.icon) {
        rows.push({
          key: `${prefix}${spec.key}`,
          icon: spec.ui.list.icon,
          type: controlFor(spec),
          // Um campo de referência declarado por tela é a mesma coisa que uma `fk` do registro: sem
          // a entidade alvo aqui, o card mostraria o id cru no lugar do nome.
          ...(spec.refEntity ? { refEntity: spec.refEntity } : {}),
          order: spec.ui.list.order ?? 0,
        });
      }
    }
  };

  walk(entity.fields, '');

  for (const fk of entity.fks) {
    if (!fk.ui?.list?.icon || rows.some((row) => row.key === fk.key)) continue;
    rows.push({
      key: fk.key,
      icon: fk.ui.list.icon,
      type: 'reference',
      refEntity: fk.targetCollection,
      order: fk.ui.list.order ?? 0,
    });
  }

  return rows
    .sort((a, b) => a.order - b.order)
    .map(({ key, icon, type, refEntity }) => ({ key, icon, type, refEntity }));
};

/** Atalho para as telas fixas, que leem o layout direto do código, sem o contexto do tenant. */
export const deriveBuiltinListRows = (entityKey: EntityKey): DerivedListRow[] =>
  deriveListRows(createSchemaContext(), entityKey);
