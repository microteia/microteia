import type { AggregationOp, CustomFieldType } from '../../domain/schema/fieldRules';
import { CUSTOM_FIELD_TYPES } from '../../domain/schema/fieldRules';
import type {
  RecordKeyKind,
  RecordKeyNormalization,
  RecordKeyScope,
} from '../../domain/schema/recordKeys';
import { RECORD_KEY_KINDS, RECORD_KEY_SCOPES } from '../../domain/schema/recordKeys';
import type { BehaviorModel } from './behaviorModel';
import { parseBehaviorModel } from './behaviorModel';

/**
 * O MODELO DE DOMÍNIO — a etapa que faltava ANTES de qualquer geração de artefato.
 *
 * A regra que este módulo existe para impor tem nome: **"A screen is not an entity model."** Uma
 * solicitação de negócio chega descrevendo o que se VÊ ("uma venda com cliente, vendedor e produtos"),
 * e a leitura ingênua produz uma entidade só, com o nome do cliente dentro da venda. O dado nasce
 * acoplado, o nome do cliente congela no dia da venda sem ninguém pedir, e não há como totalizar nada
 * — e nada nesta plataforma reprova isso, porque um pacote assim instala perfeitamente.
 *
 * O que muda aqui é a ORDEM: intenção → entidades → relacionamentos → normalização → plano. O modelo
 * é uma DECLARAÇÃO, validada por um motor determinístico; a IA propõe e o motor responde, exatamente
 * como `validate_plugin` já faz com o pacote. Este módulo não gera nada, e não vai gerar: ele é irmão
 * de `validate.ts`, não de `compile.ts`.
 *
 * Ele também NÃO cria um segundo catálogo de entidades. O que existe na instalação é lido de
 * `catalog.ts`, que resolve pelo `SchemaContext` do próprio kernel — as entidades continuam nascendo
 * em `screenDefinitions` ou num pacote de extensão, nunca aqui.
 */

/** O nome da regra, escrito uma vez e citado por quem a aplica. */
export const SCREEN_IS_NOT_AN_ENTITY_MODEL =
  'A screen is not an entity model: a screen shows fields, an entity owns them.';

// ─── Vocabulário ──────────────────────────────────────────────────────────────

/**
 * O que a entidade É, e não como ela aparece:
 *
 * - `entity`   — de topo, com identidade própria e vida independente.
 * - `child`    — só existe dentro de um pai (o item de uma venda), ou é a JUNÇÃO de um N:N com
 *                atributos próprios.
 * - `lookup`   — vocabulário: uma lista de opções do escritório, não uma entidade com atributos.
 * - `valueObject` — um agrupamento sem identidade (um endereço). A plataforma não tem objeto
 *                aninhado em tela, e a tradução escolhida está em `EMBEDDED_STRATEGY`.
 */
export const ENTITY_KINDS = ['entity', 'child', 'lookup', 'valueObject'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

/**
 * O que o campo SIGNIFICA — a distinção que decide se ele é fonte de verdade ou cópia.
 *
 * `derived` é separado de `snapshot` porque o primeiro se recalcula e o segundo, de propósito, não.
 * E `derived` carrega `derivedFrom` porque na Microteia são DOIS mecanismos que não se substituem:
 * `logic.compute` é expressão sobre o próprio registro, `aggregation` é um agregado sobre os FILHOS,
 * recalculado por um gatilho no servidor. Confundi-los deixa o total desatualizado em silêncio — o
 * `compute` não enxerga filho nenhum, e a expressão simplesmente devolve zero para sempre.
 */
export const SEMANTIC_TYPES = ['scalar', 'reference', 'snapshot', 'derived', 'embedded'] as const;
export type SemanticType = (typeof SEMANTIC_TYPES)[number];

export const DERIVED_FROM = ['self', 'children'] as const;
export type DerivedFrom = (typeof DERIVED_FROM)[number];

export const RELATIONSHIP_TYPES = ['one-to-one', 'one-to-many', 'many-to-one', 'many-to-many'] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

/** Como o relacionamento é GRAVADO. Cada valor mapeia para um mecanismo real — ver `storageMapping.ts`. */
export const RELATIONSHIP_STORAGES = ['reference', 'child', 'association', 'lookup'] as const;
export type RelationshipStorage = (typeof RELATIONSHIP_STORAGES)[number];

/**
 * Posse ou vizinhança. Traduz-se em `ScreenDefinition.parentRelation` — `composition` vira `owned`
 * (o registro não existe sem o pai) e `association` vira `related` (a tela continua de topo).
 */
export const OWNERSHIPS = ['composition', 'association'] as const;
export type Ownership = (typeof OWNERSHIPS)[number];

/**
 * O que acontece com o outro lado quando um registro é excluído.
 *
 * `orphan` é o que a plataforma FAZ hoje, e está escrito: "não há cascata entre entidades de
 * negócio" (ARCHITECTURE.md, "Cascata de Exclusão"). `unlink` é expressável — é limpar o campo de
 * vínculo, o gesto de uma relação `related`. `cascade` e `restrict` NÃO são: declará-los é um erro
 * alto, com o caminho real ao lado (um workflow em `<pai>.deleted`), em vez de um plano que promete
 * o que ninguém executa.
 */
export const DELETE_SEMANTICS = ['orphan', 'unlink', 'cascade', 'restrict'] as const;
export type DeleteSemantics = (typeof DELETE_SEMANTICS)[number];

/**
 * A tradução de `embedded`, escolhida uma vez e aplicada em todo lugar.
 *
 * A plataforma não tem campo de objeto: `CUSTOM_FIELD_TYPES` tem doze tipos e nenhum deles é objeto,
 * `VALID_FIELD_KEY_PATTERN` recusa ponto na chave, e o escopo das expressões é plano por chave de
 * topo (`collectFieldLogicTargets`). A alternativa — uma entidade `child` 1:1 — custaria uma coleção
 * inteira, quatro permissões, uma aba e uma segunda leitura, e ainda tiraria os campos do alcance de
 * `compute`/`validate`/`filterable` do próprio registro, que é justamente para o que eles servem.
 *
 * Então: ACHATAMENTO NOMEADO. As folhas viram campos de topo com o prefixo do objeto, e o `section`
 * devolve o agrupamento visual que o objeto existia para dar.
 */
export const EMBEDDED_STRATEGY = 'flatten-with-section' as const;

const AGGREGATION_OP_SET: Record<AggregationOp, true> = {
  sum: true, count: true, avg: true, min: true, max: true,
};

/** Derivado, para que um operador novo no kernel entre aqui sem ninguém lembrar de uma lista. */
export const AGGREGATION_OPS: AggregationOp[] = Object.keys(AGGREGATION_OP_SET) as AggregationOp[];

// ─── O modelo ─────────────────────────────────────────────────────────────────

export interface DomainAggregation {
  /** Entidade dos FILHOS — nome do modelo ou coleção que já existe. */
  from: string;
  /** Chave do campo de referência NO FILHO que aponta para este registro. */
  via: string;
  op: AggregationOp;
  /** Campo do filho medido; ignorado por `count`. */
  field?: string;
  filter?: string;
}

export interface DomainField {
  key: string;
  label: string;
  semanticType: SemanticType;
  /** Como a plataforma o desenha e o grava. Ausente em `reference` e `derived` sobre filhos. */
  type?: CustomFieldType;
  required?: boolean;
  /** `reference` e `snapshot`: a entidade apontada (nome do modelo ou coleção existente). */
  target?: string;
  /** `reference`: aponta para vários. Ver o limite verificável em `detectors.ts`. */
  multi?: boolean;
  /** `snapshot`: de onde o valor foi copiado, na forma `Entidade.campo`. Obrigatório. */
  source?: string;
  /** `snapshot`: por que a cópia é intencional. Obrigatório — é o que a distingue de acoplamento. */
  reason?: string;
  derivedFrom?: DerivedFrom;
  /** `derived` + `self`: a expressão de `logic.compute`. */
  expression?: string;
  /** `derived` + `children`: o agregado. */
  aggregation?: DomainAggregation;
  /** `embedded`: o `valueObject` que este campo representa. */
  embeddedOf?: string;
  /** Campo `select` servido por uma lista do escritório. */
  lookup?: string;
  /**
   * ATALHO: não há dois registros com este valor. Vira uma `DomainKey` de um campo, no escopo da
   * organização. Para a combinação de vários campos, ou para mudar escopo, comparação ou
   * obrigatoriedade, declare a chave em `entity.keys`.
   */
  unique?: boolean;
  /** Vira filtro e coluna da listagem. */
  filterable?: boolean;
  showInList?: boolean;
  section?: string;
}

/**
 * As abas que a plataforma acrescenta a uma tela — anotações, documentos e etiquetas.
 *
 * São `hasNotes`, `hasDocuments` e `hasTags` do `ScreenModuleTemplate`, e o padrão é NÃO ter nenhuma:
 * três abas ligadas por reflexo são três lugares onde o escritório escreve dado que a regra não pediu
 * e que ninguém depois sabe se deveria estar ali. Ligar uma é uma decisão de negócio, e por isso ela
 * carrega o `because` — a mesma exigência que o `reason` de um snapshot já faz, e pelo mesmo motivo:
 * sem ele, "ligado de propósito" e "ligado por hábito" se escrevem igual.
 */
export const ENTITY_TAB_KINDS = ['notes', 'documents', 'tags'] as const;
export type EntityTabKind = (typeof ENTITY_TAB_KINDS)[number];

export interface EntityTab {
  kind: EntityTabKind;
  /** Por que a regra a pede. Obrigatório: é o que a distingue de um padrão ligado sem pensar. */
  because: string;
}

/**
 * O que não pode se repetir na entidade — a chave natural do negócio.
 *
 * É declaração de ENTIDADE e não de campo, mesmo quando cobre um campo só, por três razões que só
 * aparecem juntas: chave composta é a regra (o item nº 1 de CADA pedido); o escopo é propriedade da
 * chave, não de nenhum dos campos; e uma lista num lugar só é o que a regra de segurança, a tela e a
 * adoção sobre o dado que já existe conseguem ler sem remontar a verdade. `DomainField.unique` é o
 * atalho para o caso de um campo, e vira uma destas.
 *
 * A chave NÃO é o id do documento. O id continua sorteado — uma chave natural muda (o CPF foi
 * digitado errado), e mover o documento obrigaria a reescrever toda referência que aponta para ele.
 */
export interface DomainKey {
  /** Estável: é por ele que a reserva já gravada é encontrada. Renomear é declarar outra chave. */
  name: string;
  /**
   * `primary` identifica o registro — vira endereço para um upsert idempotente por chave natural, e
   * é obrigatória (nunca esparsa). No máximo uma por entidade. `unique` apenas proíbe o segundo.
   */
  kind: RecordKeyKind;
  /** Chaves de campo da PRÓPRIA entidade, na ordem. */
  fields: string[];
  /** `tenant` (padrão) = única na organização. `parent` = única dentro do registro-pai. */
  scope?: RecordKeyScope;
  /** Como dois valores contam como o mesmo antes de comparar. */
  normalize?: RecordKeyNormalization;
  /** `false` = o valor é obrigatório. Padrão `true`: sem valor, nada é reservado. */
  sparse?: boolean;
  /** O que a pessoa lê no conflito. */
  message?: string;
}

export interface DomainEntity {
  /** O nome de DOMÍNIO. Nunca vira coleção sozinho — ver `collection`. */
  name: string;
  kind: EntityKind;
  /**
   * A coleção no Firestore. Ausente = derivada do nome. Quando ela já existe na instalação, o plano
   * RECONCILIA em vez de criar.
   */
  collection?: string;
  description?: string;
  /** Chave do campo que dá nome ao registro. Obrigatória em `entity` e `child`. */
  titleField?: string;
  /** As abas opcionais da tela, cada uma com o motivo. Ausente = nenhuma, que é o padrão. */
  tabs?: EntityTab[];
  /** O que não pode se repetir. Ausente = nada — duas linhas iguais são duas linhas válidas. */
  keys?: DomainKey[];
  fields: DomainField[];
}

export interface DomainDenormalization {
  /** O nome pelo qual o registro apontado é navegado — o `refDenormKey` da plataforma. */
  denormKey: string;
  fields: string[];
  reason?: string;
}

export interface DomainRelationship {
  name?: string;
  sourceEntity: string;
  targetEntity: string;
  /** O campo que GUARDA o vínculo. Mora em `sourceEntity`, sempre. */
  sourceField: string;
  type: RelationshipType;
  storage: RelationshipStorage;
  ownership: Ownership;
  required?: boolean;
  /** Campos do alvo que a origem mostra — vira `displayFields` do seletor e do cartão. */
  displayFields?: string[];
  /** Denormalização DECLARADA. Sem isto, copiar campo do alvo é acoplamento, não decisão. */
  denormalize?: DomainDenormalization;
  onDelete?: DeleteSemantics;
  /**
   * Atributos do PRÓPRIO relacionamento (quantidade, preço, desconto). A presença deles é o que
   * decide se um N:N pode ser um array de ids ou precisa de uma entidade de junção.
   */
  attributes?: DomainField[];
}

/**
 * O arquivo em que o modelo mora, ao lado do `plugin.ts` que ele descreve.
 *
 * Ele fica AQUI, e não em `workspaceCatalog.ts`, pela mesma razão que `RULE_LEDGER_FILE` fica em
 * `traceability.ts`: quem semeia o `.gitignore` de `extensions/` precisa do nome sem arrastar o
 * compilador junto — e um nome de arquivo escrito duas vezes é um nome que diverge na terceira.
 */
export const DOMAIN_MODEL_FILE = 'domain-model.json';

export const DOMAIN_MODEL_VERSION = 1;

export interface DomainModel {
  version: number;
  /** A frase que originou o modelo. Guardada para que a revisão humana saiba o que se pediu. */
  intent?: string;
  /** Onde os artefatos vão nascer. NUNCA `entityRegistry.ts`. */
  target: 'extension' | 'screenDefinitions';
  /** Obrigatório quando `target` é `extension`. */
  extensionId?: string;
  entities: DomainEntity[];
  relationships: DomainRelationship[];
  /**
   * O que ACONTECE com as entidades acima — estados, transições, gatilhos e invariantes.
   *
   * Mora DENTRO do modelo, e não num modelo ao lado, porque as duas metades não se validam separado:
   * um estado é uma opção de um campo, um efeito grava numa coleção, um total é um campo derivado.
   * Separá-las faria cada gate responder sobre a metade que ele não tem. Ausente é legítimo — um
   * cadastro sem estado é um cadastro.
   */
  behavior?: BehaviorModel;
}

// ─── Problemas ────────────────────────────────────────────────────────────────

export const DOMAIN_SEVERITIES = ['error', 'warning', 'info'] as const;
export type DomainSeverity = (typeof DOMAIN_SEVERITIES)[number];

/**
 * A forma FIXA de um problema. `howToDeclareException` não é enfeite: uma regra sem porta de saída
 * ensina a ignorá-la, e metade destas regras tem exceção legítima — `SaleItem.unitPrice` é uma.
 * Quando não há exceção, o campo diz isso com todas as letras, que também é uma resposta.
 */
export interface DomainIssue {
  code: string;
  severity: DomainSeverity;
  entity?: string;
  field?: string;
  message: string;
  suggestion: string;
  howToDeclareException: string;
}

export const hasBlockingIssue = (issues: readonly DomainIssue[]): boolean =>
  issues.some((issue) => issue.severity === 'error');

/** Erros primeiro: quem lê uma lista longa lê o começo dela. */
const SEVERITY_ORDER: Record<DomainSeverity, number> = { error: 0, warning: 1, info: 2 };

export const sortIssues = (issues: readonly DomainIssue[]): DomainIssue[] =>
  [...issues].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    return `${a.entity ?? ''}.${a.field ?? ''}.${a.code}`.localeCompare(`${b.entity ?? ''}.${b.field ?? ''}.${b.code}`);
  });

// ─── Leitura tolerante ────────────────────────────────────────────────────────

/**
 * O modelo chega de um LLM, então ele chega torto. Aqui a leitura é estrutural e devolve problema em
 * vez de exceção: um `severity` inventado ou um `fields` que veio como objeto têm de virar uma frase
 * que o modelo consiga corrigir, não um stack trace no stdio do MCP.
 */
export interface ParseSuccess { ok: true; model: DomainModel; issues: DomainIssue[] }
export interface ParseFailure { ok: false; issues: DomainIssue[] }
export type ParseResult = ParseSuccess | ParseFailure;

/**
 * Um problema de FORMA, com o código de quem o leu. O comportamento usa o mesmo molde e outro código
 * (`behavior.model.malformed`): a frase que o modelo tem de corrigir é da mesma natureza, e duplicar
 * o construtor faria as duas divergirem na primeira vez que uma delas fosse ajustada.
 */
export const malformedIssue = (
  code: string,
  message: string,
  suggestion: string,
  entity?: string,
  field?: string,
): DomainIssue => ({
  code,
  severity: 'error',
  ...(entity === undefined ? {} : { entity }),
  ...(field === undefined ? {} : { field }),
  message,
  suggestion,
  howToDeclareException: 'None. The shape of the model is not negotiable; read microteia://domain-model/schema.',
});

const structural = (message: string, suggestion: string, entity?: string, field?: string): DomainIssue =>
  malformedIssue('domain.model.malformed', message, suggestion, entity, field);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const bool = (value: unknown): boolean | undefined => (typeof value === 'boolean' ? value : undefined);

const strList = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : undefined;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const readAggregation = (raw: unknown): DomainAggregation | undefined => {
  if (!isRecord(raw)) return undefined;
  const from = str(raw.from);
  const via = str(raw.via);
  const op = oneOf(raw.op, AGGREGATION_OPS);
  if (from === undefined || via === undefined || op === undefined) return undefined;
  return {
    from,
    via,
    op,
    ...(str(raw.field) === undefined ? {} : { field: str(raw.field) as string }),
    ...(str(raw.filter) === undefined ? {} : { filter: str(raw.filter) as string }),
  };
};

const readField = (raw: unknown, entityName: string, issues: DomainIssue[]): DomainField | null => {
  if (!isRecord(raw)) {
    issues.push(structural('A field must be an object.', 'Each entry of "fields" is { key, label, semanticType, ... }.', entityName));
    return null;
  }
  const key = str(raw.key);
  const semanticType = oneOf(raw.semanticType, SEMANTIC_TYPES);
  if (key === undefined) {
    issues.push(structural('A field has no "key".', 'Give every field a key — it is what the record stores.', entityName));
    return null;
  }
  if (semanticType === undefined) {
    issues.push(structural(
      `Field "${key}" has no valid "semanticType".`,
      `Use one of: ${SEMANTIC_TYPES.join(', ')}. This is the field's MEANING, not its widget.`,
      entityName,
      key,
    ));
    return null;
  }
  const type = oneOf(raw.type, CUSTOM_FIELD_TYPES);
  if (raw.type !== undefined && type === undefined) {
    issues.push(structural(
      `Field "${key}" declares an unknown type "${String(raw.type)}".`,
      `Types the platform draws: ${CUSTOM_FIELD_TYPES.join(', ')}.`,
      entityName,
      key,
    ));
  }
  const field: DomainField = { key, label: str(raw.label) ?? key, semanticType };
  if (type !== undefined) field.type = type;
  if (bool(raw.required) !== undefined) field.required = bool(raw.required) as boolean;
  if (str(raw.target) !== undefined) field.target = str(raw.target) as string;
  if (bool(raw.multi) !== undefined) field.multi = bool(raw.multi) as boolean;
  if (str(raw.source) !== undefined) field.source = str(raw.source) as string;
  if (str(raw.reason) !== undefined) field.reason = str(raw.reason) as string;
  const derivedFrom = oneOf(raw.derivedFrom, DERIVED_FROM);
  if (derivedFrom !== undefined) field.derivedFrom = derivedFrom;
  if (str(raw.expression) !== undefined) field.expression = str(raw.expression) as string;
  const aggregation = readAggregation(raw.aggregation);
  if (aggregation !== undefined) field.aggregation = aggregation;
  if (str(raw.embeddedOf) !== undefined) field.embeddedOf = str(raw.embeddedOf) as string;
  if (str(raw.lookup) !== undefined) field.lookup = str(raw.lookup) as string;
  if (bool(raw.unique) !== undefined) field.unique = bool(raw.unique) as boolean;
  if (bool(raw.filterable) !== undefined) field.filterable = bool(raw.filterable) as boolean;
  if (bool(raw.showInList) !== undefined) field.showInList = bool(raw.showInList) as boolean;
  if (str(raw.section) !== undefined) field.section = str(raw.section) as string;
  return field;
};

const readNormalization = (raw: unknown): RecordKeyNormalization | undefined => {
  if (!isRecord(raw)) return undefined;
  const normalization: RecordKeyNormalization = {};
  if (bool(raw.trim) !== undefined) normalization.trim = bool(raw.trim) as boolean;
  if (bool(raw.caseInsensitive) !== undefined) {
    normalization.caseInsensitive = bool(raw.caseInsensitive) as boolean;
  }
  if (str(raw.formatPreset) !== undefined) normalization.formatPreset = str(raw.formatPreset) as string;
  return Object.keys(normalization).length > 0 ? normalization : undefined;
};

const readKey = (raw: unknown, entityName: string, issues: DomainIssue[]): DomainKey | null => {
  if (!isRecord(raw)) {
    issues.push(structural(
      'A key must be an object.',
      'Each entry of "keys" is { name, kind, fields }.',
      entityName,
    ));
    return null;
  }
  const name = str(raw.name);
  const kind = oneOf(raw.kind, RECORD_KEY_KINDS);
  const fields = (Array.isArray(raw.fields) ? raw.fields : [])
    .map((one) => str(one))
    .filter((one): one is string => one !== undefined);
  if (name === undefined || kind === undefined || fields.length === 0) {
    issues.push(structural(
      `A key of "${entityName}" is missing name, kind or fields.`,
      `kind: ${RECORD_KEY_KINDS.join(' | ')}, and "fields" names the fields of THIS entity, in order. `
      + 'A key over one field can be written as `unique: true` on the field instead.',
      entityName,
    ));
    return null;
  }
  const key: DomainKey = { name, kind, fields };
  const scope = oneOf(raw.scope, RECORD_KEY_SCOPES);
  if (scope !== undefined) key.scope = scope;
  const normalize = readNormalization(raw.normalize);
  if (normalize !== undefined) key.normalize = normalize;
  if (bool(raw.sparse) !== undefined) key.sparse = bool(raw.sparse) as boolean;
  if (str(raw.message) !== undefined) key.message = str(raw.message) as string;
  return key;
};

const readEntity = (raw: unknown, issues: DomainIssue[]): DomainEntity | null => {
  if (!isRecord(raw)) {
    issues.push(structural('An entity must be an object.', 'Each entry of "entities" is { name, kind, fields }.'));
    return null;
  }
  const name = str(raw.name);
  if (name === undefined) {
    issues.push(structural('An entity has no "name".', 'Name it after the business concept, not after the screen.'));
    return null;
  }
  const kind = oneOf(raw.kind, ENTITY_KINDS);
  if (kind === undefined) {
    issues.push(structural(
      `Entity "${name}" has no valid "kind".`,
      `Use one of: ${ENTITY_KINDS.join(', ')}.`,
      name,
    ));
    return null;
  }
  const rawFields = Array.isArray(raw.fields) ? raw.fields : [];
  if (!Array.isArray(raw.fields)) {
    issues.push(structural(`Entity "${name}" has no "fields" array.`, 'Declare fields: [] explicitly when it has none.', name));
  }
  const entity: DomainEntity = {
    name,
    kind,
    fields: rawFields.map((one) => readField(one, name, issues)).filter((one): one is DomainField => one !== null),
  };
  const keys = (Array.isArray(raw.keys) ? raw.keys : [])
    .map((one) => readKey(one, name, issues))
    .filter((one): one is DomainKey => one !== null);
  if (keys.length > 0) entity.keys = keys;
  if (str(raw.collection) !== undefined) entity.collection = str(raw.collection) as string;
  if (str(raw.description) !== undefined) entity.description = str(raw.description) as string;
  if (str(raw.titleField) !== undefined) entity.titleField = str(raw.titleField) as string;
  const tabs = (Array.isArray(raw.tabs) ? raw.tabs : [])
    .map((one) => {
      if (!isRecord(one)) return null;
      const kind = oneOf(one.kind, ENTITY_TAB_KINDS);
      const because = str(one.because);
      if (kind === undefined) {
        issues.push(structural(
          `Entity "${name}" declares a tab that is none of: ${ENTITY_TAB_KINDS.join(', ')}.`,
          'Those three are what the platform adds to a screen; anything else is a screen of its own.',
          name,
        ));
        return null;
      }
      if (because === undefined) {
        issues.push(structural(
          `Entity "${name}" turns the "${kind}" tab on without saying why.`,
          'Declare it as { kind, because }: the default is off, so turning one on is a decision, and an '
          + 'undeclared decision reads exactly like a habit six months later.',
          name,
        ));
        return null;
      }
      return { kind, because };
    })
    .filter((one): one is EntityTab => one !== null);
  if (tabs.length > 0) entity.tabs = tabs;
  return entity;
};

const readRelationship = (raw: unknown, issues: DomainIssue[]): DomainRelationship | null => {
  if (!isRecord(raw)) {
    issues.push(structural('A relationship must be an object.', 'Each entry is { sourceEntity, targetEntity, sourceField, type, storage, ownership }.'));
    return null;
  }
  const sourceEntity = str(raw.sourceEntity);
  const targetEntity = str(raw.targetEntity);
  const sourceField = str(raw.sourceField);
  const type = oneOf(raw.type, RELATIONSHIP_TYPES);
  const storage = oneOf(raw.storage, RELATIONSHIP_STORAGES);
  const ownership = oneOf(raw.ownership, OWNERSHIPS);
  const label = `${sourceEntity ?? '?'} -> ${targetEntity ?? '?'}`;

  if (sourceEntity === undefined || targetEntity === undefined || sourceField === undefined) {
    issues.push(structural(
      `Relationship ${label} is missing sourceEntity, targetEntity or sourceField.`,
      'The three are what make a relationship a single definition instead of a hint.',
    ));
    return null;
  }
  if (type === undefined || storage === undefined || ownership === undefined) {
    issues.push(structural(
      `Relationship ${label} is missing a valid type, storage or ownership.`,
      `type: ${RELATIONSHIP_TYPES.join(' | ')}; storage: ${RELATIONSHIP_STORAGES.join(' | ')}; ownership: ${OWNERSHIPS.join(' | ')}.`,
      sourceEntity,
      sourceField,
    ));
    return null;
  }

  const relationship: DomainRelationship = { sourceEntity, targetEntity, sourceField, type, storage, ownership };
  if (str(raw.name) !== undefined) relationship.name = str(raw.name) as string;
  if (bool(raw.required) !== undefined) relationship.required = bool(raw.required) as boolean;
  const displayFields = strList(raw.displayFields);
  if (displayFields !== undefined) relationship.displayFields = displayFields;
  const onDelete = oneOf(raw.onDelete, DELETE_SEMANTICS);
  if (onDelete !== undefined) relationship.onDelete = onDelete;
  if (isRecord(raw.denormalize)) {
    const denormKey = str(raw.denormalize.denormKey);
    const fields = strList(raw.denormalize.fields);
    if (denormKey !== undefined && fields !== undefined && fields.length > 0) {
      relationship.denormalize = {
        denormKey,
        fields,
        ...(str(raw.denormalize.reason) === undefined ? {} : { reason: str(raw.denormalize.reason) as string }),
      };
    } else {
      issues.push(structural(
        `Relationship ${label} declares "denormalize" without denormKey or fields.`,
        'Denormalization is a decision, so it is declared in full: { denormKey, fields, reason }.',
        sourceEntity,
        sourceField,
      ));
    }
  }
  if (Array.isArray(raw.attributes)) {
    relationship.attributes = raw.attributes
      .map((one) => readField(one, `${sourceEntity}<->${targetEntity}`, issues))
      .filter((one): one is DomainField => one !== null);
  }
  return relationship;
};

/**
 * Lê um modelo de JSON ou de um objeto já desserializado. Devolve `ok: false` só quando não sobrou
 * modelo nenhum — um campo torto no meio vira problema e o resto segue, porque um relatório com dez
 * problemas ensina mais que a primeira exceção.
 */
export const parseDomainModel = (raw: unknown): ParseResult => {
  const issues: DomainIssue[] = [];
  let value: unknown = raw;

  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch (error) {
      return {
        ok: false,
        issues: [structural(
          `The model is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
          'Send the model as a JSON object.',
        )],
      };
    }
  }

  if (!isRecord(value)) {
    return { ok: false, issues: [structural('The model must be a JSON object.', 'Read microteia://domain-model/schema for the shape.')] };
  }

  const target = oneOf(value.target, ['extension', 'screenDefinitions'] as const);
  if (target === undefined) {
    return {
      ok: false,
      issues: [structural(
        'The model has no valid "target".',
        'Use "extension" (the artifacts travel in a package) or "screenDefinitions" (they are created directly in this organization). '
        + 'There is no third option: business entities never live in the kernel.',
      )],
    };
  }

  if (!Array.isArray(value.entities) || value.entities.length === 0) {
    return { ok: false, issues: [structural('The model has no entities.', 'A domain model with no entity is not a model.')] };
  }

  const model: DomainModel = {
    version: typeof value.version === 'number' ? value.version : DOMAIN_MODEL_VERSION,
    target,
    entities: value.entities.map((one) => readEntity(one, issues)).filter((one): one is DomainEntity => one !== null),
    relationships: Array.isArray(value.relationships)
      ? value.relationships.map((one) => readRelationship(one, issues)).filter((one): one is DomainRelationship => one !== null)
      : [],
  };
  if (str(value.intent) !== undefined) model.intent = str(value.intent) as string;
  if (str(value.extensionId) !== undefined) model.extensionId = str(value.extensionId) as string;
  const behavior = parseBehaviorModel(value.behavior, issues);
  if (behavior !== undefined) model.behavior = behavior;

  if (model.entities.length === 0) return { ok: false, issues };
  return { ok: true, model, issues };
};
