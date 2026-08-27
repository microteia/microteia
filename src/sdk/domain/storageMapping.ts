import { MULTI_FK_MATERIALIZE_LIMIT } from '../../domain/schema/materialize';
import type { DomainEntity, DomainIssue, DomainRelationship, RelationshipStorage, RelationshipType } from './domainModel';
import type { ParentRelation } from './catalog';

/**
 * COMO O RELACIONAMENTO É GRAVADO — a tabela que amarra cada `storage` a um mecanismo que existe
 * mesmo, e que RECUSA alto quando não existe.
 *
 * A recusa é o ponto. Um modelo pode descrever qualquer coisa; a plataforma declara quatro. Um plano
 * que aceitasse "cascade" e depois não gerasse cascata nenhuma seria pior que a ausência do campo —
 * o autor confiaria numa promessa que ninguém cumpre, e o dado ficaria órfão em silêncio, que é
 * exatamente o que a seção "Cascata de Exclusão" do ARCHITECTURE.md diz que acontece hoje.
 */

/**
 * A relação é sempre declarada pelo lado que GUARDA o vínculo: `sourceField` mora em `sourceEntity`.
 * A única exceção é `one-to-many`, escrito do lado do "um" porque é assim que a frase de negócio sai
 * ("uma venda tem vários itens") — e ela é CANONIZADA para `many-to-one` antes de qualquer outra
 * coisa, para que só exista uma forma daqui para baixo.
 */
export const canonicalRelationship = (relationship: DomainRelationship): DomainRelationship =>
  (relationship.type === 'one-to-many'
    ? {
      ...relationship,
      type: 'many-to-one',
      sourceEntity: relationship.targetEntity,
      targetEntity: relationship.sourceEntity,
    }
    : relationship);

export interface StorageMechanism {
  storage: RelationshipStorage;
  /** As cardinalidades (já canonizadas) que este armazenamento aceita. */
  cardinalities: RelationshipType[];
  /** O que a plataforma DECLARA — uma linha, para quem lê o plano ou a documentação. */
  declaration: string;
  /** Onde o dado fica, de verdade. */
  storedAs: string;
}

/**
 * Quatro, e são estas. Servem também de fonte para o recurso `microteia://domain-model/rules` — a
 * tabela da documentação sai daqui, e não de uma cópia em prosa que envelhece sozinha.
 */
export const STORAGE_MECHANISMS: StorageMechanism[] = [
  {
    storage: 'reference',
    cardinalities: ['many-to-one', 'one-to-one'],
    declaration: "field { type: 'reference', refEntity: <target collection>, multi: false } on the source screen",
    storedAs: 'the target record id, as a string, in the source document',
  },
  {
    storage: 'child',
    cardinalities: ['many-to-one'],
    declaration:
      "field { type: 'reference', refEntity: <parent collection> } on the source screen, PLUS "
      + 'parentEntity / parentFieldKey / parentRelation on that same screen',
    storedAs: 'the parent record id in the child document; the platform turns the child list into a tab of the parent',
  },
  {
    storage: 'association',
    cardinalities: ['many-to-many'],
    declaration: "field { type: 'reference', refEntity: <target collection>, multi: true } on the source screen",
    // O teto vem do kernel. Escrito à mão, ele viraria uma promessa que ninguém revisa no dia em que
    // `MULTI_FK_MATERIALIZE_LIMIT` mudar — e o autor desenharia o modelo contra um número que não é o
    // da instalação dele.
    storedAs: `an array of target ids in the source document (at most ${MULTI_FK_MATERIALIZE_LIMIT} are materialised per read)`,
  },
  {
    storage: 'lookup',
    cardinalities: ['many-to-one'],
    declaration: "field { type: 'select', lookupCollection: <list collection> }, plus the list itself in `lookups`",
    storedAs: "the option KEY, as a string, in the source document",
  },
];

const mechanismFor = (storage: RelationshipStorage): StorageMechanism =>
  STORAGE_MECHANISMS.find((one) => one.storage === storage) as StorageMechanism;

export interface MappedRelationship {
  relationship: DomainRelationship;
  mechanism: StorageMechanism;
  /** A coleção que recebe o campo de vínculo. */
  fieldOn: string;
  fieldKey: string;
  fieldType: 'reference' | 'select';
  multi: boolean;
  /** A coleção apontada (`refEntity`) ou a lista (`lookupCollection`). */
  points: string;
  /** Presente só em `storage: 'child'`. */
  parent?: { parentEntity: string; parentFieldKey: string; parentRelation: ParentRelation };
}

export type MappingResult =
  | { ok: true; mapped: MappedRelationship; issues: DomainIssue[] }
  | { ok: false; issues: DomainIssue[] };

const issue = (
  code: string,
  severity: DomainIssue['severity'],
  relationship: DomainRelationship,
  message: string,
  suggestion: string,
  howToDeclareException: string,
): DomainIssue => ({
  code,
  severity,
  entity: relationship.sourceEntity,
  field: relationship.sourceField,
  message,
  suggestion,
  howToDeclareException,
});

/**
 * Semântica de exclusão. `orphan` e `unlink` mapeiam; `cascade` e `restrict` não, e a saída é dizer
 * isso com o caminho real ao lado — um workflow em `<pai>.deleted` com o passo `remove` é a forma
 * como esta plataforma apaga filho, e ela é declarável hoje.
 */
const deleteIssues = (relationship: DomainRelationship): DomainIssue[] => {
  const onDelete = relationship.onDelete ?? 'orphan';
  if (onDelete === 'orphan') return [];

  if (onDelete === 'unlink') {
    return relationship.required === true
      ? [issue(
        'domain.relationship.unlink-requires-optional',
        'error',
        relationship,
        `"${relationship.sourceField}" is required, so onDelete: "unlink" cannot happen — clearing the link would leave the record invalid.`,
        'Either drop `required: true` on the relationship, or use onDelete: "orphan".',
        'None. Unlinking is emptying the field; a required field cannot be emptied.',
      )]
      : [];
  }

  return [issue(
    onDelete === 'cascade' ? 'domain.relationship.cascade-unsupported' : 'domain.relationship.restrict-unsupported',
    'error',
    relationship,
    `onDelete: "${onDelete}" has no mechanism on this platform. Deleting a record removes its own notes and documents `
    + 'and nothing else — there is no cascade and no referential restriction between business entities.',
    onDelete === 'cascade'
      ? `Declare onDelete: "orphan" and, if the children must really go, add a workflow on "<${relationship.targetEntity} collection>.deleted" `
        + 'with a "query" step over the children and a "remove" step. That is how this platform deletes a dependent record, and it is declarable today.'
      : `Declare onDelete: "orphan". To stop the deletion, put the check where deletions happen: an action with a "hiddenWhen" expression, `
        + 'or a workflow that recreates/alerts. The kernel has no referential restriction to hang this on.',
    'None. This is not a policy — the mechanism does not exist, and a plan that accepted it would promise something nothing executes.',
  )];
};

/**
 * Traduz um relacionamento canônico para o mecanismo real, ou recusa. Recebe as entidades porque
 * `lookup` só é válido contra uma entidade `kind: 'lookup'`, e `child` só contra um `kind: 'child'`
 * — a coerência entre as duas declarações é o que faz o plano ter uma definição só.
 */
export const mapRelationship = (
  raw: DomainRelationship,
  entityByName: ReadonlyMap<string, DomainEntity>,
  collectionOf: (entityName: string) => string | undefined,
): MappingResult => {
  const relationship = canonicalRelationship(raw);
  const mechanism = mechanismFor(relationship.storage);
  const issues: DomainIssue[] = [...deleteIssues(relationship)];

  if (!mechanism.cardinalities.includes(relationship.type)) {
    issues.push(issue(
      'domain.relationship.storage-mismatch',
      'error',
      relationship,
      `storage: "${relationship.storage}" does not express a ${relationship.type} relationship. `
      + `It expresses: ${mechanism.cardinalities.join(', ')}.`,
      relationship.type === 'many-to-many'
        ? 'A many-to-many is either storage: "association" (an array of ids, no attributes of its own) or a junction entity of kind "child".'
        : `Pick the storage whose cardinality matches, or invert the relationship so the side that STORES the link is the source. `
          + `The four storages are: ${STORAGE_MECHANISMS.map((one) => `${one.storage} (${one.cardinalities.join('/')})`).join(', ')}.`,
      'None. Storage is not a preference — each value names one mechanism the platform actually has.',
    ));
    return { ok: false, issues };
  }

  const target = entityByName.get(relationship.targetEntity);
  const points = collectionOf(relationship.targetEntity);
  if (points === undefined) {
    issues.push(issue(
      'domain.relationship.unknown-target',
      'error',
      relationship,
      `"${relationship.targetEntity}" is neither an entity of this model nor a collection that already exists here.`,
      'Add it to the model, or point at the collection of an entity this installation already has — ask the "list_entities" tool for the list.',
      'None. A reference to a name nobody declares resolves to nothing on screen, with no error anywhere.',
    ));
    return { ok: false, issues };
  }

  if (relationship.storage === 'lookup' && target !== undefined && target.kind !== 'lookup') {
    issues.push(issue(
      'domain.relationship.lookup-target-not-a-list',
      'error',
      relationship,
      `storage: "lookup" points at "${relationship.targetEntity}", which is declared kind: "${target.kind}".`,
      'A list of options is vocabulary — key and label, no attributes of its own. If the target has attributes, it is an entity: use storage "reference".',
      'None. The two are stored differently: a list stores the option KEY, a reference stores a record id.',
    ));
    return { ok: false, issues };
  }

  if (relationship.storage === 'reference' && target !== undefined && target.kind === 'lookup') {
    issues.push(issue(
      'domain.relationship.reference-target-is-a-list',
      'error',
      relationship,
      `storage: "reference" points at "${relationship.targetEntity}", which is a list of options, not an entity.`,
      'Use storage: "lookup" — the record stores the option key, and the list is declared in `lookups`.',
      'None. A reference to a list would store a record id in a collection that has no records.',
    ));
    return { ok: false, issues };
  }

  if (relationship.storage === 'child' && target !== undefined && target.kind === 'lookup') {
    issues.push(issue(
      'domain.relationship.storage-mismatch',
      'error',
      relationship,
      `storage: "child" makes "${relationship.sourceEntity}" a child screen of a list of options, which is not a screen.`,
      'A child hangs from an entity. Point it at an entity, or use storage "lookup" if the target really is vocabulary.',
      'None.',
    ));
    return { ok: false, issues };
  }

  const source = entityByName.get(relationship.sourceEntity);
  const fieldOn = collectionOf(relationship.sourceEntity);
  if (fieldOn === undefined) {
    issues.push(issue(
      'domain.relationship.unknown-source',
      'error',
      relationship,
      `"${relationship.sourceEntity}" is neither an entity of this model nor a collection that already exists here.`,
      'The side that stores the link has to be modelled. Declare it, or invert the relationship.',
      'None.',
    ));
    return { ok: false, issues };
  }

  if (relationship.storage === 'child' && source !== undefined && source.kind !== 'child') {
    issues.push(issue(
      'domain.relationship.child-kind-mismatch',
      'error',
      relationship,
      `storage: "child" says "${relationship.sourceEntity}" hangs from "${relationship.targetEntity}", but it is declared kind: "${source.kind}".`,
      'Declare kind: "child" on it, or use storage: "reference" — a top-level entity that merely points at another is a reference, not a child.',
      'A top-level entity that should still appear as a tab of the other one is storage "child" with ownership "association" '
      + '(parentRelation "related"): it keeps its own menu and search, and the link is edited in its own form.',
    ));
    return { ok: false, issues };
  }

  if (relationship.type === 'one-to-one') {
    issues.push(issue(
      'domain.relationship.one-to-one-not-enforced',
      'info',
      relationship,
      'The platform has no uniqueness constraint, so a one-to-one is stored exactly like a many-to-one.',
      'Nothing to change. If uniqueness must hold, enforce it where writes happen — a "validate" expression cannot see other records, '
      + 'so it takes a workflow on save that queries the collection.',
      'None needed — this is information, not a defect.',
    ));
  }

  const mapped: MappedRelationship = {
    relationship,
    mechanism,
    fieldOn,
    fieldKey: relationship.sourceField,
    fieldType: relationship.storage === 'lookup' ? 'select' : 'reference',
    multi: relationship.storage === 'association',
    points,
    ...(relationship.storage === 'child'
      ? {
        parent: {
          parentEntity: points,
          parentFieldKey: relationship.sourceField,
          parentRelation: (relationship.ownership === 'composition' ? 'owned' : 'related') as ParentRelation,
        },
      }
      : {}),
  };

  return { ok: true, mapped, issues };
};

/** "Customer 1:N Sale" — a leitura de negócio de um relacionamento canônico. */
export const relationshipSummary = (raw: DomainRelationship): string => {
  const relationship = canonicalRelationship(raw);
  const cardinality = relationship.type === 'many-to-many'
    ? 'N:N'
    : relationship.type === 'one-to-one' ? '1:1' : '1:N';
  return relationship.type === 'many-to-many'
    ? `${relationship.sourceEntity} ${cardinality} ${relationship.targetEntity}`
    : `${relationship.targetEntity} ${cardinality} ${relationship.sourceEntity}`;
};
