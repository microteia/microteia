import type { DomainSeverity } from './domainModel';

/**
 * O REGISTRO DOS DETECTORES — a lista que a documentação lê, em vez de uma cópia em prosa.
 *
 * Cada código aparece exatamente uma vez aqui, e `Record<DomainIssueCode, Detector>` é o que garante
 * isso: um detector novo sem entrada não compila, e uma entrada sem detector fica visível na revisão.
 * É a mesma disciplina que o `AUTHORING.md` já aplica às tabelas dele — o que o kernel sabe fazer é
 * DERIVADO do kernel, nunca escrito à mão ao lado dele.
 */

export const DOMAIN_ISSUE_CODES = [
  'domain.model.malformed',
  'domain.model.extension-id-missing',

  'domain.entity.duplicate',
  'domain.entity.collection-invalid',
  'domain.entity.collection-exists',
  'domain.entity.missing-title-field',
  'domain.entity.child-without-parent',
  'domain.entity.lookup-with-attributes',

  'domain.field.duplicate',
  'domain.field.key-invalid',
  'domain.field.snapshot-undeclared',
  'domain.field.snapshot-unknown-source',
  'domain.field.belongs-to-other-entity',
  'domain.field.prefix-group',
  'domain.field.prefix-group-unnamed',
  'domain.field.numbered-collection',
  'domain.field.reference-without-relationship',
  'domain.field.derived-self-without-expression',
  'domain.field.derived-children-without-aggregation',
  'domain.field.embedded-flattened',
  'domain.field.embedded-unknown',
  'domain.field.exception-on-record',

  'domain.relationship.storage-mismatch',
  'domain.relationship.unknown-target',
  'domain.relationship.unknown-source',
  'domain.relationship.lookup-target-not-a-list',
  'domain.relationship.reference-target-is-a-list',
  'domain.relationship.child-kind-mismatch',
  'domain.relationship.one-to-one-not-enforced',
  'domain.relationship.cascade-unsupported',
  'domain.relationship.restrict-unsupported',
  'domain.relationship.unlink-requires-optional',
  'domain.relationship.association-with-attributes',
  'domain.relationship.field-not-declared',

  'domain.aggregation.multi-via',
  'domain.aggregation.unknown-child',
  'domain.aggregation.via-not-a-reference',
  'domain.aggregation.cycle',
  'domain.aggregation.latest-incomplete',
  'domain.aggregation.order-invalid',
  'domain.aggregation.unknown-child-field',
  'domain.aggregation.type-mismatch',

  'behavior.model.malformed',

  'behavior.state.field-not-declared',
  'behavior.state.field-not-a-list',
  'behavior.state.duplicate',
  'behavior.state.unreachable',
  'behavior.state.dead-end',
  'behavior.state.reachability-not-verifiable',

  'behavior.transition.unknown-entity',
  'behavior.transition.unknown-state',
  'behavior.transition.compares-label',
  'behavior.transition.schedule-invalid',
  'behavior.transition.date-reached-invalid',
  'behavior.transition.actor-without-permission',
  'behavior.transition.permission-on-event-trigger',
  'behavior.transition.permission-invalid',
  'behavior.transition.permission-undeclared',
  'behavior.transition.without-description',

  'behavior.guard.needs-other-records',

  'behavior.effect.self-trigger-loop',
  'behavior.effect.total-not-an-aggregation',
  'behavior.effect.wait-unsupported',
  'behavior.effect.wait-invalid',
  'behavior.effect.document-unsupported',
  'behavior.effect.document-invalid',

  'behavior.invariant.cross-record',
  'behavior.invariant.uniqueness-undeclared',
  'behavior.invariant.field-scope-without-field',
  'behavior.invariant.transition-unknown',
  'behavior.invariant.transition-without-enforcement',
  'behavior.invariant.blocks-after-the-fact',

  'model.key.unknown-field',
  'model.key.duplicate-name',
  'model.key.duplicate-fields',
  'model.key.multiple-primary',
  'model.key.derived-field',
  'model.key.scope-without-parent',
  'model.key.optional-primary',

  'domain.plan.field-type-immutable',
  'domain.plan.migration-required',
  'domain.plan.removal-soft-block',
  'domain.plan.version-bump-required',
  'domain.plan.blocked-by-model',
  'domain.plan.collection-owned-elsewhere',
  'domain.plan.deactivate-proposed',
  'domain.plan.list-columns-over-budget',
  'domain.plan.screen-source-id-missing',
  'domain.plan.screen-source-id-divergent',
  'domain.plan.screen-source-id-duplicate',
  'domain.plan.ledger-out-of-step',

  'rule.statement-missing',
  'rule.concept-without-entity',
  'rule.actor-without-transition',
  'rule.invariant-not-modelled',
  'rule.process-not-modelled',
  'rule.acceptance-missing',
] as const;

export type DomainIssueCode = (typeof DOMAIN_ISSUE_CODES)[number];

export interface Detector {
  severity: DomainSeverity;
  /** O que ele pega, em uma frase, para quem lê a lista antes de escrever o modelo. */
  summary: string;
}

/**
 * Fechado por tipo de propósito: acrescentar um código à lista acima sem descrevê-lo aqui não
 * compila. A severidade declarada é a que o detector usa — quando ela varia com o caso, a entrada
 * registra a mais grave.
 */
export const DETECTORS: Record<DomainIssueCode, Detector> = {
  'domain.model.malformed': { severity: 'error', summary: 'The model is not shaped like a domain model.' },
  'domain.model.extension-id-missing': { severity: 'error', summary: 'target "extension" without an extensionId to install into.' },

  'domain.entity.duplicate': { severity: 'error', summary: 'Two entities share a name or a collection.' },
  'domain.entity.collection-invalid': { severity: 'error', summary: 'The collection name is invalid, reserved, or already taken by a list.' },
  'domain.entity.collection-exists': { severity: 'info', summary: 'The collection already exists here; the plan reconciles instead of creating.' },
  'domain.entity.missing-title-field': { severity: 'error', summary: 'An entity or child without a title field: every record would read "no title".' },
  'domain.entity.child-without-parent': { severity: 'error', summary: 'kind "child" with no relationship that hangs it from a parent.' },
  'domain.entity.lookup-with-attributes': { severity: 'warning', summary: 'A list of options carrying attributes of its own — that is an entity.' },

  'domain.field.duplicate': { severity: 'error', summary: 'Two fields of the same entity share a key.' },
  'domain.field.key-invalid': { severity: 'error', summary: 'A key the platform cannot store or navigate.' },
  'domain.field.snapshot-undeclared': { severity: 'error', summary: 'semanticType "snapshot" without both source and reason.' },
  'domain.field.snapshot-unknown-source': { severity: 'error', summary: 'A snapshot whose source names an entity or field nobody declares.' },
  'domain.field.belongs-to-other-entity': { severity: 'warning', summary: 'One scalar field that looks like an attribute of another entity. One field is a smell, not a proof.' },
  'domain.field.prefix-group': { severity: 'error', summary: 'Two or more IDENTITY attributes of another entity, held as this one\'s own data.' },
  'domain.field.prefix-group-unnamed': { severity: 'warning', summary: 'Several fields with a common prefix: a concept with no name yet.' },
  'domain.field.numbered-collection': { severity: 'error', summary: 'A collection modelled as numbered fields (item1, item2, ...).' },
  'domain.field.reference-without-relationship': { severity: 'error', summary: 'A reference with no relationship, or a foreign key held as a plain scalar.' },
  'domain.field.derived-self-without-expression': { severity: 'error', summary: 'derivedFrom "self" without the expression that computes it.' },
  'domain.field.derived-children-without-aggregation': { severity: 'error', summary: 'derivedFrom "children" without the aggregation that recomputes it.' },
  'domain.field.embedded-flattened': { severity: 'info', summary: 'How an embedded value object was translated for a platform with no nested objects.' },
  'domain.field.embedded-unknown': { severity: 'error', summary: 'embedded pointing at a value object nobody declared.' },
  'domain.field.exception-on-record': { severity: 'info', summary: 'A copy declared in an earlier session, still standing — not raised again.' },

  'domain.relationship.storage-mismatch': { severity: 'error', summary: 'The storage does not express that cardinality.' },
  'domain.relationship.unknown-target': { severity: 'error', summary: 'The target is neither modelled nor an existing collection.' },
  'domain.relationship.unknown-source': { severity: 'error', summary: 'The side that stores the link is not modelled.' },
  'domain.relationship.lookup-target-not-a-list': { severity: 'error', summary: 'storage "lookup" pointing at something that is not a list of options.' },
  'domain.relationship.reference-target-is-a-list': { severity: 'error', summary: 'storage "reference" pointing at a list of options.' },
  'domain.relationship.child-kind-mismatch': { severity: 'error', summary: 'storage "child" where the source is not declared kind "child".' },
  'domain.relationship.one-to-one-not-enforced': { severity: 'info', summary: 'The platform stores a one-to-one exactly like a many-to-one.' },
  'domain.relationship.cascade-unsupported': { severity: 'error', summary: 'onDelete "cascade" — no mechanism exists; the plan will not promise it.' },
  'domain.relationship.restrict-unsupported': { severity: 'error', summary: 'onDelete "restrict" — no referential restriction exists.' },
  'domain.relationship.unlink-requires-optional': { severity: 'error', summary: 'onDelete "unlink" on a required link: it cannot be emptied.' },
  'domain.relationship.association-with-attributes': { severity: 'error', summary: 'A many-to-many with attributes of its own stored as an array of ids.' },
  'domain.relationship.field-not-declared': { severity: 'error', summary: 'The relationship names a field the source entity does not declare.' },

  'domain.aggregation.multi-via': { severity: 'error', summary: 'An aggregation over a multi reference: the engine cannot walk it, so the total never updates.' },
  'domain.aggregation.unknown-child': { severity: 'error', summary: 'An aggregation over children nobody declares.' },
  'domain.aggregation.via-not-a-reference': { severity: 'error', summary: 'The "via" key is not a reference field on the child.' },
  'domain.aggregation.cycle': { severity: 'error', summary: 'Two entities aggregating from each other: the value never settles.' },
  'domain.aggregation.latest-incomplete': { severity: 'error', summary: 'op "latest" without the field it copies or without the orderBy that says which child is the most recent.' },
  'domain.aggregation.order-invalid': { severity: 'error', summary: 'An orderBy on an op other than "latest", in a direction other than asc/desc, or over a key the child does not have.' },
  'domain.aggregation.unknown-child-field': { severity: 'error', summary: 'The aggregated field is not a field of the child entity.' },
  'domain.aggregation.type-mismatch': { severity: 'error', summary: 'op "latest" copies a child value into a parent field that does not store the same shape.' },

  'behavior.model.malformed': { severity: 'error', summary: 'The behavior block is not shaped like one.' },

  'behavior.state.field-not-declared': { severity: 'error', summary: 'The state field is not a field of the entity that owns the state.' },
  'behavior.state.field-not-a-list': { severity: 'error', summary: 'A state field that is not a select served by a list: its options have nowhere to live.' },
  'behavior.state.duplicate': { severity: 'error', summary: 'Two state machines for the same entity, or two options with the same key.' },
  'behavior.state.unreachable': { severity: 'error', summary: 'A state no transition enters, and that is not the initial one.' },
  'behavior.state.dead-end': { severity: 'error', summary: 'A state no transition leaves, not declared terminal.' },
  'behavior.state.reachability-not-verifiable': { severity: 'info', summary: 'A computed effect writes the state field, so neither reachability check can fire on that entity.' },

  'behavior.transition.unknown-entity': { severity: 'error', summary: 'A transition over an entity nobody models and no collection carries.' },
  'behavior.transition.unknown-state': { severity: 'error', summary: 'A transition from or to a key that is not an option of the state.' },
  'behavior.transition.compares-label': { severity: 'error', summary: 'A transition naming an option by its LABEL: the identity is the key.' },
  'behavior.transition.date-reached-invalid': { severity: 'error', summary: 'trigger "date-reached" on a field that is not a date, or with an offset or time the clock cannot read.' },
  'behavior.transition.schedule-invalid': { severity: 'error', summary: 'trigger "schedule" whose `when` is not a cron expression the kernel clock can run.' },
  'behavior.transition.actor-without-permission': { severity: 'error', summary: 'The rule names an actor and the transition asks nothing of them.' },
  'behavior.transition.permission-on-event-trigger': { severity: 'error', summary: 'A permission on a trigger with no actor: hasPermission answers false, always.' },
  'behavior.transition.permission-invalid': { severity: 'error', summary: 'A permission that is not "resource.action", or that names a role instead.' },
  'behavior.transition.permission-undeclared': { severity: 'info', summary: 'The permission is neither derived from a collection nor a kernel one: the package must declare it.' },
  'behavior.transition.without-description': { severity: 'warning', summary: 'A callable flow with no description: invisible to the only surface that picks a flow on its own.' },

  'behavior.guard.needs-other-records': { severity: 'error', summary: 'A guard that has to read other records; a condition reads only the one in hand.' },

  'behavior.effect.self-trigger-loop': { severity: 'error', summary: 'An effect writing the field that fires its own trigger, with nothing to end the cascade.' },
  'behavior.effect.wait-unsupported': { severity: 'error', summary: 'A wait on a transition a person triggers, or a clock: the engine cannot pause there.' },
  'behavior.effect.wait-invalid': { severity: 'error', summary: 'A wait whose duration is not 30m / 4h / 2d, or longer than the engine allows.' },
  'behavior.effect.document-unsupported': { severity: 'error', summary: 'A document generated on a delete, or for another entity than the one of the transition.' },
  'behavior.effect.document-invalid': { severity: 'error', summary: 'A document effect without a template key, or with an output other than pdf / docx.' },
  'behavior.effect.total-not-an-aggregation': { severity: 'error', summary: 'A total written by a step or an expression instead of declared as an aggregation.' },

  'behavior.invariant.cross-record': { severity: 'error', summary: 'An invariant that has to compare records by expression; only a declared key compares records here.' },
  'behavior.invariant.uniqueness-undeclared': { severity: 'error', summary: 'scope "collection" naming no key: uniqueness is a declared key, not an expression.' },
  'behavior.invariant.field-scope-without-field': { severity: 'error', summary: 'scope "field" without the field it belongs to.' },
  'behavior.invariant.transition-unknown': { severity: 'error', summary: 'scope "transition" naming a transition nobody declares.' },
  'behavior.invariant.transition-without-enforcement': { severity: 'error', summary: 'scope "transition" without enforcement: refusing the passage and reacting to it are different mechanisms.' },
  'behavior.invariant.blocks-after-the-fact': { severity: 'error', summary: 'enforcement "blocks" where the write is already committed: nothing can refuse it.' },

  'model.key.unknown-field': { severity: 'error', summary: 'A key names a field the entity does not have.' },
  'model.key.duplicate-name': { severity: 'error', summary: 'Two keys of the same entity share a name; the name is what addresses the reservation.' },
  'model.key.duplicate-fields': { severity: 'warning', summary: 'Two keys cover exactly the same fields in the same scope; one of them says nothing.' },
  'model.key.multiple-primary': { severity: 'error', summary: 'More than one primary key on the same entity.' },
  'model.key.derived-field': { severity: 'error', summary: 'A key over a derived field, whose value is never stored on the record.' },
  'model.key.scope-without-parent': { severity: 'error', summary: 'scope "parent" on an entity that is nobody\'s child.' },
  'model.key.optional-primary': { severity: 'warning', summary: 'A primary key over an optional field: an address that may be missing addresses nothing.' },

  'domain.plan.field-type-immutable': { severity: 'error', summary: 'A field key already exists with another type, and type is immutable.' },
  'domain.plan.migration-required': { severity: 'error', summary: 'The change alters data already written, so it needs a declared migration.' },
  'domain.plan.removal-soft-block': { severity: 'warning', summary: 'Something exists that the model no longer describes; the plan never removes it.' },
  'domain.plan.version-bump-required': { severity: 'info', summary: 'The plan changes an extension, so its version and VERSIONS.md move with it.' },
  'domain.plan.blocked-by-model': { severity: 'error', summary: 'The model did not pass validation, so there is no plan.' },
  'domain.plan.collection-owned-elsewhere': { severity: 'warning', summary: 'The collection is owned by another extension; the plan can only add fields.' },
  'domain.plan.deactivate-proposed': { severity: 'warning', summary: 'The rule no longer needs something it created; the plan proposes disabling it, never deleting.' },
  'domain.plan.list-columns-over-budget': { severity: 'info', summary: 'More fields qualify for the list than a row can hold; which ones stay is a human choice.' },
  'domain.plan.screen-source-id-missing': { severity: 'error', summary: 'A planned screen with no universal identity: the next version installs a second screen instead of updating it.' },
  'domain.plan.screen-source-id-divergent': { severity: 'error', summary: 'The package declares one sourceId and the ledger records another; the recorded one is the right one.' },
  'domain.plan.screen-source-id-duplicate': { severity: 'error', summary: 'Two screens of the same plan share a sourceId, so the installation reads them as one.' },
  'domain.plan.ledger-out-of-step': { severity: 'warning', summary: 'The ledger disagrees with what exists, and it is now the source of the screen identity.' },

  'rule.statement-missing': { severity: 'error', summary: 'A business rule with no statement: there is nothing to trace back to.' },
  'rule.concept-without-entity': { severity: 'warning', summary: 'The rule names a concept that no entity and no collection carries.' },
  'rule.actor-without-transition': { severity: 'warning', summary: 'The rule names an actor that no transition asks anything of.' },
  'rule.invariant-not-modelled': { severity: 'warning', summary: 'The rule states more invariants than the behavior declares.' },
  'rule.process-not-modelled': { severity: 'warning', summary: 'The rule states more processes than the behavior declares transitions.' },
  'rule.acceptance-missing': { severity: 'warning', summary: 'A rule with no acceptance criteria: nothing says whether it was met.' },
};

/** Fonte do recurso `microteia://domain-model/rules`, para que a lista publicada nunca envelheça. */
export const detectorList = (): { code: DomainIssueCode; severity: DomainSeverity; summary: string }[] =>
  DOMAIN_ISSUE_CODES.map((code) => ({ code, severity: DETECTORS[code].severity, summary: DETECTORS[code].summary }));
