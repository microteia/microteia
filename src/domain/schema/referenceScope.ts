import type { FieldDefinition } from '../entities/entitySchemas';
import { extractFieldExpressionPaths } from './fieldExpression';
import { buildHydrationPlan } from './hydrationPlan';
import { collectHopRecordRefs, materializeHops, recordKey } from './materialize';
import { getValueAtPath, parsePath, resolvePath } from './pathResolver';
import type { FkHop, PathRoot, SchemaContext } from './pathResolver';

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

/**
 * NAVEGAÇÃO DE REFERÊNCIA NAS EXPRESSÕES DE AÇÃO — mesma fronteira front-only, outra regra de troca.
 *
 * O slot de campo troca TODO id de referência pelo registro. Na ação isso quebraria o que já está
 * escrito: `parameterDefaults: { clientId: 'clientId' }` passaria a pré-preencher o parâmetro com um
 * objeto. Por isso aqui só vira registro o nome que a expressão NAVEGA (`caseId.title`); quem o lê
 * sozinho continua lendo o id.
 *
 * As peças são as do hidratador de workflow do backend — `buildHydrationPlan` decide os saltos e
 * `materializeHops` os aplica —, com a mesma semântica de ausência: registro que não veio vira
 * `{ id }`, nunca erro.
 */
export type ReferenceLookup = (collection: string, id: string) => Record<string, unknown> | null;

export interface ReferenceNavigator {
  schema: SchemaContext;
  /** O que já está em memória, e só o que quem olha pode ler. `null` = não se sabe. */
  lookup: ReferenceLookup;
  /** Busca sob demanda — só para quem pode esperar, como o formulário de parâmetros. */
  fetch?: (collection: string, id: string) => Promise<Record<string, unknown> | null>;
}

export interface ReferencePlan {
  levels: FkHop[][];
  /** Caminhos que a expressão lê SEM descer — um nome aqui é lido como está. */
  readAsIs: ReadonlySet<string>;
  /** Os caminhos que descem por uma referência — cada um responde `null` quando não há valor. */
  navigated: string[];
}

const planCache = new WeakMap<SchemaContext, Map<string, ReferencePlan | null>>();

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const buildReferencePlan = (
  schema: SchemaContext,
  entity: string,
  expressions: string[],
  reservedRoots: ReadonlySet<string>,
): ReferencePlan | null => {
  const paths = expressions
    .flatMap((expression) => extractFieldExpressionPaths(expression))
    .filter((path) => !reservedRoots.has(path.split('.')[0]));
  const root: PathRoot = { kind: 'entity', entityKey: entity, hasOld: false };
  const navigated = paths.filter((path) => {
    if (!path.includes('.')) return false;
    const resolution = resolvePath(schema, root, parsePath(path));
    return resolution.valid && resolution.hops.every((hop) => !hop.multi);
  });
  if (navigated.length === 0) return null;

  const crossed = (hop: FkHop) => navigated.some((path) => path.startsWith(`${hop.materializeAt}.`));
  const levels = buildHydrationPlan(schema, root, navigated).levels
    .map((hops) => hops.filter(crossed))
    .filter((hops) => hops.length > 0);
  return levels.length === 0 ? null : { levels, readAsIs: new Set(paths), navigated };
};

/**
 * O plano de uma expressão é função só do esquema e do texto, e uma listagem avalia a mesma
 * expressão uma vez por cartão — por isso ele é guardado, preso à identidade do esquema.
 */
export const planReferenceNavigation = (
  schema: SchemaContext,
  entity: string,
  expressions: string[],
  reservedRoots: ReadonlySet<string> = new Set(),
): ReferencePlan | null => {
  const relevant = expressions.filter((expression) => expression.includes('.'));
  if (!entity || relevant.length === 0) return null;
  const cacheKey = `${entity}\u0000${[...reservedRoots].join(',')}\u0000${relevant.join('\u0000')}`;
  let byKey = planCache.get(schema);
  if (!byKey) {
    byKey = new Map();
    planCache.set(schema, byKey);
  }
  if (!byKey.has(cacheKey)) byKey.set(cacheKey, buildReferencePlan(schema, entity, relevant, reservedRoots));
  return byKey.get(cacheKey) ?? null;
};

const setOnExistingPath = (
  target: Record<string, unknown>,
  keys: string[],
  value: unknown,
): Record<string, unknown> => {
  const [key, ...rest] = keys;
  if (rest.length === 0) return { ...target, [key]: value };
  const child = target[key];
  if (!isPlainRecord(child)) return target;
  return { ...target, [key]: setOnExistingPath(child, rest, value) };
};

/**
 * Aplica o plano sobre os valores. Um salto navegado que não chegou a registro nenhum — referência
 * vazia, registro apagado, coleção que quem olha não lê — vira `{ id: null }`, e é isso que faz
 * `caseId.title` responder `null` em vez de estourar ao ler um campo de `null`. Todo caminho
 * navegado sem valor responde `null`, nunca `undefined` — a mesma promessa do `includeWhen` dos
 * relatórios, e o que faz `caseId.title == null` dizer a verdade.
 *
 * A exceção é o nome que a própria expressão também lê como está: em
 * `isEmpty(caseId) or caseId.title == "X"` a referência vazia continua `null`, para que o
 * `isEmpty` responda o que sempre respondeu.
 */
export const navigateReferences = (
  values: Record<string, unknown>,
  plan: ReferencePlan,
  lookup: ReferenceLookup,
): Record<string, unknown> => {
  let scope = values;
  for (const hops of plan.levels) {
    const records = new Map<string, Record<string, unknown> | null>();
    for (const ref of collectHopRecordRefs(scope, hops)) {
      records.set(recordKey(ref.collection, ref.id), lookup(ref.collection, ref.id));
    }
    scope = materializeHops(scope, hops, records);
  }
  for (const hop of plan.levels.flat()) {
    if (plan.readAsIs.has(hop.materializeAt)) continue;
    const segments = parsePath(hop.materializeAt);
    if (segments.some((segment) => segment.kind !== 'key')) continue;
    if (isPlainRecord(getValueAtPath(scope, segments))) continue;
    scope = setOnExistingPath(scope, hop.materializeAt.split('.'), { id: null });
  }
  for (const path of plan.navigated) {
    if (getValueAtPath(scope, parsePath(path)) !== undefined) continue;
    scope = setOnExistingPath(scope, path.split('.'), null);
  }
  return scope;
};

/**
 * Traz para um `lookup` novo o que o plano vai precisar e a memória não tem, salto a salto — o
 * segundo nível só se conhece depois de o primeiro chegar. O que não vier (apagado, sem permissão,
 * falha de rede) fica `null`, e a navegação o trata como qualquer referência sem registro.
 */
export const loadNavigatedReferences = async (
  values: Record<string, unknown>,
  plan: ReferencePlan,
  navigator: ReferenceNavigator,
): Promise<ReferenceLookup> => {
  const loaded = new Map<string, Record<string, unknown> | null>();
  const lookup: ReferenceLookup = (collection, id) => {
    const key = recordKey(collection, id);
    return loaded.has(key) ? (loaded.get(key) ?? null) : navigator.lookup(collection, id);
  };
  const { fetch } = navigator;
  if (!fetch) return lookup;

  let scope = values;
  for (const hops of plan.levels) {
    const missing = collectHopRecordRefs(scope, hops).filter((ref) => lookup(ref.collection, ref.id) === null);
    await Promise.all(missing.map(async (ref) => {
      let record: Record<string, unknown> | null;
      try {
        record = await fetch(ref.collection, ref.id);
      } catch {
        record = null;
      }
      loaded.set(recordKey(ref.collection, ref.id), record);
    }));
    const records = new Map<string, Record<string, unknown> | null>();
    for (const ref of collectHopRecordRefs(scope, hops)) {
      records.set(recordKey(ref.collection, ref.id), lookup(ref.collection, ref.id));
    }
    scope = materializeHops(scope, hops, records);
  }
  return lookup;
};
