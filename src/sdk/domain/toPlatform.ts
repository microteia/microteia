import type { CustomFieldType, FieldDefinition, FieldOrigin } from '../../domain/entities/entitySchemas';
import type { CatalogException, CatalogScreenInput } from './catalog';
import type { DomainEntity, DomainField, DomainModel, DomainRelationship } from './domainModel';
import { EMBEDDED_STRATEGY } from './domainModel';
import { canonicalRelationship } from './storageMapping';

/**
 * A TRADUÇÃO — modelo de domínio para o vocabulário declarativo da plataforma.
 *
 * Ela vive num arquivo só porque é a mesma para o validador e para o plano. Se o validador
 * traduzisse de um jeito para checar ciclos e o plano de outro para propor telas, a checagem
 * responderia sobre um modelo que não é o que vai ser gerado — e o defeito reapareceria exatamente
 * onde a checagem dizia que não havia.
 */

/** `customerName` a partir de `customer` + `name`. */
const camelJoin = (prefix: string, key: string): string =>
  `${prefix}${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/** Profundidade de objeto dentro de objeto. Três é folga; o que passa disso é modelagem, não forma. */
const MAX_EMBED_DEPTH = 3;

export interface ExpandedEmbed {
  entity: string;
  field: string;
  valueObject: string;
  /** As chaves que passaram a existir na raiz do documento. */
  producedKeys: string[];
  section: string;
}

export interface ExpandedModel {
  model: DomainModel;
  embeds: ExpandedEmbed[];
  /** `embedded` que aponta para um objeto que ninguém declarou. */
  unresolved: { entity: string; field: string; valueObject: string }[];
}

const expandFields = (
  fields: readonly DomainField[],
  valueObjects: ReadonlyMap<string, DomainEntity>,
  entityName: string,
  depth: number,
  embeds: ExpandedEmbed[],
  unresolved: ExpandedModel['unresolved'],
): DomainField[] => fields.flatMap((field) => {
  if (field.semanticType !== 'embedded') return [field];

  const objectName = field.embeddedOf ?? '';
  const object = valueObjects.get(objectName);
  if (object === undefined || depth >= MAX_EMBED_DEPTH) {
    if (object === undefined) unresolved.push({ entity: entityName, field: field.key, valueObject: objectName });
    return [];
  }

  const section = field.section ?? field.label;
  const inner = expandFields(object.fields, valueObjects, entityName, depth + 1, embeds, unresolved);
  const produced = inner.map((one) => ({
    ...one,
    key: camelJoin(field.key, one.key),
    label: one.label,
    section,
    ...(field.required === true ? {} : { required: false }),
  }));
  embeds.push({
    entity: entityName,
    field: field.key,
    valueObject: objectName,
    producedKeys: produced.map((one) => one.key),
    section,
  });
  return produced;
});

/**
 * Achata todo `embedded` na raiz do documento, com `section` no lugar do objeto — a tradução escolhida
 * em `EMBEDDED_STRATEGY`, e a única que mantém as folhas ao alcance de `compute`, `validate` e do
 * filtro da listagem. Os `valueObject` desaparecem do modelo expandido: eles nunca foram entidades.
 */
export const expandEmbedded = (model: DomainModel): ExpandedModel => {
  const valueObjects = new Map(model.entities.filter((one) => one.kind === 'valueObject').map((one) => [one.name, one]));
  const embeds: ExpandedEmbed[] = [];
  const unresolved: ExpandedModel['unresolved'] = [];

  const entities = model.entities
    .filter((entity) => entity.kind !== 'valueObject')
    .map((entity) => ({
      ...entity,
      fields: expandFields(entity.fields, valueObjects, entity.name, 0, embeds, unresolved),
    }));

  return { model: { ...model, entities }, embeds, unresolved };
};

export const embeddedStrategyNote = (embed: ExpandedEmbed): string =>
  `"${embed.entity}.${embed.field}" (${embed.valueObject}) is stored flat, as ${embed.producedKeys.join(', ')}, `
  + `grouped in the form under section "${embed.section}" — strategy ${EMBEDDED_STRATEGY}.`;

// ─── Coleções ─────────────────────────────────────────────────────────────────

/** `SaleItem` -> `saleItems`. Só quando a entidade não declara a coleção dela. */
export const derivedCollection = (name: string): string => {
  const head = `${name.charAt(0).toLowerCase()}${name.slice(1)}`.replace(/[^a-zA-Z0-9_]/g, '');
  if (head === '') return 'entity';
  return /[sxz]$/.test(head) ? `${head}es` : `${head}s`;
};

export const collectionOfEntity = (entity: DomainEntity): string =>
  entity.collection?.trim() || derivedCollection(entity.name);

/**
 * Resolve um nome usado numa referência: primeiro as entidades do modelo, depois as coleções que já
 * existem. É por aqui que um modelo aponta para `persons` sem redeclarar Pessoa.
 */
export const collectionResolver = (
  model: DomainModel,
  existingCollections: ReadonlySet<string>,
): ((name: string) => string | undefined) => {
  const byName = new Map(model.entities.map((entity) => [entity.name, collectionOfEntity(entity)]));
  return (name: string): string | undefined => byName.get(name) ?? (existingCollections.has(name) ? name : undefined);
};

// ─── Campos ───────────────────────────────────────────────────────────────────

const DEFAULT_TYPE_BY_SEMANTIC: Record<DomainField['semanticType'], CustomFieldType> = {
  scalar: 'text',
  reference: 'reference',
  snapshot: 'text',
  derived: 'number',
  embedded: 'text',
};

export const fieldToDefinition = (
  field: DomainField,
  order: number,
  origin: FieldOrigin,
  resolve: (name: string) => string | undefined,
): FieldDefinition => {
  const type: CustomFieldType = field.semanticType === 'reference'
    ? 'reference'
    : field.lookup
      ? 'select'
      : field.type ?? DEFAULT_TYPE_BY_SEMANTIC[field.semanticType];

  const definition: FieldDefinition = {
    key: field.key,
    label: field.label,
    type,
    required: field.required === true,
    order,
    origin,
  };

  if (field.section) definition.section = field.section;
  if (field.multi === true) definition.multi = true;
  if (field.filterable === true) definition.filterable = true;
  if (field.showInList === true) definition.showInList = true;
  // O atalho atravessa como atalho: `resolveScreenKeys` o desaçucara na plataforma, e traduzi-lo
  // aqui para uma entrada em `keys` produziria a MESMA chave por dois caminhos — e a de cá venceria
  // uma declaração explícita que o autor tenha escrito com o mesmo nome.
  if (field.unique === true) definition.unique = true;
  if (field.lookup) definition.lookupCollection = field.lookup;
  // O alvo segue o que o campo GRAVA, não o que ele significa: um `derived` que copia por `latest`
  // uma referência grava um id, e sem `refEntity` a tela não sabe abri-lo nem o agregado o compara.
  if (type === 'reference' && field.target) {
    definition.refEntity = resolve(field.target) ?? field.target;
  }
  if (field.semanticType === 'derived' && field.derivedFrom === 'self' && field.expression) {
    definition.logic = { compute: field.expression };
  }
  if (field.semanticType === 'derived' && field.derivedFrom === 'children' && field.aggregation) {
    definition.aggregation = {
      from: resolve(field.aggregation.from) ?? field.aggregation.from,
      via: field.aggregation.via,
      op: field.aggregation.op,
      ...(field.aggregation.field === undefined ? {} : { field: field.aggregation.field }),
      ...(field.aggregation.filter === undefined ? {} : { filter: field.aggregation.filter }),
      ...(field.aggregation.orderBy === undefined ? {} : { orderBy: field.aggregation.orderBy.map((order) => ({ ...order })) }),
    };
  }
  return definition;
};

// ─── Telas ────────────────────────────────────────────────────────────────────

export const originFor = (model: DomainModel): FieldOrigin =>
  (model.target === 'extension' ? 'plugin' : 'design');

/**
 * A tela que uma entidade do modelo vira. O `parent` sai do relacionamento `storage: 'child'` em que
 * ela é a origem — nunca de uma segunda declaração no próprio campo, porque duas fontes para a mesma
 * pergunta é o que este subsistema existe para não ter.
 */
export const entityToScreenInput = (
  entity: DomainEntity,
  model: DomainModel,
  relationships: readonly DomainRelationship[],
  resolve: (name: string) => string | undefined,
): CatalogScreenInput => {
  const origin = originFor(model);
  const collection = collectionOfEntity(entity);
  const mine = relationships.map(canonicalRelationship).filter((one) => one.sourceEntity === entity.name);
  const childOf = mine.find((one) => one.storage === 'child');
  /**
   * `required` do relacionamento vale para o CAMPO que o guarda. As duas declarações são a mesma
   * coisa vista de dois lados, e deixar cada uma com o próprio valor daria um vínculo obrigatório
   * cujo campo aceita vazio — a definição única virando duas.
   */
  const requiredByField = new Map(mine.filter((one) => one.required === true).map((one) => [one.sourceField, true]));

  return {
    key: collection,
    titleSingular: entity.name,
    titlePlural: entity.name,
    titleFieldKey: entity.titleField ?? '',
    ...(entity.keys && entity.keys.length > 0 ? { keys: entity.keys.map((key) => ({ ...key })) } : {}),
    fields: entity.fields.map((field, index) => {
      const definition = fieldToDefinition(field, index, origin, resolve);
      return requiredByField.has(field.key) ? { ...definition, required: true } : definition;
    }),
    ...(childOf === undefined
      ? {}
      : {
        parentEntity: resolve(childOf.targetEntity) ?? childOf.targetEntity,
        parentFieldKey: childOf.sourceField,
        parentRelation: childOf.ownership === 'composition' ? 'owned' : 'related',
      }),
    ...(model.extensionId === undefined ? {} : { ownerPluginId: model.extensionId }),
  };
};

export const modelScreenInputs = (
  model: DomainModel,
  resolve: (name: string) => string | undefined,
): CatalogScreenInput[] => model.entities
  .filter((entity) => entity.kind === 'entity' || entity.kind === 'child')
  .map((entity) => entityToScreenInput(entity, model, model.relationships, resolve));

// ─── Exceções declaradas ──────────────────────────────────────────────────────

/**
 * As duplicações que o modelo declarou, na forma que o catálogo guarda.
 *
 * Só o `snapshot` entra, e a razão é que ele é o único que vira um CAMPO GRAVADO cujo nome engana
 * quem o ler depois. A denormalização declarada na relação não produz campo próprio — a plataforma
 * a materializa na leitura, sob o `refDenormKey` —, então não há o que reaparecer na sessão seguinte.
 */
export const modelExceptions = (model: DomainModel, declaredIn: string): CatalogException[] =>
  model.entities
    .filter((entity) => entity.kind === 'entity' || entity.kind === 'child')
    .flatMap((entity) => entity.fields
      .filter((field) => field.semanticType === 'snapshot' && field.source?.trim() && field.reason?.trim())
      .map((field) => ({
        collection: collectionOfEntity(entity),
        field: field.key,
        semanticType: 'snapshot' as const,
        source: field.source as string,
        reason: field.reason as string,
        declaredIn,
      })));
