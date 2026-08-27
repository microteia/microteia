import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { EntityMetadata, NativeFieldSpec } from '../../domain/schema/entityRegistry';
import type { SchemaContext, SchemaLookup, SchemaScreen, SchemaTagList } from '../../domain/schema/screenEntity';
import { createSchemaContext, nativeSpecToFieldDefinition, resolveEntity } from '../../domain/schema/screenEntity';

/**
 * O CATÁLOGO — o que já existe, lido do kernel e nunca reinventado aqui.
 *
 * Este arquivo não declara entidade nenhuma: ele monta o `SchemaContext` do próprio kernel e
 * pergunta a ele, com `resolveEntity`, exatamente como o front e o backend perguntam. É o que
 * garante que "esta coleção já existe" signifique aqui a mesma coisa que na hora de instalar — e é
 * também o que impede este subsistema de virar um segundo registro de entidades, que é o defeito
 * que ele existe para não cometer.
 *
 * De onde vêm as telas depende de quem chama: `src/sdk/node/workspaceCatalog.ts` as lê dos
 * `plugin.ts` deste diretório de autoria; um teste as passa à mão. O que este módulo NÃO faz é
 * inventar uma origem — ele recebe telas e devolve entidades.
 */

export type ParentRelation = 'owned' | 'related';

/**
 * A forma mínima comum entre uma `ScreenDefinition` do escritório e um `ScreenModuleTemplate` de
 * pacote. As duas descrevem a mesma coisa; o catálogo não precisa saber de qual das duas veio.
 */
export interface CatalogScreenInput {
  key: string;
  collection?: string | null;
  /**
   * O id UNIVERSAL desta tela, quando ela já tem um. É por ele que uma atualização a reconhece, e é a
   * segunda precedência do plano: o que o pacote já declara nunca é recalculado. Ver
   * `SCREEN_SOURCE_ID_PRECEDENCE`.
   */
  sourceId?: string | null;
  titleSingular: string;
  titlePlural?: string;
  titleFieldKey: string;
  fields: FieldDefinition[];
  parentEntity?: string | null;
  parentFieldKey?: string | null;
  parentRelation?: ParentRelation | null;
  tagCollection?: string | null;
  eventPrefix?: string | null;
  ownerPluginId?: string | null;
  /**
   * De ONDE esta tela foi lida. Ausente vale `workspace`, que é o caso de quem passa telas à mão e o
   * dos `plugin.ts` do diretório de autoria.
   *
   * `installation` é o retrato exportado pelo Console (`installedCatalog.ts`): a tela que o escritório
   * criou no Form Design, ou a que uma extensão de terceiro instalou. Ela entra no catálogo pela mesma
   * porta que qualquer outra — o que muda é o que a resposta diz sobre a origem dela, e isso não é
   * decoração: uma entidade que existe só na instalação NÃO está no `plugin.ts` que o autor edita.
   */
  source?: 'workspace' | 'installation';
}

export interface CatalogField {
  key: string;
  /** Como a plataforma o desenha — o `type` de `FieldDefinition`. */
  type: FieldDefinition['type'];
  required: boolean;
  multi: boolean;
  refEntity?: string;
  lookupCollection?: string;
  /** O agregado, inteiro — a comparação do plano é campo a campo, e "mesma origem" não basta. */
  aggregation?: { from: string; via: string; op: string; field?: string };
  computeExpression?: string;
  origin: FieldDefinition['origin'];
}

export interface CatalogEntity {
  collection: string;
  /** A chave da TELA, quando ela difere da coleção (uma tela de extensão sobre coleção existente). */
  screenKey: string;
  labelSingular: string;
  labelPlural: string;
  titleFieldKey?: string;
  /**
   * `kernel` = declarada em `entityRegistry.ts`; `workspace` = trazida por um `plugin.ts` do diretório
   * de autoria; `installation` = trazida pelo retrato do escritório, e portanto NÃO editável daqui.
   */
  source: 'kernel' | 'workspace' | 'installation';
  ownerPluginId?: string;
  parent?: { collection: string; fieldKey: string; relation: ParentRelation };
  fields: CatalogField[];
}

export interface CatalogList {
  collection: string;
  label: string;
}

/**
 * Uma DUPLICAÇÃO já declarada e aceita, gravada por coleção e chave.
 *
 * Existe porque `howToDeclareException` só vale se a declaração persistir. Um snapshot legítimo —
 * `SaleItem.productName`, o nome do produto como saiu na nota — vira um campo `text` comum no
 * artefato: `source` e `reason` não têm onde morar em `FieldDefinition`, e a sessão seguinte, que
 * remodela a coleção a partir do catálogo, acusa o mesmo campo de novo. A pessoa reaprova para
 * sempre, que é o oposto do que uma exceção declarada deveria custar.
 *
 * Ela viaja fora do pacote, de propósito: fazê-la descer para o artefato INSTALADO exigiria uma
 * propriedade nova em `FieldDefinition`, o que muda a forma do pacote e move o `KERNEL_VERSION`.
 */
export interface CatalogException {
  collection: string;
  field: string;
  semanticType: 'snapshot';
  source: string;
  reason: string;
  /** De onde a declaração foi lida — o arquivo, ou o plano que acabou de ser aplicado. */
  declaredIn: string;
}

export interface DomainCatalog {
  entities: CatalogEntity[];
  lookups: CatalogList[];
  tagLists: CatalogList[];
  /**
   * As telas CRUAS que produziram as entidades acima. Ficam aqui porque o validador e o plano
   * precisam montar um `SchemaContext` que some o que já existe ao que o modelo propõe — para
   * perguntar ao kernel, e não a uma reconstrução aproximada, se um agregado fecha ciclo.
   */
  screens: CatalogScreenInput[];
  /** As duplicações já declaradas, para que o veredito de ontem não seja repetido hoje. */
  exceptions: CatalogException[];
}

export const exceptionKey = (collection: string, field: string): string => `${collection}.${field}`;

/** Só o nome da coleção interessa à comparação; a chave da tela endereça a UI. */
export const collectionOfScreen = (screen: CatalogScreenInput): string => screen.collection?.trim() || screen.key;

/**
 * Os `sourceId` que as telas deste catálogo já declaram, por coleção. Uma tela sem ele não entra: a
 * ausência é "derive", e um valor vazio no mapa seria uma identidade que ninguém escreveu.
 *
 * Duas telas sobre a mesma coleção (uma dona e um complemento) resolvem para a que TEM o id — o
 * complemento não reivindica a identidade da entidade, do mesmo modo que não reivindica o rótulo dela.
 */
export const declaredScreenSourceIds = (screens: readonly CatalogScreenInput[]): Map<string, string> => {
  const byCollection = new Map<string, string>();
  for (const screen of screens) {
    const sourceId = screen.sourceId?.trim();
    if (!sourceId) continue;
    const collection = collectionOfScreen(screen);
    if (!byCollection.has(collection)) byCollection.set(collection, sourceId);
  }
  return byCollection;
};

/** Ausente vale `workspace` — ver `CatalogScreenInput.source`. */
export const sourceOf = (screen: CatalogScreenInput): 'workspace' | 'installation' => screen.source ?? 'workspace';

export const toSchemaScreen = (screen: CatalogScreenInput): SchemaScreen => ({
  id: screen.key,
  ...(screen.collection?.trim() ? { collection: screen.collection.trim() } : {}),
  titleSingular: screen.titleSingular,
  ...(screen.titlePlural === undefined ? {} : { titlePlural: screen.titlePlural }),
  titleFieldKey: screen.titleFieldKey,
  fields: screen.fields,
  ...(screen.tagCollection === undefined ? {} : { tagCollection: screen.tagCollection }),
  ...(screen.eventPrefix === undefined ? {} : { eventPrefix: screen.eventPrefix }),
});

/**
 * Achata o que o kernel guarda como objeto. `deriveEntitySchema` faz o mesmo do lado da tela, e pelo
 * mesmo motivo: nenhuma superfície da plataforma mostra um objeto — o que ela mostra são as folhas,
 * endereçadas por caminho pontilhado. Aqui isso importa porque a comparação do plano é por CHAVE.
 */
const flatten = (specs: readonly NativeFieldSpec[], prefix: string): { spec: NativeFieldSpec; key: string }[] =>
  specs.flatMap((spec) => (spec.type === 'object' && spec.objectFields
    ? flatten(spec.objectFields, `${prefix}${spec.key}.`)
    : [{ spec, key: `${prefix}${spec.key}` }]));

const toCatalogField = (spec: NativeFieldSpec, key: string): CatalogField => {
  const definition = nativeSpecToFieldDefinition(spec, key, spec.ui?.order ?? 0);
  return {
    key,
    type: definition.type,
    required: definition.required,
    multi: definition.multi === true,
    ...(definition.refEntity ? { refEntity: definition.refEntity } : {}),
    ...(definition.lookupCollection ? { lookupCollection: definition.lookupCollection } : {}),
    ...(spec.aggregation
      ? {
        aggregation: {
          from: spec.aggregation.from,
          via: spec.aggregation.via,
          op: spec.aggregation.op as string,
          ...(spec.aggregation.field ? { field: spec.aggregation.field } : {}),
        },
      }
      : {}),
    ...(spec.logic?.compute?.trim() ? { computeExpression: spec.logic.compute.trim() } : {}),
    origin: definition.origin,
  };
};

const entityFrom = (
  metadata: EntityMetadata,
  screen: CatalogScreenInput | undefined,
  source: CatalogEntity['source'],
): CatalogEntity => {
  const parent = screen?.parentEntity?.trim() && screen.parentFieldKey?.trim()
    ? {
      collection: screen.parentEntity.trim(),
      fieldKey: screen.parentFieldKey.trim(),
      relation: (screen.parentRelation ?? 'owned') as ParentRelation,
    }
    : undefined;

  return {
    collection: metadata.collection,
    screenKey: screen?.key ?? metadata.collection,
    labelSingular: metadata.labelSingular,
    labelPlural: metadata.labelPlural,
    ...(metadata.displayNameFields[0] ? { titleFieldKey: metadata.displayNameFields[0] } : {}),
    source,
    ...(screen?.ownerPluginId ? { ownerPluginId: screen.ownerPluginId } : {}),
    ...(parent === undefined ? {} : { parent }),
    fields: flatten(metadata.fields, '').map(({ spec, key }) => toCatalogField(spec, key)),
  };
};

/**
 * O catálogo completo: as entidades do `entityRegistry.ts` (hoje `members` e `tenant`, e é isso
 * mesmo — as de negócio saíram do kernel) mais toda coleção que as telas recebidas descrevem.
 *
 * Uma coleção descrita por DUAS telas aparece uma vez só, com a declaração já fundida por
 * `createSchemaContext`, que é quem sabe qual das duas manda em quê.
 */
export const buildDomainCatalog = (
  screens: readonly CatalogScreenInput[] = [],
  lookups: readonly SchemaLookup[] = [],
  tagLists: readonly SchemaTagList[] = [],
  exceptions: readonly CatalogException[] = [],
): DomainCatalog => {
  const ctx = createSchemaContext(screens.map(toSchemaScreen), lookups, tagLists);
  const byCollection = new Map<string, CatalogScreenInput>();
  for (const screen of screens) {
    const collection = collectionOfScreen(screen);
    const current = byCollection.get(collection);
    // A tela DONA do nome descreve a coleção; a outra apenas soma campos. Mesma regra de
    // `mergeSchemaScreens`, e ela decide de quem sai o `parent` desta entidade.
    //
    // Entre duas fontes manda o WORKSPACE: é a versão que o autor está editando agora, e uma tela do
    // retrato jamais a descreve melhor do que ela se descreve. Quem junta as duas listas já descarta a
    // do retrato antes de chegar aqui; esta linha é o que garante o mesmo veredito para quem monta o
    // catálogo à mão.
    const held = current === undefined ? undefined : sourceOf(current);
    if (held === undefined || (held === 'installation' && sourceOf(screen) !== 'installation')) {
      byCollection.set(collection, screen);
      continue;
    }
    if (screen.key === collection && held === sourceOf(screen)) byCollection.set(collection, screen);
  }

  const collections = new Set<string>([...Object.keys(ctx.registry), ...ctx.screens.keys()]);
  const entities: CatalogEntity[] = [];
  for (const collection of collections) {
    const metadata = resolveEntity(ctx, collection);
    if (!metadata) continue;
    const screen = byCollection.get(collection);
    entities.push(entityFrom(
      metadata,
      screen,
      collection in ctx.registry ? 'kernel' : screen?.source ?? 'workspace',
    ));
  }

  return {
    entities: entities.sort((a, b) => a.collection.localeCompare(b.collection)),
    lookups: [...ctx.lookups.values()].map((lookup) => ({ collection: lookup.collection, label: lookup.label })),
    tagLists: [...ctx.tagLists.values()].map((list) => ({ collection: list.collection, label: list.label })),
    screens: [...screens],
    exceptions: [...exceptions],
  };
};

export const catalogEntity = (catalog: DomainCatalog, collection: string): CatalogEntity | undefined =>
  catalog.entities.find((entity) => entity.collection === collection);

export const catalogSchemaContext = (
  screens: readonly CatalogScreenInput[],
  lookups: readonly SchemaLookup[] = [],
  tagLists: readonly SchemaTagList[] = [],
): SchemaContext => createSchemaContext(screens.map(toSchemaScreen), lookups, tagLists);
