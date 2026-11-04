import { CUSTOM_FIELD_TYPES } from '../../domain/schema/fieldRules';
import { RECORD_KEY_KINDS, RECORD_KEY_SCOPES } from '../../domain/schema/recordKeys';
import {
  AGGREGATION_OPS,
  DELETE_SEMANTICS,
  DERIVED_FROM,
  DOMAIN_MODEL_VERSION,
  EMBEDDED_STRATEGY,
  ENTITY_KINDS,
  OWNERSHIPS,
  RELATIONSHIP_STORAGES,
  RELATIONSHIP_TYPES,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SEMANTIC_TYPES,
} from './domainModel';
import { STORAGE_MECHANISMS } from './storageMapping';
import {
  A_STATE_IS_A_KEY,
  EFFECT_KINDS,
  INVARIANT_ENFORCEMENTS,
  INVARIANT_SCOPES,
  TRIGGER_KINDS,
} from './behaviorModel';
import { BEHAVIOR_MECHANISMS, DOCUMENT_EFFECT_OUTPUTS, SCHEDULE_TRIGGER_SUPPORTED } from './behaviorMapping';

/**
 * O SCHEMA do modelo, servido como recurso MCP (`microteia://domain-model/schema`).
 *
 * Cada `enum` sai da constante que o motor de fato usa — os tipos de campo vêm de
 * `CUSTOM_FIELD_TYPES`, os operadores de agregação de `AGGREGATION_OPS`, os armazenamentos da tabela
 * de mecanismos. É a mesma disciplina do `AUTHORING.md`: o que o kernel sabe fazer é derivado do
 * kernel. Um tipo de campo novo aparece aqui sozinho, e nenhum modelo passa a ser aceito por engano
 * porque alguém esqueceu de atualizar um texto.
 */
export const domainModelJsonSchema = (): Record<string, unknown> => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'microteia://domain-model/schema',
  title: 'Microteia domain model',
  description:
    `${SCREEN_IS_NOT_AN_ENTITY_MODEL} Model the domain BEFORE writing any artifact: entities, what each field MEANS, `
    + 'and how the entities relate. Then ask validate_domain_model, and only then generate_artifact_plan. '
    + 'Business entities are never declared in the kernel: they live in an extension package or in this organization\'s own screens.',
  type: 'object',
  required: ['target', 'entities'],
  additionalProperties: false,
  properties: {
    version: { type: 'integer', const: DOMAIN_MODEL_VERSION },
    intent: { type: 'string', description: 'The request, in the words it arrived in. Kept so a human review can see what was asked.' },
    target: {
      enum: ['extension', 'screenDefinitions'],
      description: 'Where the artifacts will be born. "extension" = a package this workspace builds; "screenDefinitions" = created directly '
        + 'in this organization. There is no third option.',
    },
    extensionId: { type: 'string', description: 'Required when target is "extension".' },
    entities: { type: 'array', minItems: 1, items: { $ref: '#/$defs/entity' } },
    relationships: { type: 'array', items: { $ref: '#/$defs/relationship' }, default: [] },
    behavior: { $ref: '#/$defs/behavior' },
  },
  $defs: {
    entity: {
      type: 'object',
      required: ['name', 'kind', 'fields'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'The business concept. Not the screen title, and not the collection name.' },
        kind: {
          enum: [...ENTITY_KINDS],
          description: 'entity = stands on its own; child = exists inside a parent, or is the junction of a many-to-many that carries attributes; '
            + 'lookup = vocabulary (key, label, colour) with no attributes of its own; '
            + `valueObject = a group with no identity, stored flat with a section (strategy "${EMBEDDED_STRATEGY}").`,
        },
        collection: { type: 'string', description: 'The Firestore collection. Omitted, it is derived from the name.' },
        description: { type: 'string' },
        titleField: { type: 'string', description: 'Key of the field that names a record. Required for kind "entity" and "child".' },
        keys: {
          type: 'array',
          items: { $ref: '#/$defs/key' },
          description: 'What cannot repeat in this entity. Absent = nothing: two identical rows are two valid rows. '
            + 'A key over ONE field can be written as `unique: true` on the field instead.',
        },
        fields: { type: 'array', items: { $ref: '#/$defs/field' } },
      },
    },
    field: {
      type: 'object',
      required: ['key', 'label', 'semanticType'],
      additionalProperties: false,
      properties: {
        key: { type: 'string', description: 'A javascript-safe name. No dots: this platform has no nested object field.' },
        label: { type: 'string' },
        semanticType: {
          enum: [...SEMANTIC_TYPES],
          description: 'What the field MEANS, which decides whether it is a source of truth or a copy. '
            + 'scalar = this entity owns the value; reference = a link to another entity; '
            + 'snapshot = a deliberate copy that must NOT follow the origin (needs source and reason); '
            + 'derived = computed (needs derivedFrom); embedded = a value object, stored flat.',
        },
        type: { enum: [...CUSTOM_FIELD_TYPES], description: 'How the platform draws and stores it.' },
        required: { type: 'boolean' },
        target: { type: 'string', description: 'reference/snapshot, or any field whose type is "reference" (a derived latest copying a reference): the entity it points at — a name in this model or a collection that already exists.' },
        multi: { type: 'boolean', description: 'A reference to several records, stored as an array of ids. No aggregation can walk one.' },
        source: { type: 'string', pattern: '^[^.]+\\.[^.]+$', description: 'snapshot: "<Entity>.<field>". Required.' },
        reason: { type: 'string', description: 'snapshot: why the value must not follow the origin. Required.' },
        derivedFrom: {
          enum: [...DERIVED_FROM],
          description: 'self = an expression over this record (becomes logic.compute, evaluated on save); '
            + 'children = an aggregate over child records (becomes an aggregation the server recomputes). '
            + 'They are two different mechanisms: an expression cannot see children, and would return zero forever.',
        },
        expression: { type: 'string', description: 'derivedFrom "self": the expression.' },
        aggregation: { $ref: '#/$defs/aggregation' },
        embeddedOf: { type: 'string', description: 'embedded: the name of the valueObject entity.' },
        lookup: { type: 'string', description: 'The collection of the option list that serves this select.' },
        unique: {
          type: 'boolean',
          description: 'SHORTHAND: no two records of this entity share this value. It becomes an entity key named '
            + '`field:<key>`, scoped to the organization. For several fields together, or to change the scope, the '
            + 'comparison or whether the value is optional, declare entity.keys instead.',
        },
        filterable: { type: 'boolean' },
        searchable: {
          type: 'boolean',
          description: 'The field\'s value becomes a search term of the record, kept by the server. The title field '
            + 'always is. A reference contributes the title of the record it points to; a select, the option label. '
            + 'Only text, textarea, masked, select and reference.',
        },
        showInList: { type: 'boolean' },
        section: { type: 'string' },
      },
    },
    key: {
      type: 'object',
      required: ['name', 'kind', 'fields'],
      additionalProperties: false,
      description: 'What cannot repeat. It is the ONE rule on this platform that compares records, and it is DECLARED, '
        + 'never written as an expression: a validate sees one record and cannot query the others. The value is '
        + 'reserved in a document whose id derives from the value itself, written in the same batch as the record — '
        + 'creating that document is the lock, so two writes at the same instant do not both pass. It is NOT the '
        + 'document id: the id stays random, because a natural key changes and moving a document would break every '
        + 'reference pointing at it.',
      properties: {
        name: {
          type: 'string',
          description: 'Stable: it is what finds the reservation already written for existing records. Renaming a key '
            + 'retires it and declares another.',
        },
        kind: {
          enum: [...RECORD_KEY_KINDS],
          description: 'unique = forbids the second record with this value. primary = that, plus it becomes an '
            + 'ADDRESS: an idempotent upsert by natural key, a stable link. At most one primary per entity, and it is '
            + 'never optional.',
        },
        fields: {
          type: 'array',
          minItems: 1,
          items: { type: 'string' },
          description: 'Keys of fields of THIS entity, in order. Several fields = the COMBINATION cannot repeat.',
        },
        scope: {
          enum: [...RECORD_KEY_SCOPES],
          description: 'tenant (default) = unique in the whole organization. parent = unique WITHIN one parent record '
            + '— the item numbered 1 of each order — and it needs a relationship with storage "child".',
        },
        normalize: {
          type: 'object',
          additionalProperties: false,
          description: 'How two values count as the same before comparing. Deliberately small: every option here is '
            + 'a way for different values to collide, and each has to be reproducible identically in the browser, in '
            + 'the backend and in a sweep over records that already exist.',
          properties: {
            trim: { type: 'boolean', description: 'Default true. A trailing space is the most common duplicate there is.' },
            caseInsensitive: { type: 'boolean', description: 'An email, yes; a case-sensitive code, no. Default false.' },
            formatPreset: {
              type: 'string',
              description: 'A key of the format catalog — "digits" makes 123.456 and 123456 the same value. This is '
                + 'why CPF and CNPJ are not named here: the extension that brings them brings the format too.',
            },
          },
        },
        sparse: {
          type: 'boolean',
          description: 'Default true: a record with no value reserves nothing, so forty records with an empty field '
            + 'do not collide in the void. false = the value is required.',
        },
        message: { type: 'string', description: 'What the person reads on the conflict.' },
      },
    },
    aggregation: {
      type: 'object',
      required: ['from', 'via', 'op'],
      additionalProperties: false,
      properties: {
        from: { type: 'string', description: 'The child entity or collection.' },
        via: { type: 'string', description: 'The key of the SINGLE reference field on the child that points back here.' },
        op: { enum: [...AGGREGATION_OPS] },
        field: { type: 'string', description: 'The child field measured — or, with "latest", the child field whose value is copied as it is. Ignored by "count".' },
        filter: { type: 'string', description: 'A boolean expression over the child; only what it accepts is counted.' },
        orderBy: {
          type: 'array',
          minItems: 1,
          description: 'Only with "latest", and required by it: which child is the most recent. The first key decides, the next ones break ties; '
            + 'an empty value sorts last in both directions, then createdAt (in the direction of the last key), then the record id. '
            + 'A child field or createdAt / updatedAt. No child passing the filter leaves the parent field empty.',
          items: {
            type: 'object',
            required: ['path', 'dir'],
            additionalProperties: false,
            properties: {
              path: { type: 'string' },
              dir: { enum: ['asc', 'desc'] },
            },
          },
        },
      },
    },
    behavior: {
      type: 'object',
      additionalProperties: false,
      description:
        'What HAPPENS to the entities: the states a record moves through, what moves it, and what must stay true. '
        + `${A_STATE_IS_A_KEY} Omit it entirely when the entities have no lifecycle — a plain register is a plain register. `
        + 'Every trigger, effect and invariant below maps to a mechanism that already exists; the ones that do not exist '
        + 'are refused with the reason, not translated into something that looks similar.',
      properties: {
        states: { type: 'array', items: { $ref: '#/$defs/state' }, default: [] },
        transitions: { type: 'array', items: { $ref: '#/$defs/transition' }, default: [] },
        invariants: { type: 'array', items: { $ref: '#/$defs/invariant' }, default: [] },
      },
    },
    state: {
      type: 'object',
      required: ['entity', 'field', 'options'],
      additionalProperties: false,
      description: 'One state machine, over one field of one entity. The field must be a select served by a list — that is '
        + 'the only place option keys can live in a package.',
      properties: {
        entity: { type: 'string' },
        field: { type: 'string', description: 'The key of the field that holds the state.' },
        lookup: { type: 'string', description: 'The collection of the list that serves the field. Same one the field declares.' },
        options: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['key'],
            additionalProperties: false,
            properties: {
              key: { type: 'string', description: 'The IDENTITY. Every from/to names this, never the label.' },
              label: { type: 'string', description: 'What a person reads. The office renames it; nothing may compare it.' },
            },
          },
        },
        initial: { type: 'string', description: 'The key a record is born with. Without it, every option with no inbound transition is unreachable.' },
        terminal: {
          type: 'array',
          items: { type: 'string' },
          description: 'The keys nothing leaves, ON PURPOSE. "It is the end" and "I forgot the way out" are written the same '
            + 'way, so the end is declared.',
        },
      },
    },
    transition: {
      type: 'object',
      required: ['name', 'entity', 'from', 'to', 'trigger'],
      additionalProperties: false,
      properties: {
        name: { type: 'string', description: 'How an invariant and another transition cite this one.' },
        entity: { type: 'string' },
        from: { type: 'string', description: 'The origin state, by KEY.' },
        to: { type: 'string', description: 'The destination state, by KEY. Equal to "from" means "on save, do this and stay".' },
        trigger: {
          type: 'object',
          required: ['kind'],
          additionalProperties: false,
          description: BEHAVIOR_MECHANISMS
            .filter((one) => one.concern === 'trigger')
            .map((one) => `${one.declares}: ${one.mechanism}`)
            .join(' | '),
          properties: {
            kind: { enum: [...TRIGGER_KINDS] },
            event: { enum: ['saved', 'deleted'], description: 'kind "entity-event": which write publishes it.' },
            action: { type: 'string', description: 'kind "user-action": the key of the record action a person presses.' },
            field: { type: 'string', description: 'kind "date-reached": the DATE field of the entity whose arrival fires it.' },
            offset: {
              type: 'string',
              pattern: '^[+-]?\\d{1,3}d$',
              description: 'kind "date-reached": whole days from the date — "-3d" three days before, "0d" on the day, "+1d" after.',
            },
            at: {
              type: 'string',
              pattern: '^([01]\\d|2[0-3]):[0-5]\\d$',
              description: 'kind "date-reached": the time of day it fires, in the office time zone. Default 08:00.',
            },
            when: {
              type: 'string',
              description: SCHEDULE_TRIGGER_SUPPORTED
                ? 'kind "schedule": when it runs, as a five-field cron ("0 5 * * *" is every day at 05:00), in the '
                  + 'organization\'s time zone.'
                : 'kind "schedule": REFUSED. Nothing here is time-based, and a plan that accepted it would promise '
                  + 'something nobody ever sends.',
            },
          },
        },
        guard: {
          type: 'object',
          required: ['expression'],
          additionalProperties: false,
          description: 'A condition over the ONE record in hand. It never queries: a guard that needs other records is '
            + 'refused, and the query step is the path.',
          properties: { expression: { type: 'string' } },
        },
        effects: { type: 'array', items: { $ref: '#/$defs/effect' }, default: [] },
        actor: {
          type: 'string',
          description: 'The actor the business rule named, in ITS words ("the manager"). It exists so that a missing '
            + 'permission becomes checkable — declaring one without a permission is an error.',
        },
        permission: {
          type: 'string',
          pattern: '^[A-Za-z][A-Za-z0-9_-]*\\.[a-z][a-z0-9-]*$',
          description: 'The permission identifier, never a role. Only answerable on a user-action trigger: with no actor, '
            + 'hasPermission answers false.',
        },
      },
    },
    effect: {
      type: 'object',
      required: ['kind'],
      additionalProperties: false,
      description: BEHAVIOR_MECHANISMS
        .filter((one) => one.concern === 'effect')
        .map((one) => `${one.declares} -> ${one.mechanism}`)
        .join(' | '),
      properties: {
        kind: { enum: [...EFFECT_KINDS] },
        entity: { type: 'string', description: 'The entity touched. Omitted = the entity of the transition.' },
        field: { type: 'string' },
        value: { type: 'string', description: 'The value or expression written. On kind "total" it is an ERROR: a total is not an expression.' },
        aggregation: { $ref: '#/$defs/aggregation' },
        target: { type: 'string', description: 'kind "call-automation": the name of the transition called.' },
        duration: { type: 'string', description: 'kind "wait": how long before the effects after it — 30m, 4h, 2d.' },
        template: {
          type: 'string',
          description: 'kind "generate-document": the key of the document template filled with the record of the transition.',
        },
        output: { enum: [...DOCUMENT_EFFECT_OUTPUTS], description: 'kind "generate-document": the file produced. Default: pdf.' },
      },
    },
    invariant: {
      type: 'object',
      required: ['scope', 'entity'],
      additionalProperties: false,
      description: BEHAVIOR_MECHANISMS
        .filter((one) => one.concern === 'invariant')
        .map((one) => `${one.declares} -> ${one.mechanism}`)
        .join(' | ')
        + '. Scope "collection" is the one that compares records, and it does NOT carry an expression: it points at a '
        + 'key the entity declares, by name.',
      properties: {
        scope: { enum: [...INVARIANT_SCOPES] },
        entity: { type: 'string' },
        field: { type: 'string', description: 'Required for scope "field".' },
        transition: { type: 'string', description: 'Required for scope "transition": the name of the transition.' },
        key: {
          type: 'string',
          description: 'Required for scope "collection": the NAME of the key on the entity that carries this rule. '
            + 'The shorthand `unique: true` on a field produces the key named `field:<key>`. There is no expression '
            + 'here — the key is the mechanism.',
        },
        enforcement: {
          enum: [...INVARIANT_ENFORCEMENTS],
          description: 'Required for scope "transition", and the two are different mechanisms. "blocks" refuses the '
            + 'passage before it happens, and only the write path can carry it: a field rule (the repository throws '
            + 'before the document is written) or a user-action, whose disabledWhen refuses the gesture and whose flow '
            + 'condition sits before the flow\'s own upsert. "reacts" is the workflow condition plus an "exit" step — '
            + 'on a save trigger the document was already committed when the event came into existence, so what it '
            + 'stops is the rest of the flow. The other scopes decide it themselves: "field" blocks, "record" reacts.',
        },
        expression: { type: 'string', description: 'Required for every scope but "collection", which declares a key instead.' },
        message: { type: 'string', description: 'What the person reads when it refuses.' },
      },
    },
    relationship: {
      type: 'object',
      required: ['sourceEntity', 'targetEntity', 'sourceField', 'type', 'storage', 'ownership'],
      additionalProperties: false,
      description: 'Declared from the side that STORES the link: sourceField belongs to sourceEntity. '
        + 'The one exception is type "one-to-many", written from the "one" side because that is how the business sentence arrives '
        + '("a sale has many items"); it is inverted to many-to-one before anything else looks at it, and sourceField is then the key on the target.',
      properties: {
        name: { type: 'string' },
        sourceEntity: { type: 'string' },
        targetEntity: { type: 'string' },
        sourceField: { type: 'string' },
        type: { enum: [...RELATIONSHIP_TYPES] },
        storage: {
          enum: [...RELATIONSHIP_STORAGES],
          description: STORAGE_MECHANISMS
            .map((one) => `${one.storage} (${one.cardinalities.join('/')}): ${one.declaration}`)
            .join(' | '),
        },
        ownership: {
          enum: [...OWNERSHIPS],
          description: 'composition = the record does not exist without the parent (parentRelation "owned": no menu entry, no search of its own, '
            + 'the link is prefilled); association = it merely points at the other one (parentRelation "related": it stays a top-level screen).',
        },
        required: { type: 'boolean' },
        displayFields: { type: 'array', items: { type: 'string' }, description: 'Fields of the target that the source shows.' },
        denormalize: {
          type: 'object',
          required: ['denormKey', 'fields'],
          additionalProperties: false,
          description: 'Denormalization DECLARED — denormKey becomes the reference field\'s refDenormKey, the name by which expressions, '
            + 'templates and reports read the target: `<denormKey>.<field>` is the target\'s CURRENT value. Nothing is copied into the record, '
            + 'which is why it follows the origin — unlike a snapshot. `fields` lists what the source reads through it. To show the target\'s '
            + 'name in the portal without exposing its screen, use the portal declaration\'s `referenceTitles` instead.',
          properties: {
            denormKey: { type: 'string' },
            fields: { type: 'array', items: { type: 'string' }, minItems: 1 },
            reason: { type: 'string' },
          },
        },
        onDelete: {
          enum: [...DELETE_SEMANTICS],
          description: 'What happens to the other side. "orphan" is what this platform does; "unlink" is expressible on an optional link. '
            + '"cascade" and "restrict" have NO mechanism here and are refused — the replacement is a workflow on the deletion event.',
        },
        attributes: {
          type: 'array',
          items: { $ref: '#/$defs/field' },
          description: 'Attributes of the RELATIONSHIP itself (quantity, price, discount). Their presence is what decides whether a many-to-many '
            + 'can be an array of ids or needs a junction entity.',
        },
      },
    },
  },
});
