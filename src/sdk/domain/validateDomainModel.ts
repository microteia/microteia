import { aggregationCreatesCycle } from '../../domain/schema/aggregationSpec';
import type { MappedTransition } from './behaviorMapping';
import { validateBehaviorModel } from './validateBehaviorModel';
import { screenIdIssue } from '../../domain/schema/screenEntity';
import { validateFieldKey } from '../../domain/services/customFieldValues';
import type { CatalogEntity, DomainCatalog } from './catalog';
import { catalogSchemaContext, exceptionKey } from './catalog';
import type { DomainEntity, DomainField, DomainIssue, DomainKey, DomainModel } from './domainModel';
import { SCREEN_IS_NOT_AN_ENTITY_MODEL, hasBlockingIssue, sortIssues } from './domainModel';
import type { DomainIssueCode } from './detectors';
import type { MappedRelationship } from './storageMapping';
import { canonicalRelationship, mapRelationship } from './storageMapping';
import type { ExpandedModel } from './toPlatform';
import { collectionOfEntity, collectionResolver, embeddedStrategyNote, expandEmbedded, modelScreenInputs } from './toPlatform';

/**
 * O MOTOR DETERMINÍSTICO. A IA propõe, isto responde.
 *
 * Nada aqui pergunta a um modelo de linguagem se um campo "parece" pertencer a outra entidade: cada
 * detector é uma comparação sobre o modelo e sobre o catálogo real, e por isso a mesma entrada dá
 * sempre a mesma saída — que é a única propriedade que faz uma regra valer a pena escrever. O que não
 * cabe numa comparação fica como instrução no `AGENTS.md`, e está dito lá que é instrução.
 *
 * Três decisões atravessam o arquivo:
 *
 * - **A regra não é "nunca duplique".** É "o dado que é fonte de verdade fica normalizado, salvo
 *   razão semântica declarada". `SaleItem.unitPrice` é um snapshot legítimo, e passa — desde que
 *   `source` e `reason` estejam ali. O detector persegue a duplicação MUDA, não a duplicação.
 * - **Toda regra tem porta de saída**, e ela vai escrita no problema. Regra sem exceção declarável
 *   ensina a ignorar o veredito, e o autor aprende a passar por cima também das que importam.
 * - **Onde o kernel já responde, quem responde é o kernel.** `screenIdIssue`, `validateFieldKey` e
 *   `aggregationCreatesCycle` são chamados de verdade — a referência de mensagem que eles devolvem
 *   viaja dentro do problema, e quem imprime resolve.
 */

export interface DomainValidation {
  ok: boolean;
  issues: DomainIssue[];
  /** O modelo com os `embedded` já achatados — é dele que o plano parte. */
  expanded: ExpandedModel;
  /** Os relacionamentos canonizados e mapeados. Definição ÚNICA: nada os reinterpreta depois. */
  relationships: MappedRelationship[];
  /**
   * As transições traduzidas para automação real. Vazio quando o modelo não declara comportamento —
   * o que é legítimo, e diferente de declarar comportamento que não passa.
   */
  transitions: MappedTransition[];
}

type Draft = Omit<DomainIssue, 'code' | 'severity'>;

const make = (code: DomainIssueCode, severity: DomainIssue['severity'], draft: Draft): DomainIssue => ({
  code,
  severity,
  ...draft,
});

/**
 * O SUFIXO decide a força da evidência, e a distinção nasceu de um corpus de modelos BONS.
 *
 * A primeira versão tinha uma lista só de "atributos genéricos", e ela reprovava quatro campos
 * legítimos em três domínios diferentes: `Ticket.requesterCode` (o código do chamado no sistema do
 * solicitante), `Ticket.agentNotes` (a anotação que o atendente escreve NESTE chamado),
 * `Appointment.insuranceCode` (a autorização que o convênio devolveu para ESTE atendimento) e
 * `Enrollment.studentNumber` (o número de chamada, que muda a cada matrícula). Nos quatro o dado é
 * de quem declara, e o prefixo diz de QUEM ele fala, não de quem ele é.
 *
 * A diferença é o sufixo:
 *
 * - **Identidade** — `name`, `email`, `phone`, `document`, `address`: descrevem a OUTRA entidade e
 *   nada mais. Uma venda não tem nome de cliente próprio.
 * - **Ambíguo** — `code`, `number`, `status`, `notes`, `date`: descrevem tão bem a relação vista
 *   deste lado quanto a outra entidade. Sozinhos não provam nada.
 * - **Chave estrangeira** — `id`/`ids`: não são ambíguos em nenhuma direção. Um `<entidade>Id`
 *   guardado como escalar É uma referência que ninguém declarou.
 *
 * Um sufixo ambíguo também conta como identidade quando o ALVO declara aquele campo: se `Product`
 * tem `price`, então `productPrice` noutra entidade é a cópia dele, e não uma coincidência.
 */
const IDENTITY_ATTRIBUTES = new Set([
  'name', 'names', 'fullname', 'firstname', 'lastname', 'displayname', 'nickname',
  'email', 'emails', 'phone', 'phones', 'mobile', 'document', 'documents',
  'address', 'street', 'city', 'state', 'country', 'zip', 'postcode',
  'birthdate', 'photo', 'avatar', 'image',
]);

const AMBIGUOUS_ATTRIBUTES = new Set([
  'key', 'code', 'number', 'status', 'date', 'type', 'category', 'title', 'label', 'description',
  'price', 'value', 'amount', 'total', 'quantity', 'notes', 'comment', 'reference',
  'position', 'order', 'count', 'at', 'by',
]);

const FOREIGN_KEY_SUFFIXES = new Set(['id', 'ids']);

const lower = (value: string): string => value.toLowerCase();

/** `persons` -> `person`; `sales` -> `sale`. Só para reconhecer o prefixo, nunca para nomear nada. */
const singular = (value: string): string =>
  (value.length > 3 && value.endsWith('s') ? value.slice(0, -1) : value);

interface Handle {
  /** O prefixo em minúsculas que um campo acoplado usaria. */
  token: string;
  /** Como o problema se refere à entidade. */
  display: string;
  /** A entidade do modelo, quando ela é do modelo. */
  modelName?: string;
  collection?: string;
  fieldKeys: Set<string>;
}

const handlesOf = (model: DomainModel, catalog: DomainCatalog): Handle[] => {
  const handles: Handle[] = [];

  for (const entity of model.entities) {
    const fieldKeys = new Set(entity.fields.map((field) => lower(field.key)));
    const collection = collectionOfEntity(entity);
    for (const token of new Set([lower(entity.name), lower(collection), singular(lower(collection))])) {
      handles.push({ token, display: entity.name, modelName: entity.name, collection, fieldKeys });
    }
  }

  for (const entity of catalog.entities) {
    const fieldKeys = new Set(entity.fields.map((field) => lower(field.key)));
    for (const token of new Set([lower(entity.collection), singular(lower(entity.collection))])) {
      handles.push({ token, display: entity.collection, collection: entity.collection, fieldKeys });
    }
  }

  // Do maior para o menor: `saleItem` tem de ganhar de `sale` quando os dois casam.
  return handles.sort((a, b) => b.token.length - a.token.length);
};

/** O prefixo em camelCase de uma chave: `customerName` -> `customer`; `total` -> `total`. */
const camelPrefix = (key: string): string => {
  const match = /^([a-z][a-z0-9_]*?)(?=[A-Z_])/.exec(key);
  return match ? match[1] : lower(key);
};

type HitStrength = 'identity' | 'ambiguous' | 'foreign-key';

interface CoupledHit {
  handle: Handle;
  field: DomainField;
  remainder: string;
  strength: HitStrength;
}

const coupledHit = (field: DomainField, entity: DomainEntity, handles: readonly Handle[]): CoupledHit | null => {
  const key = lower(field.key);
  const own = new Set([lower(entity.name), lower(collectionOfEntity(entity)), singular(lower(collectionOfEntity(entity)))]);

  for (const handle of handles) {
    // O próprio nome nunca acopla: `Sale.saleDate` é a data DA venda, não uma venda dentro dela.
    if (own.has(handle.token)) continue;
    if (key === handle.token || !key.startsWith(handle.token)) continue;
    const remainder = key.slice(handle.token.length).replace(/^_+/, '');
    if (remainder === '') continue;

    if (FOREIGN_KEY_SUFFIXES.has(remainder)) return { handle, field, remainder, strength: 'foreign-key' };
    if (IDENTITY_ATTRIBUTES.has(remainder) || handle.fieldKeys.has(remainder)) {
      return { handle, field, remainder, strength: 'identity' };
    }
    if (AMBIGUOUS_ATTRIBUTES.has(remainder)) return { handle, field, remainder, strength: 'ambiguous' };
  }
  return null;
};

const DUPLICATION_EXCEPTION =
  'Declare the copy: semanticType "snapshot" with `source: "<Entity>.<field>"` and a `reason` saying why the value must not follow '
  + 'the origin (a historical price, a name as it was on the day). Or declare it on the relationship as '
  + '`denormalize: { denormKey, fields, reason }`, which is the platform\'s own mechanism and keeps the copy in step with the origin.';

// ─── Detectores ───────────────────────────────────────────────────────────────

const modelIssues = (model: DomainModel): DomainIssue[] => {
  if (model.target !== 'extension' || model.extensionId?.trim()) return [];
  return [make('domain.model.extension-id-missing', 'error', {
    message: 'target is "extension" but the model does not say which extension the artifacts belong to.',
    suggestion: 'Set `extensionId` to the id of the package in this workspace (for example "com.example.billing"). '
      + 'It is what makes the plan a reconciliation of that package rather than a pile of loose screens.',
    howToDeclareException: 'Use target "screenDefinitions" instead — the artifacts are then created directly in this organization and belong to nobody.',
  })];
};

const entityIssues = (
  model: DomainModel,
  catalog: DomainCatalog,
  existingCollections: ReadonlySet<string>,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const seenNames = new Set<string>();
  const seenCollections = new Set<string>();
  const lookupNames = new Set(catalog.lookups.map((one) => one.collection));
  const tagNames = new Set(catalog.tagLists.map((one) => one.collection));

  for (const entity of model.entities) {
    if (seenNames.has(entity.name)) {
      issues.push(make('domain.entity.duplicate', 'error', {
        entity: entity.name,
        message: `Two entities are called "${entity.name}".`,
        suggestion: 'Names are how relationships point at entities. Rename one of them.',
        howToDeclareException: 'None.',
      }));
    }
    seenNames.add(entity.name);

    if (entity.kind === 'valueObject') continue;

    const collection = collectionOfEntity(entity);
    if (seenCollections.has(collection)) {
      issues.push(make('domain.entity.duplicate', 'error', {
        entity: entity.name,
        message: `Two entities map to the collection "${collection}".`,
        suggestion: 'Set `collection` explicitly on one of them — a collection has one schema, not two.',
        howToDeclareException: 'A second screen over an existing collection is a `screenPatch`, not a second entity. Model it once and add fields to it.',
      }));
    }
    seenCollections.add(collection);

    if (entity.kind !== 'lookup') {
      const nameIssue = screenIdIssue(collection);
      if (nameIssue !== undefined) {
        issues.push(make('domain.entity.collection-invalid', 'error', {
          entity: entity.name,
          message: `The collection "${collection}" cannot be used: ${nameIssue.message}`,
          suggestion: 'Pick another collection name. Names reserved by the system and names already taken by a list of options are refused by the '
            + 'installer too, so this is the same verdict you would get there.',
          howToDeclareException: 'None. The name is refused by the platform, not by this check.',
        }));
      }
      if (lookupNames.has(collection) || tagNames.has(collection)) {
        issues.push(make('domain.entity.collection-invalid', 'error', {
          entity: entity.name,
          message: `"${collection}" is already a ${lookupNames.has(collection) ? 'list of options' : 'tag list'} here. Screens, lists and tag lists share one namespace.`,
          suggestion: 'Rename the entity collection, or model it as kind "lookup" if it really is vocabulary.',
          howToDeclareException: 'None.',
        }));
      }
      if (existingCollections.has(collection)) {
        const existing = catalog.entities.find((one) => one.collection === collection) as CatalogEntity;
        // De ONDE ele já existe muda o que fazer com a informação: uma coleção do workspace está no
        // `plugin.ts` que se edita, e uma da instalação já está gravada no escritório — declarar
        // menos campos do que ela tem não a encolhe, e é o plano que dirá isso.
        const where = existing.source === 'installation'
          ? ' in the installation snapshot — it is already running in this organization'
          : existing.source === 'kernel' ? ' in the platform itself' : ' in this workspace';
        issues.push(make('domain.entity.collection-exists', 'info', {
          entity: entity.name,
          message: `"${collection}" already exists${where}${existing.ownerPluginId ? ` (owned by ${existing.ownerPluginId})` : ''}. The plan will reconcile with it, never recreate it.`,
          suggestion: 'Nothing to change. Declare the full schema you want; the plan reports which fields are new, which already match, and which cannot change.',
          howToDeclareException: 'None needed — this is information.',
        }));
      }

      const titleField = entity.titleField?.trim();
      if (!titleField || !entity.fields.some((field) => field.key === titleField)) {
        issues.push(make('domain.entity.missing-title-field', 'error', {
          entity: entity.name,
          message: titleField
            ? `titleField "${titleField}" is not a field of "${entity.name}".`
            : `"${entity.name}" has no titleField, so every record of it would read as untitled in the list, in the search and in every reference to it.`,
          suggestion: 'Point titleField at the text field a person would use to recognise one record from another.',
          howToDeclareException: 'None. Every screen the platform draws needs a titleFieldKey.',
        }));
      }
    }

    if (entity.kind === 'lookup') {
      const attributes = entity.fields.filter((field) => !['key', 'label', 'color'].includes(field.key));
      if (attributes.length > 0) {
        issues.push(make('domain.entity.lookup-with-attributes', 'warning', {
          entity: entity.name,
          message: `"${entity.name}" is declared a list of options but carries ${attributes.length} attribute(s) of its own (${attributes.map((one) => one.key).join(', ')}).`,
          suggestion: 'A list of options stores key, label and colour, and nothing else. Something with attributes is an entity: declare kind "entity" and point at it with storage "reference".',
          howToDeclareException: 'If the extra fields are decoration you will never read back, drop them. If you will read them, it is an entity.',
        }));
      }
    }
  }

  for (const entity of model.entities.filter((one) => one.kind === 'child')) {
    const hangs = model.relationships
      .map(canonicalRelationship)
      .some((one) => one.storage === 'child' && one.sourceEntity === entity.name);
    if (!hangs) {
      issues.push(make('domain.entity.child-without-parent', 'error', {
        entity: entity.name,
        message: `"${entity.name}" is kind "child" but no relationship hangs it from a parent.`,
        suggestion: `Declare { sourceEntity: "${entity.name}", targetEntity: "<parent>", sourceField: "<the reference field>", type: "many-to-one", storage: "child", ownership: "composition" }. `
          + 'A child with no parent is a top-level entity with no menu entry — records nobody can reach.',
        howToDeclareException: 'If it is genuinely top-level, declare kind "entity".',
      }));
    }
  }

  return issues;
};

const fieldIssues = (
  model: DomainModel,
  catalog: DomainCatalog,
  resolve: (name: string) => string | undefined,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const byName = new Map(model.entities.map((one) => [one.name, one]));

  for (const entity of model.entities) {
    const seen = new Set<string>();
    for (const field of entity.fields) {
      if (seen.has(field.key)) {
        issues.push(make('domain.field.duplicate', 'error', {
          entity: entity.name,
          field: field.key,
          message: `"${entity.name}" declares "${field.key}" twice.`,
          suggestion: 'One key, one field. The record has a single value under that key.',
          howToDeclareException: 'None.',
        }));
      }
      seen.add(field.key);

      const keyIssue = validateFieldKey(field.key);
      if (keyIssue !== undefined) {
        issues.push(make('domain.field.key-invalid', 'error', {
          entity: entity.name,
          field: field.key,
          message: `"${field.key}" is not a valid field key: ${keyIssue.message}`,
          suggestion: 'Keys are javascript-safe names: a letter or underscore, then letters, digits and underscores. A dot is refused too — '
            + 'the platform has no nested object field, which is why an embedded value object is flattened.',
          howToDeclareException: 'None. Expressions, filters and the form all address a field by this key.',
        }));
      }

      if (field.semanticType === 'snapshot') {
        if (!field.source?.trim() || !field.reason?.trim()) {
          issues.push(make('domain.field.snapshot-undeclared', 'error', {
            entity: entity.name,
            field: field.key,
            message: `"${entity.name}.${field.key}" is a snapshot without ${!field.source?.trim() ? 'a `source`' : ''}${!field.source?.trim() && !field.reason?.trim() ? ' and ' : ''}${!field.reason?.trim() ? 'a `reason`' : ''}.`,
            suggestion: 'A snapshot is a copy that must NOT follow the origin. Say where it came from (`source: "Product.price"`) and why it is frozen '
              + '("the price charged on the day; changing the catalogue must not rewrite past sales"). Without both, nobody reading this later can tell '
              + 'a deliberate snapshot from an accident.',
            howToDeclareException: 'If the value should follow the origin, it is not a snapshot: use the relationship\'s `denormalize`, or read it through the reference.',
          }));
        } else {
          const [sourceEntity, sourceField] = field.source.split('.');
          const target = byName.get(sourceEntity);
          const known = target !== undefined || resolve(sourceEntity) !== undefined;
          const fieldKnown = target === undefined
            ? catalog.entities.find((one) => one.collection === resolve(sourceEntity))?.fields.some((one) => one.key === sourceField)
            : target.fields.some((one) => one.key === sourceField);
          if (!known || sourceField === undefined || fieldKnown === false) {
            issues.push(make('domain.field.snapshot-unknown-source', 'error', {
              entity: entity.name,
              field: field.key,
              message: `The snapshot source "${field.source}" does not resolve to a field of a known entity.`,
              suggestion: 'Write it as `<Entity>.<field>`, naming an entity of this model or a collection that already exists here.',
              howToDeclareException: 'None. A source nobody can follow is the same as no source at all.',
            }));
          }
        }
      }

      if (field.semanticType === 'derived') {
        if (field.derivedFrom === undefined) {
          issues.push(make('domain.field.derived-self-without-expression', 'error', {
            entity: entity.name,
            field: field.key,
            message: `"${field.key}" is derived but does not say derived from WHAT.`,
            suggestion: 'These are two different mechanisms here: `derivedFrom: "self"` becomes a compute expression over this record, '
              + '`derivedFrom: "children"` becomes an aggregation the server recomputes when a child changes. A compute expression cannot see children — '
              + 'it would return zero forever, and nothing would ever say so.',
            howToDeclareException: 'None.',
          }));
        }
        if (field.derivedFrom === 'self' && !field.expression?.trim()) {
          issues.push(make('domain.field.derived-self-without-expression', 'error', {
            entity: entity.name,
            field: field.key,
            message: `"${field.key}" is derived from itself but carries no expression.`,
            suggestion: 'Give it `expression` — it becomes `logic.compute`, evaluated on save. Ask `list_expression_functions` for what it may call.',
            howToDeclareException: 'None.',
          }));
        }
        if (field.derivedFrom === 'children' && field.aggregation === undefined) {
          issues.push(make('domain.field.derived-children-without-aggregation', 'error', {
            entity: entity.name,
            field: field.key,
            message: `"${field.key}" is derived from children but carries no aggregation.`,
            suggestion: 'Give it `aggregation: { from, via, op, field? }`. The dependency is declared, never inferred, because that is what tells the engine '
              + 'when to recompute the parent.',
            howToDeclareException: 'None.',
          }));
        }
      }

      if (field.semanticType === 'reference') {
        if (!field.target?.trim()) {
          issues.push(make('domain.field.reference-without-relationship', 'error', {
            entity: entity.name,
            field: field.key,
            message: `"${field.key}" is a reference with no target.`,
            suggestion: 'Say what it points at, and declare the relationship that gives it meaning.',
            howToDeclareException: 'None.',
          }));
        } else if (resolve(field.target) === undefined) {
          issues.push(make('domain.relationship.unknown-target', 'error', {
            entity: entity.name,
            field: field.key,
            message: `"${field.key}" points at "${field.target}", which is neither an entity of this model nor a collection that already exists here.`,
            suggestion: 'Model it, or point at an existing collection — "list_entities" has the ones this workspace knows.',
            howToDeclareException: 'None.',
          }));
        }
      }
    }
  }
  return issues;
};

/**
 * O DETECTOR CENTRAL — "A screen is not an entity model" virando reprovação.
 *
 * Um campo só: o campo é do outro. Vários com o mesmo prefixo: a outra entidade inteira foi copiada
 * para dentro desta. São o mesmo defeito em duas escalas, e por isso o de grupo suprime o individual:
 * quatro problemas dizendo a mesma frase sobre `customerName`, `customerEmail`, `customerPhone` e
 * `customerCity` é a forma mais fácil de fazer alguém parar de ler.
 */
const couplingIssues = (
  model: DomainModel,
  catalog: DomainCatalog,
  expandedKeys: ReadonlySet<string>,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const handles = handlesOf(model, catalog);
  const known = new Set(handles.map((one) => one.token));

  for (const entity of model.entities) {
    if (entity.kind === 'lookup') continue;

    const relationshipFields = new Set(
      model.relationships
        .map(canonicalRelationship)
        .filter((one) => one.sourceEntity === entity.name)
        .map((one) => one.sourceField),
    );
    const denormalized = new Set(
      model.relationships
        .map(canonicalRelationship)
        .filter((one) => one.sourceEntity === entity.name && one.denormalize)
        .flatMap((one) => (one.denormalize as { denormKey: string; fields: string[] }).fields
          .map((field) => `${(one.denormalize as { denormKey: string }).denormKey}.${field}`)),
    );

    // Só campo ESCALAR acopla. Uma referência é o vínculo; um snapshot declarado é decisão tomada.
    //
    // E a decisão SOBREVIVE: um snapshot declarado numa sessão anterior chega pelo catálogo, porque o
    // artefato guarda um campo comum e nada mais. Sem esta consulta, quem remodelasse a coleção a
    // partir do que está instalado reabriria a mesma discussão toda sessão, e a resposta seria a
    // mesma toda sessão — que é o jeito mais rápido de ensinar a ignorar o veredito.
    const collection = collectionOfEntity(entity);
    const onRecord = new Map(catalog.exceptions.map((one) => [exceptionKey(one.collection, one.field), one]));

    const candidates = entity.fields.filter((field) => field.semanticType === 'scalar'
      && !relationshipFields.has(field.key)
      && !denormalized.has(field.key)
      && !onRecord.has(exceptionKey(collection, field.key)));

    for (const field of entity.fields) {
      const recorded = onRecord.get(exceptionKey(collection, field.key));
      if (recorded === undefined || field.semanticType !== 'scalar') continue;
      issues.push(make('domain.field.exception-on-record', 'info', {
        entity: entity.name,
        field: field.key,
        message: `"${collection}.${field.key}" was already declared a deliberate copy of ${recorded.source} in ${recorded.declaredIn}: `
          + `"${recorded.reason}". It is not raised again.`,
        suggestion: 'Nothing to change. If the copy should now follow the origin, drop it and read the value through the reference — '
          + 'and remove the declaration, so the next reader is not told a copy is intended when it no longer is.',
        howToDeclareException: 'None needed — this IS the exception, still standing.',
      }));
    }

    // ─ Coleção modelada como campos numerados ─
    const numbered = new Map<string, DomainField[]>();
    for (const field of entity.fields) {
      const match = /^(.*[^\d])(\d+)$/.exec(field.key);
      if (!match) continue;
      const group = numbered.get(match[1]) ?? [];
      group.push(field);
      numbered.set(match[1], group);
    }
    for (const [base, group] of numbered) {
      if (group.length < 2) continue;
      issues.push(make('domain.field.numbered-collection', 'error', {
        entity: entity.name,
        field: group[0].key,
        message: `"${entity.name}" models a collection as numbered fields: ${group.map((one) => one.key).join(', ')}. `
          + `${SCREEN_IS_NOT_AN_ENTITY_MODEL} A form with three slots is a layout decision; three slots in the document is a modelling one.`,
        suggestion: `There is no fourth ${base}, and there never will be. Model the repeated thing as its own entity of kind "child", with a relationship `
          + `{ sourceEntity: "<the child>", targetEntity: "${entity.name}", type: "many-to-one", storage: "child", ownership: "composition" }. `
          + 'That is also the only shape the platform can total, filter or count.',
        howToDeclareException: 'None. Numbered fields cannot be aggregated, cannot be filtered as a set, and cannot grow. '
          + 'If the count is genuinely fixed at one, drop the number from the key.',
      }));
    }
    const numberedKeys = new Set([...numbered.values()].filter((group) => group.length >= 2).flat().map((one) => one.key));

    // ─ Campos que pertencem a outra entidade ─
    const hits = candidates
      .filter((field) => !numberedKeys.has(field.key))
      .map((field) => coupledHit(field, entity, handles))
      .filter((hit): hit is CoupledHit => hit !== null);

    const byHandle = new Map<string, CoupledHit[]>();
    for (const hit of hits) {
      const group = byHandle.get(hit.handle.display) ?? [];
      group.push(hit);
      byHandle.set(hit.handle.display, group);
    }

    for (const [display, group] of byHandle) {
      const related = model.relationships
        .map(canonicalRelationship)
        .some((one) => one.sourceEntity === entity.name && (one.targetEntity === display || one.targetEntity === group[0].handle.modelName));

      /**
       * Uma CHAVE ESTRANGEIRA guardada como escalar não é ambígua em direção nenhuma: `requesterId`
       * num chamado, com Requester modelado, é a referência que ninguém declarou. Continua erro
       * depois do rebaixamento do resto — e é ela que impede o portão de virar decorativo.
       */
      for (const hit of group.filter((one) => one.strength === 'foreign-key')) {
        issues.push(make('domain.field.reference-without-relationship', 'error', {
          entity: entity.name,
          field: hit.field.key,
          message: `"${entity.name}.${hit.field.key}" holds the id of a ${display} record as plain data, and no relationship says so.`,
          suggestion: `Declare it as semanticType "reference" with target "${display}", and add the relationship. A foreign key the model does not `
            + 'know about gets no selector, no display of the referenced record, and no integrity of any kind — it is a string that happens to look like an id.',
          howToDeclareException: 'If the id belongs to a system this model does not describe, it is not a foreign key here: rename it so it says so '
            + `(for example "external${display}Ref"), and it stops being read as one.`,
        }));
      }

      const coupling = group.filter((one) => one.strength !== 'foreign-key');
      const strong = coupling.filter((one) => one.strength === 'identity');
      // Só evidência de IDENTIDADE conta para o limiar. Um sufixo ambíguo sozinho — `code`, `notes`,
      // `number` — descreve a relação vista deste lado tão bem quanto descreve o outro registro, e
      // reprovar por ele reprovava quatro campos legítimos em três domínios diferentes.
      if (strong.length === 0) continue;

      const shared: Draft = {
        entity: entity.name,
        field: coupling[0].field.key,
        message: strong.length > 1
          ? `"${entity.name}" carries ${coupling.length} field(s) that belong to ${display}: ${coupling.map((one) => one.field.key).join(', ')}. ${SCREEN_IS_NOT_AN_ENTITY_MODEL}`
          : `"${entity.name}.${strong[0].field.key}" looks like an attribute of ${display}, held as this entity's own data. ${SCREEN_IS_NOT_AN_ENTITY_MODEL}`,
        suggestion: related
          ? `A relationship to ${display} is already declared. Read the value through it — the platform materialises the referenced record on demand — `
            + 'or, if the value must be frozen or must be filterable on the server, declare the copy instead of writing it as if it were this entity\'s own.'
          : `Declare the relationship first: { sourceEntity: "${entity.name}", targetEntity: "${display}", sourceField: "<a reference field>", `
            + 'type: "many-to-one", storage: "reference", ownership: "association" }. Then the value is read through the reference, and it stops '
            + 'being a second, silently ageing copy of somebody else\'s data.',
        howToDeclareException: DUPLICATION_EXCEPTION,
      };

      if (strong.length > 1) issues.push(make('domain.field.prefix-group', 'error', shared));
      // UM campo só é indício, não prova: o nome pode ser de alguém que este modelo não cadastra.
      // Um portão que reprova por indício é um portão que se aprende a contornar.
      else issues.push(make('domain.field.belongs-to-other-entity', 'warning', shared));
    }

    // ─ Grupo com prefixo comum que NINGUÉM nomeou ─
    //
    // As chaves que a EXPANSÃO produziu ficam de fora, e este era um defeito real: `homeStreet`,
    // `homeCity`, `homeZip` nascem de um `valueObject` chamado Address, achatado pela própria
    // plataforma — o conceito TEM nome, e o detector acusava o modelo de não o ter dado.
    const hitKeys = new Set(hits.map((one) => one.field.key));
    const unnamed = new Map<string, DomainField[]>();
    for (const field of candidates) {
      if (hitKeys.has(field.key) || numberedKeys.has(field.key) || expandedKeys.has(field.key)) continue;
      const prefix = camelPrefix(field.key);
      if (prefix === lower(field.key) || known.has(prefix)) continue;
      const group = unnamed.get(prefix) ?? [];
      group.push(field);
      unnamed.set(prefix, group);
    }
    for (const [prefix, group] of unnamed) {
      if (group.length < 3) continue;
      issues.push(make('domain.field.prefix-group-unnamed', 'warning', {
        entity: entity.name,
        field: group[0].key,
        message: `"${entity.name}" has ${group.length} fields under the prefix "${prefix}" (${group.map((one) => one.key).join(', ')}), and nothing by that name is modelled.`,
        suggestion: `That prefix is usually a concept waiting for a name. If "${prefix}" has an identity of its own and is reused elsewhere, it is an entity. `
          + 'If it only ever exists inside this record, declare it as a `valueObject` and reference it with semanticType "embedded" — the platform stores it '
          + 'flat with a section, and the intent survives in the model.',
        howToDeclareException: 'Keep the fields as they are. A shared prefix is not by itself a defect — this is a warning, and it does not block the plan.',
      }));
    }
  }

  return issues;
};

const relationshipIssues = (
  model: DomainModel,
  mapped: readonly MappedRelationship[],
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const byName = new Map(model.entities.map((one) => [one.name, one]));

  for (const { relationship, multi } of mapped) {
    const source = byName.get(relationship.sourceEntity);
    if (source === undefined) continue;
    const field = source.fields.find((one) => one.key === relationship.sourceField);

    if (field === undefined) {
      issues.push(make('domain.relationship.field-not-declared', 'error', {
        entity: relationship.sourceEntity,
        field: relationship.sourceField,
        message: `The relationship stores the link in "${relationship.sourceEntity}.${relationship.sourceField}", but that field is not declared.`,
        suggestion: `Add it to "${relationship.sourceEntity}": { key: "${relationship.sourceField}", semanticType: "${relationship.storage === 'lookup' ? 'scalar' : 'reference'}", `
          + `${relationship.storage === 'lookup' ? `lookup: "<list collection>"` : `target: "${relationship.targetEntity}"${multi ? ', multi: true' : ''}`} }. `
          + 'The relationship and the field are one declaration seen from two sides; a plan cannot generate half of it.',
        howToDeclareException: 'None.',
      }));
      continue;
    }

    if (relationship.storage !== 'lookup' && field.semanticType !== 'reference') {
      issues.push(make('domain.relationship.field-not-declared', 'error', {
        entity: relationship.sourceEntity,
        field: relationship.sourceField,
        message: `"${relationship.sourceField}" carries the link to ${relationship.targetEntity}, but it is declared semanticType "${field.semanticType}".`,
        suggestion: 'The field that stores a relationship is semanticType "reference". Anything else stores a copy of a value, not a link.',
        howToDeclareException: 'None.',
      }));
    }

    if (multi && field.multi !== true) {
      issues.push(make('domain.relationship.field-not-declared', 'error', {
        entity: relationship.sourceEntity,
        field: relationship.sourceField,
        message: `The relationship is many-to-many but "${relationship.sourceField}" is not declared \`multi: true\`.`,
        suggestion: 'An association is stored as an array of ids, so the field has to say so.',
        howToDeclareException: 'None.',
      }));
    }

    const attributes = relationship.attributes ?? [];
    if (relationship.storage === 'association' && attributes.length > 0) {
      issues.push(make('domain.relationship.association-with-attributes', 'error', {
        entity: relationship.sourceEntity,
        field: relationship.sourceField,
        message: `${relationship.sourceEntity} <-> ${relationship.targetEntity} is many-to-many AND carries attributes of its own `
          + `(${attributes.map((one) => one.key).join(', ')}), but it is stored as an array of ids. There is nowhere to put those attributes.`,
        suggestion: `Introduce the pair as an entity: a kind "child" entity (say "${relationship.sourceEntity}${relationship.targetEntity}") with one reference `
          + `to ${relationship.sourceEntity} (storage "child", ownership "composition") and one to ${relationship.targetEntity} (storage "reference"), `
          + `carrying ${attributes.map((one) => one.key).join(', ')} itself.`,
        howToDeclareException: 'None, and the limit is checkable rather than stylistic: the aggregation engine reads the parent id out of the child\'s '
          + 'reference field as a single value and queries children by one equality. A multi reference holds an array, so no aggregation can ever walk it — '
          + 'a total over an association is not slow, it is impossible.',
      }));
    }
  }

  return issues;
};

const aggregationIssues = (
  model: DomainModel,
  catalog: DomainCatalog,
  resolve: (name: string) => string | undefined,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const byName = new Map(model.entities.map((one) => [one.name, one]));
  const multiRelationshipFields = new Set(
    model.relationships
      .map(canonicalRelationship)
      .filter((one) => one.storage === 'association')
      .map((one) => `${one.sourceEntity}.${one.sourceField}`),
  );

  for (const entity of model.entities) {
    for (const field of entity.fields) {
      const aggregation = field.aggregation;
      if (field.semanticType !== 'derived' || field.derivedFrom !== 'children' || aggregation === undefined) continue;

      const childModel = byName.get(aggregation.from);
      const childCollection = resolve(aggregation.from);
      const childCatalog = catalog.entities.find((one) => one.collection === childCollection);
      if (childModel === undefined && childCatalog === undefined) {
        issues.push(make('domain.aggregation.unknown-child', 'error', {
          entity: entity.name,
          field: field.key,
          message: `"${field.key}" aggregates over "${aggregation.from}", which is neither an entity of this model nor a collection that already exists here.`,
          suggestion: 'Name the child entity, or point at an existing collection.',
          howToDeclareException: 'None.',
        }));
        continue;
      }

      const viaModel = childModel?.fields.find((one) => one.key === aggregation.via);
      const viaCatalog = childCatalog?.fields.find((one) => one.key === aggregation.via);
      const viaIsReference = viaModel !== undefined
        ? viaModel.semanticType === 'reference'
        : viaCatalog?.type === 'reference';
      const viaIsMulti = viaModel !== undefined
        ? viaModel.multi === true || multiRelationshipFields.has(`${aggregation.from}.${aggregation.via}`)
        : viaCatalog?.multi === true;

      if (viaModel === undefined && viaCatalog === undefined) {
        issues.push(make('domain.aggregation.via-not-a-reference', 'error', {
          entity: entity.name,
          field: field.key,
          message: `"${aggregation.from}" has no field "${aggregation.via}", so nothing links a child back to this record.`,
          suggestion: `"via" is the key of the reference field ON THE CHILD that points at this entity — the same field the relationship stores the link in.`,
          howToDeclareException: 'None.',
        }));
        continue;
      }

      if (!viaIsReference) {
        issues.push(make('domain.aggregation.via-not-a-reference', 'error', {
          entity: entity.name,
          field: field.key,
          message: `"${aggregation.from}.${aggregation.via}" is not a reference field, so it cannot identify the parent record.`,
          suggestion: 'Point "via" at the reference field that carries the link to this entity.',
          howToDeclareException: 'None.',
        }));
        continue;
      }

      if (viaIsMulti) {
        issues.push(make('domain.aggregation.multi-via', 'error', {
          entity: entity.name,
          field: field.key,
          message: `"${field.key}" aggregates over "${aggregation.from}" through "${aggregation.via}", which is a MULTI reference. `
            + 'The engine reads the parent id out of that field as a single value and queries the children by one equality, so an array never matches: '
            + 'the total would be written once as zero and never move again, with nothing reporting it.',
          suggestion: `Give "${aggregation.from}" a single reference to "${entity.name}" and aggregate through that. If the link really is many-to-many, `
            + 'the thing being totalled belongs to a junction entity — model the pair as kind "child" and aggregate over it.',
          howToDeclareException: 'None. This is a limit of the aggregation engine, not a preference.',
        }));
      }
    }
  }

  // O ciclo é perguntado ao KERNEL, com as telas do modelo somadas às que já existem: `A` agrega de
  // `B` que agrega de `A` pararia sozinho (o recompute é idempotente) e nunca convergiria.
  const screens = [
    ...catalog.screens.filter((screen) => !model.entities.some((entity) => collectionOfEntity(entity) === (screen.collection?.trim() || screen.key))),
    ...modelScreenInputs(model, resolve),
  ];
  const ctx = catalogSchemaContext(screens, catalog.lookups, catalog.tagLists);
  for (const entity of model.entities) {
    const table = collectionOfEntity(entity);
    for (const field of entity.fields) {
      const from = field.aggregation?.from;
      if (field.semanticType !== 'derived' || field.derivedFrom !== 'children' || from === undefined) continue;
      const childTable = resolve(from) ?? from;
      if (!aggregationCreatesCycle(ctx, table, childTable)) continue;
      issues.push(make('domain.aggregation.cycle', 'error', {
        entity: entity.name,
        field: field.key,
        message: `"${entity.name}.${field.key}" aggregates from "${from}", and "${from}" reaches back to "${entity.name}" through another aggregation. `
          + 'The value would never settle.',
        suggestion: 'Break the loop: one of the two sides has to hold the number, and the other has to read it through the reference.',
        howToDeclareException: 'None. The platform refuses the same cycle when the screen is saved.',
      }));
    }
  }

  return issues;
};

// ─── A porta ──────────────────────────────────────────────────────────────────

/**
 * A porta ÚNICA. Quem quiser saber se um modelo está de pé pergunta aqui — a tool do MCP, o plano de
 * artefatos e um teste de autoria fazem a mesma chamada, pelo mesmo motivo que `validatePluginPackage`
 * é uma porta só: uma checagem nova acrescentada num caminho tem de chegar aos outros dois.
 */

/**
 * As chaves da entidade — o que não pode se repetir nela.
 *
 * Vale a pena dizer por que isto é validado AQUI e não só na plataforma: a chave é a única
 * declaração do modelo cujo defeito não aparece no dia em que é escrita. Uma chave sobre um campo
 * que não existe simplesmente nunca reserva nada, e a tela segue aceitando duplicata em silêncio —
 * exatamente o estado que a chave foi declarada para acabar.
 */
const keyIssues = (model: DomainModel): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const childEntities = new Set(
    model.relationships.filter((one) => one.storage === 'child').map((one) => one.sourceEntity),
  );

  for (const entity of model.entities) {
    const declared = entity.keys ?? [];
    const shorthand: DomainKey[] = entity.fields
      .filter((field) => field.unique === true)
      .map((field) => ({ name: `field:${field.key}`, kind: 'unique', fields: [field.key] }));
    const keys = [...declared, ...shorthand];
    if (keys.length === 0) continue;

    const fieldByKey = new Map(entity.fields.map((field) => [field.key, field]));
    const seenNames = new Set<string>();
    const seenSignatures = new Map<string, string>();
    let primaries = 0;

    for (const key of keys) {
      if (seenNames.has(key.name)) {
        issues.push(make('model.key.duplicate-name', 'error', {
          entity: entity.name,
          message: `"${entity.name}" declares two keys named "${key.name}".`,
          suggestion: 'The name is what addresses the reservation already written for existing records, so two keys '
            + 'cannot share it. Rename one; do not renumber both.',
          howToDeclareException: 'None.',
        }));
        continue;
      }
      seenNames.add(key.name);

      for (const fieldKey of key.fields) {
        const field = fieldByKey.get(fieldKey);
        if (field === undefined) {
          issues.push(make('model.key.unknown-field', 'error', {
            entity: entity.name,
            field: fieldKey,
            message: `Key "${key.name}" of "${entity.name}" names "${fieldKey}", which is not a field of it.`,
            suggestion: 'A key covers fields of its OWN entity. To be unique against another entity\'s value, '
              + 'the value has to live here — through the relationship, or as a declared snapshot.',
            howToDeclareException: 'None.',
          }));
          continue;
        }
        if (field.semanticType === 'derived') {
          issues.push(make('model.key.derived-field', 'error', {
            entity: entity.name,
            field: fieldKey,
            message: `Key "${key.name}" covers "${fieldKey}", which is derived and is not stored on the record.`,
            suggestion: 'A key reserves the value it reads from the document. A derived value is computed on read, '
              + 'so the reservation would point at a value the record does not carry. Use the fields the derivation '
              + 'reads from.',
            howToDeclareException: 'None.',
          }));
        }
        if (key.kind === 'primary' && field.required !== true) {
          issues.push(make('model.key.optional-primary', 'warning', {
            entity: entity.name,
            field: fieldKey,
            message: `"${fieldKey}" carries the primary key of "${entity.name}" and is not required.`,
            suggestion: 'A primary key is an ADDRESS — it is what an idempotent upsert and a stable link use. An '
              + 'address that may be missing addresses nothing, so mark the field required.',
            howToDeclareException: 'Make it a "unique" key instead: that one only forbids the second value, and it '
              + 'is allowed to be absent.',
          }));
        }
      }

      const signature = `${key.scope ?? 'tenant'}::${[...key.fields].join(' ')}`;
      const twin = seenSignatures.get(signature);
      if (twin !== undefined) {
        issues.push(make('model.key.duplicate-fields', 'warning', {
          entity: entity.name,
          message: `Keys "${twin}" and "${key.name}" of "${entity.name}" cover exactly the same fields.`,
          suggestion: 'One of them says nothing the other does not. Keep the stronger one — a primary outranks a '
            + 'unique — and drop the other.',
          howToDeclareException: 'Two keys over the same fields in DIFFERENT scopes are two different rules, and '
            + 'that is allowed.',
        }));
      } else {
        seenSignatures.set(signature, key.name);
      }

      if (key.kind === 'primary') {
        primaries += 1;
        if (primaries > 1) {
          issues.push(make('model.key.multiple-primary', 'error', {
            entity: entity.name,
            message: `"${entity.name}" declares more than one primary key.`,
            suggestion: 'One entity has one primary key: it is the address of the record. Everything else that must '
              + 'not repeat is a "unique" key.',
            howToDeclareException: 'None.',
          }));
        }
      }

      if (key.scope === 'parent' && !childEntities.has(entity.name)) {
        issues.push(make('model.key.scope-without-parent', 'error', {
          entity: entity.name,
          message: `Key "${key.name}" is scoped to the parent, and "${entity.name}" is nobody's child.`,
          suggestion: 'Scope "parent" means unique WITHIN one parent record — the item numbered 1 of each order. It '
            + 'needs a relationship with storage "child". Without one, the scope is "tenant".',
          howToDeclareException: 'None.',
        }));
      }
    }
  }

  return issues;
};

export const validateDomainModel = (model: DomainModel, catalog: DomainCatalog): DomainValidation => {
  const expanded = expandEmbedded(model);
  const working = expanded.model;
  const existingCollections = new Set(catalog.entities.map((one) => one.collection));
  const resolve = collectionResolver(working, existingCollections);
  const entityByName = new Map(working.entities.map((one) => [one.name, one]));

  const issues: DomainIssue[] = [
    ...modelIssues(working),
    ...expanded.embeds.map((embed) => make('domain.field.embedded-flattened', 'info', {
      entity: embed.entity,
      field: embed.field,
      message: embeddedStrategyNote(embed),
      suggestion: 'Nothing to change. This platform has no nested object field and no dotted field key, so an embedded value object is stored flat '
        + 'and grouped by section — which keeps its leaves reachable from compute, validate and the list filter.',
      howToDeclareException: 'If the object has an identity of its own and is read on its own, it is not embedded: model it as an entity and reference it.',
    })),
    ...expanded.unresolved.map((one) => make('domain.field.embedded-unknown', 'error', {
      entity: one.entity,
      field: one.field,
      message: `"${one.field}" is embedded from "${one.valueObject}", and no entity of kind "valueObject" carries that name.`,
      suggestion: `Declare { name: "${one.valueObject}", kind: "valueObject", fields: [...] }, or make the field a plain scalar.`,
      howToDeclareException: 'None.',
    })),
    ...entityIssues(working, catalog, existingCollections),
    ...fieldIssues(working, catalog, resolve),
    ...keyIssues(working),
    ...couplingIssues(
      working,
      catalog,
      new Set(expanded.embeds.flatMap((embed) => embed.producedKeys)),
    ),
  ];

  const relationships: MappedRelationship[] = [];
  for (const relationship of working.relationships) {
    const result = mapRelationship(relationship, entityByName, resolve);
    issues.push(...result.issues);
    if (result.ok) relationships.push(result.mapped);
  }

  issues.push(...relationshipIssues(working, relationships));
  issues.push(...aggregationIssues(working, catalog, resolve));

  // O comportamento é validado com o modelo JÁ expandido, e por isso depois de tudo: um estado que
  // more num campo achatado de `valueObject` só existe aqui, e perguntar antes daria "campo não
  // declarado" para um campo que a plataforma vai ter.
  const behavior = working.behavior === undefined
    ? { issues: [], transitions: [] }
    : validateBehaviorModel(working, working.behavior, catalog);
  issues.push(...behavior.issues);

  const sorted = sortIssues(issues);
  return {
    ok: !hasBlockingIssue(sorted),
    issues: sorted,
    expanded,
    relationships,
    transitions: behavior.transitions,
  };
};
