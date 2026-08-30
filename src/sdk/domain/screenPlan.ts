import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { RecordKeyKind, RecordKeyScope } from '../../domain/schema/recordKeys';
import { anyOf, notExpression, notTerm } from '../../domain/schema/expressionSyntax';
import type { CatalogScreenInput } from './catalog';
import type { BehaviorInvariant, BehaviorModel } from './behaviorModel';
import { stateOfEntity } from './behaviorModel';
import type { MappedTransition } from './behaviorMapping';
import type { DomainEntity, DomainField, DomainIssue, DomainModel, EntityTabKind } from './domainModel';
import type { DomainIssueCode } from './detectors';
import type { ExpandedEmbed } from './toPlatform';
import { collectionOfEntity } from './toPlatform';
import { canonicalRelationship } from './storageMapping';

/**
 * O PLANO DE TELAS — o que a pessoa VÊ, decidido por regra e não por julgamento.
 *
 * O plano de artefatos já dizia quais coleções e campos têm de existir. Ele não dizia nada sobre a
 * tela, e a lacuna não era cosmética: `titleFieldKey` é obrigatório, uma coluna de listagem que não
 * existe é uma lista de registros indistinguíveis, e uma transição de gesto sem ação de registro é
 * uma automação que ninguém consegue disparar. Quem preenchia esses vazios era o modelo de linguagem,
 * sessão a sessão, com resposta diferente cada vez.
 *
 * Então elas são REGRAS, declaradas em `SCREEN_PLAN_RULES` e aplicadas aqui. A disciplina tem duas
 * metades, e a segunda é a que importa:
 *
 * - **O que a regra decide, ela decide sozinha** — entidade raiz rende listagem e detalhe, filho
 *   rende aba do pai e nunca entrada de menu, lista de opções nunca rende tela.
 * - **O que a regra NÃO decide, ela declara que não decide.** Ícone e ordem de menu são escolha
 *   humana, e o plano diz isso em vez de sortear. Um plano que sorteia parece completo, e o custo
 *   aparece quando o escritório recebe um ícone que não tem nada a ver com o negócio dele — e ninguém
 *   sabe se aquilo foi decidido ou tirado da cartola.
 *
 * O mesmo vale para ONDE a ação aparece: no cartão da listagem e no cabeçalho do detalhe a ação
 * significa coisas diferentes, e a única parte disso que é derivável é a LEGIBILIDADE — um gesto que
 * está desabilitado por causa de um campo que o cartão não mostra vira um botão apagado sem
 * explicação. Essa parte a regra decide; o resto ela devolve.
 */

/** Uma regra do plano de telas, e de onde ela sai. Fonte da tabela do guia — nunca uma cópia em prosa. */
export interface ScreenPlanRule {
  /** O que chega — a coisa do modelo sobre a qual a regra decide. */
  subject: string;
  /** O que a regra decide, sem exceção. */
  decides: string;
  /** O mecanismo da plataforma que recebe a decisão. */
  declaredAs: string;
}

export const SCREEN_PLAN_RULES: ScreenPlanRule[] = [
  {
    subject: 'entity of kind "entity"',
    decides: 'a list and a detail, reachable from the menu',
    declaredAs: 'one `screens: [{ key, titleFieldKey, fields }]` entry; the platform draws list, detail, form and filters',
  },
  {
    subject: 'entity of kind "child"',
    decides: 'a tab of its parent, and NEVER an entry of its own in the menu',
    declaredAs: '`parentEntity` / `parentFieldKey` / `parentRelation` on the screen, plus `hideFromSidebar: true`',
  },
  {
    subject: 'entity of kind "lookup"',
    decides: 'an option list in the collection, and NEVER a screen',
    declaredAs: '`lookups: [{ collection, label }]` — no screen, no records, no four permissions',
  },
  {
    subject: 'entity of kind "valueObject"',
    decides: 'a section of the owner\'s form; it is not a screen and not a collection',
    declaredAs: 'the flattened keys carry `section: <the field label>` on the owner screen',
  },
  {
    subject: 'relationship many-to-one (and one-to-one)',
    decides: 'a reference field on the N side; the label of the pointed record is resolved when it is drawn',
    declaredAs: "field { type: 'reference', refEntity } — never a second field holding the other record's name",
  },
  {
    subject: 'relationship one-to-many that is not a child',
    decides: 'nothing. No tab of related records unless the rule asks for one',
    declaredAs: 'no artifact. A related-records tab is `storage: "child"` with `ownership: "association"`',
  },
  {
    subject: 'derived field (computed or aggregated)',
    decides: 'read-only in the form',
    declaredAs: 'nothing to declare — the form disables any field carrying `logic.compute` or `aggregation`',
  },
  {
    subject: 'state field',
    decides: 'a column of the list, and filterable',
    declaredAs: 'field { showInList: true, filterable: true } on the select served by the state list',
  },
  {
    subject: 'transition triggered by user-action',
    decides: 'one record action, disabled exactly where the blocking invariant says the passage is refused',
    declaredAs: "actions: [{ key, workflowId, disabledWhen, hiddenWhen }], listed in the screen's cardActionIds / viewActionIds",
  },
  {
    subject: 'entity key (entity.keys, or a field with unique: true)',
    decides: 'one declared key on the screen — and NOTHING is inferred: an entity with no key declared gets none, '
      + 'because "these two records look alike" is a business statement, never a shape of the data',
    declaredAs: "screen { keys: [{ name, kind, fields, scope, normalize, sparse }] }. The value is reserved in a "
      + 'document whose id derives from the value, in the same batch as the record — creating it is the lock. It is '
      + 'NOT the document id, which stays random so a corrected value does not have to move the document',
  },
  {
    subject: 'relationship one-to-one WITHOUT a key on the reference field',
    decides: 'a warning, not an artifact: stored, it is a many-to-one, and the "one" holds only if a key says so',
    declaredAs: 'nothing is emitted. Declaring `unique: true` on the reference field is what makes it one-to-one',
  },
  {
    subject: 'notes, documents and tags tabs',
    decides: 'off, unless the entity declares the tab WITH the reason',
    declaredAs: '`hasNotes` / `hasDocuments` / `hasTags` (+ `tagCollection`), from `entity.tabs`',
  },
];

/**
 * O que este plano NÃO decide, nomeado uma vez. Não é uma ressalva: é a saída, e é ela que impede a
 * lista de parecer completa quando não é.
 */
export const SCREEN_PLAN_HUMAN_DECISIONS = [
  'the icon of each screen (`icon`) — it names the business to whoever looks at the menu, and no comparison derives it',
  'the position in the menu (`sidebarOrder`) — an order is a statement about what matters most here',
  'the subtitle and the image of the card (`subtitleFieldKey`, `imageFieldKey`) — which second field identifies a record is a judgement',
  'the title of each record action, and its icon — they are text a person reads, and they travel through the message catalog',
];

/**
 * A IDENTIDADE UNIVERSAL DA TELA — e a regra de segurança que vem antes da derivação.
 *
 * O `sourceId` é por onde uma ATUALIZAÇÃO reconhece a tela: `buildScreenKeyMap` procura no escritório
 * uma tela com o mesmo id universal e reusa a chave dela; não achando, reivindica a chave declarada e,
 * se o nome estiver ocupado, ganha sufixo. Então um `sourceId` que muda entre duas versões do MESMO
 * pacote não dá erro em lugar nenhum: instala uma SEGUNDA tela ao lado da primeira, e a primeira —
 * que continua sendo do plugin e saiu da lista desta versão — é liberada. Os registros ficam na
 * coleção antiga, sem tela, e nada na atualização diz que foi isso que aconteceu.
 *
 * Enquanto o valor era escolha humana, isso era uma decisão sem defesa: quem escreve o `plugin.ts` da
 * versão 2 não tem como saber o que a versão 1 escolheu, e o erro só aparece no escritório.
 *
 * **A precedência é a parte que importa, e ela vem antes da derivação.** Um `sourceId` que já existe
 * NUNCA é recalculado — nem quando o rótulo da entidade muda, nem quando a regra é reescrita, nem
 * quando esta derivação for trocada por outra. Um algoritmo novo aplicado ao que já existe causaria
 * exatamente o defeito que ele veio fechar, e causaria em todos os escritórios de uma vez.
 */
export const SCREEN_SOURCE_ID_PRECEDENCE = [
  'the ledger first: a sourceId this rule already registered is used exactly as recorded, forever — a '
  + 'new derivation is never applied to a screen that already exists',
  'then the package: whatever the plugin.ts (or the catalog of this installation) already declares for '
  + 'that collection',
  'and only for a screen that is NEW, the derivation: "<extension id>:<collection>"',
] as const;

/**
 * A derivação: o id da extensão mais a coleção da entidade, separados por `:` — a mesma forma que o
 * guia de autoria já ensinava à mão (`com.example.billing:invoice`).
 *
 * A base é essa por eliminação. O que o `sourceId` tem de sobreviver é justamente o que uma pessoa
 * reescreve: o RÓTULO da entidade (que é o `titleSingular` da tela), o ENUNCIADO da regra e a ORDEM
 * das telas no plano. Nenhum dos três entra aqui. O id da extensão é único no mundo por construção
 * (é reverso de domínio, e o manifest o valida), então duas extensões com entidades de mesmo nome não
 * colidem; a coleção é única dentro de uma extensão, então duas telas da mesma extensão não colidem.
 *
 * E ela é a COLEÇÃO, não o nome de domínio da entidade, porque a coleção é a identidade que a
 * plataforma reconhece: é onde o dado está, é imutável depois de escrita (renomeá-la é migração, e o
 * plano recusa), e é por ela que todo o resto do plano é endereçado. Renomear a entidade sem declarar
 * `collection` renomeia a coleção junto — e aí o `sourceId` muda de propósito: para a instalação
 * aquela é uma tela nova mesmo, e os registros da coleção antiga continuam onde estavam.
 */
export const deriveScreenSourceId = (namespace: string, collection: string): string => {
  const left = namespace.trim();
  const right = collection.trim();
  return left === '' || right === '' ? '' : `${left}:${right}`;
};

/** De onde o `sourceId` desta tela saiu — ver `SCREEN_SOURCE_ID_PRECEDENCE`. */
export type ScreenSourceIdOrigin = 'ledger' | 'declared' | 'derived';

/**
 * Quantas colunas cabem numa linha de listagem antes de ela deixar de ser legível. Acima disso o plano
 * não corta sozinho: ele DIZ que a escolha é humana, porque cortar em silêncio esconde um campo que
 * alguém pôs ali de propósito.
 */
export const SCREEN_LIST_COLUMN_BUDGET = 6;

/**
 * O que filtra bem, por TIPO. Texto livre não entra: a plataforma já tem busca, e um filtro de texto
 * sobre nome é a busca outra vez, com outro nome e outro lugar.
 */
const FILTERABLE_TYPES = new Set<FieldDefinition['type']>(['select', 'reference', 'checkbox']);

export type ScreenPresence = 'menu-and-detail' | 'tab-of-parent';

export interface PlannedListColumn {
  key: string;
  because: string;
}

export interface PlannedFormSection {
  name: string;
  fieldKeys: string[];
  /** O `valueObject` que produziu a seção, quando ela veio de um achatamento. */
  fromValueObject?: string;
}

export interface PlannedReadOnlyField {
  key: string;
  because: string;
}

export interface PlannedReferenceField {
  key: string;
  points: string;
  multi: boolean;
  /** Escrito no plano porque é a decisão que mais se erra: o rótulo NUNCA é copiado para um campo. */
  labelResolvedBy: string;
}

export type ActionPlacement = 'list-card' | 'detail-header' | 'human-choice';

export interface PlannedRecordAction {
  /** A chave da ação — a mesma que o gatilho `user-action` declarou. */
  key: string;
  transition: string;
  /** Uma frase de negócio sobre o que a passagem faz. Ausente é um defeito do modelo, não daqui. */
  description?: string;
  eventName: string;
  /** O parâmetro de referência sem o qual a condição do fluxo não resolve o campo do estado. */
  requiresParameter?: string;
  workflowCondition: string;
  /**
   * Quando o gesto é RECUSADO, no escopo da ação. Sai do `from` da transição somado a cada invariante
   * `blocks` dela — que é o único lugar onde `blocks` pode sentar num gesto de pessoa.
   */
  disabledWhen: string;
  /** Quando a ação nem aparece. Sai da permissão. */
  hiddenWhen?: string;
  placement: ActionPlacement;
  placementBecause: string;
}

export interface PlannedTab {
  kind: EntityTabKind;
  because: string;
}

export interface ScreenLayout {
  entity: string;
  kind: 'entity' | 'child';
  collection: string;
  /**
   * O id UNIVERSAL da tela, emitido pelo plano. É ele que faz a versão seguinte do pacote ATUALIZAR
   * esta tela em vez de instalar uma segunda ao lado dela.
   */
  sourceId: string;
  /** Se ele foi lido do livro, do que o pacote já declara, ou derivado agora. */
  sourceIdFrom: ScreenSourceIdOrigin;
  presence: ScreenPresence;
  /** Sempre presente: uma tela sem campo-título lista registros indistinguíveis. */
  titleFieldKey: string;
  parent?: { collection: string; fieldKey: string; relation: 'owned' | 'related' };
  listColumns: PlannedListColumn[];
  filterableFields: PlannedListColumn[];
  sections: PlannedFormSection[];
  readOnlyFields: PlannedReadOnlyField[];
  referenceFields: PlannedReferenceField[];
  actions: PlannedRecordAction[];
  tabs: PlannedTab[];
  /**
   * O que não pode se repetir nesta tela, já na forma que o `plugin.ts` declara.
   *
   * Sai no plano porque a chave é a única declaração cuja AUSÊNCIA não produz sintoma nenhum: sem
   * ela a tela aceita a duplicata em silêncio, e quem lê o plano não tem como notar a falta de algo
   * que não está escrito. Estando aqui, ela é conferível junto com o resto.
   */
  keys: PlannedKey[];
  /** O que esta tela deixa para a pessoa, além do que `SCREEN_PLAN_HUMAN_DECISIONS` já nomeia. */
  humanDecisions: string[];
}

/** Uma chave da tela, com o campo que a compõe e o que ela promete. */
export interface PlannedKey {
  name: string;
  kind: RecordKeyKind;
  fields: string[];
  scope: RecordKeyScope;
  /** `false` quando o valor é obrigatório. */
  sparse: boolean;
  /** De onde ela veio: a lista da entidade, ou o atalho `unique` de um campo. */
  declaredBy: 'entity.keys' | 'field.unique';
  enforcedBy: string;
}

/** Uma entidade que o plano deliberadamente NÃO transforma em tela, e por quê. */
export interface NotAScreen {
  entity: string;
  kind: string;
  becomes: string;
  because: string;
}

export interface ScreenPlan {
  screens: ScreenLayout[];
  /** As entidades que não rendem tela — listas de opções e objetos de valor. */
  notScreens: NotAScreen[];
  /**
   * TUDO que a regra devolve para a pessoa: o que vale para toda tela mais o que cada tela deixou em
   * aberto. Num lugar só, de propósito — quem lê o plano tem uma lista para percorrer, e não duas para
   * lembrar de somar.
   */
  humanDecisions: string[];
  issues: DomainIssue[];
}

const make = (code: DomainIssueCode, severity: DomainIssue['severity'], draft: Omit<DomainIssue, 'code' | 'severity'>): DomainIssue => ({
  code,
  severity,
  ...draft,
});

/** Os tokens de raiz de uma expressão, para saber quais CAMPOS ela lê. */
const referencedKeys = (expression: string): string[] => {
  const withoutText = expression.replace(/"[^"]*"|'[^']*'/g, ' ');
  const tokens = withoutText.match(/[A-Za-z_][A-Za-z0-9_.]*/g) ?? [];
  return tokens
    .map((token) => (token.startsWith('record.') ? token.slice('record.'.length) : token))
    .map((token) => token.split('.')[0])
    .filter((token) => token !== '' && token !== 'record');
};

/**
 * A expressão que RECUSA o gesto, no escopo da ação: a negação de tudo que tem de valer para ele
 * acontecer.
 *
 * O `from` entra sempre — sem ele a ação apareceria habilitada em qualquer estado, e a pessoa
 * dispararia um fluxo cuja condição a descarta em silêncio. Os invariantes `blocks` entram porque é
 * aqui que eles cabem: no gesto, antes de qualquer escrita. Um `blocks` que não chegasse à ação
 * viraria uma promessa que só a regra do campo cumpre, e a regra do campo não sabe que houve gesto.
 */
/**
 * A recusa: o estado de origem MAIS cada invariante que bloqueia, e basta uma para desabilitar.
 *
 * O "ou" vem de `anyOf`, e o `!` de `notExpression`, porque este texto é copiado verbatim para dentro
 * de um manifesto e avaliado pelo `expr-eval`. Enquanto os termos eram juntados por `' || '`, o
 * resultado não era um booleano: `||` é CONCATENAÇÃO ali, e `!(a) || !(b)` avaliava para a string
 * `"falsefalse"` — verdadeira, como toda string não-vazia, nas quatro combinações. A ação com uma
 * invariante que bloqueia nascia cinza e não havia dado que a acendesse; a ação sem nenhuma saía com
 * um termo só, sem operador, e funcionava. Ver `domain/schema/expressionSyntax.ts`.
 */
const disabledExpression = (mapped: MappedTransition, blocking: readonly BehaviorInvariant[]): string =>
  anyOf([
    notExpression(mapped.fromCheck?.expression ?? mapped.workflowCondition),
    ...blocking.map((one) => notExpression(one.expression)),
  ]);

const stateFields = (behavior: BehaviorModel | undefined, entity: string): Set<string> => {
  const state = stateOfEntity(behavior, entity);
  return new Set(state === undefined ? [] : [state.field]);
};

const fieldByKey = (entity: DomainEntity): Map<string, DomainField> =>
  new Map(entity.fields.map((one) => [one.key, one]));

const isDerived = (definition: FieldDefinition): boolean =>
  definition.aggregation !== undefined || (definition.logic?.compute ?? '').trim() !== '';

/**
 * As colunas da listagem, por regra e nesta ordem: o campo-título, o campo de estado, toda referência
 * OBRIGATÓRIA (sem ela o registro não tem contexto: um lançamento sem o cliente é uma linha anônima) e
 * o que o modelo pediu explicitamente com `showInList`.
 *
 * O derivado NÃO entra por padrão, e a ausência é a regra: um total é lido no detalhe, e pôr todo
 * total na listagem é uma decisão sobre a LISTA, não sobre o total. Quem quer um lá diz `showInList`.
 */
const listColumns = (
  screen: CatalogScreenInput,
  states: ReadonlySet<string>,
  declared: ReadonlyMap<string, DomainField>,
): PlannedListColumn[] => {
  const columns: PlannedListColumn[] = [];
  const seen = new Set<string>();
  const add = (key: string, because: string): void => {
    if (key === '' || seen.has(key)) return;
    seen.add(key);
    columns.push({ key, because });
  };

  add(screen.titleFieldKey, 'it is the title: without it every record in the list reads the same');
  for (const definition of screen.fields) {
    if (states.has(definition.key)) add(definition.key, 'it is the state field, and a list of records is read by state');
  }
  for (const definition of screen.fields) {
    if (definition.type === 'reference' && definition.required) {
      add(definition.key, `it is a required link to ${definition.refEntity ?? 'another record'}: without it the row has no context`);
    }
  }
  for (const definition of screen.fields) {
    if (declared.get(definition.key)?.showInList === true) add(definition.key, 'the model asked for it with showInList');
  }
  return columns;
};

/**
 * O que filtra: o estado, toda referência, toda lista de opções, todo sim/não — mais o que o modelo
 * pediu. Texto livre fica fora: a busca da plataforma já o cobre, e um filtro de texto ao lado dela é
 * a mesma pergunta em dois lugares.
 */
const filterableFields = (
  screen: CatalogScreenInput,
  states: ReadonlySet<string>,
  declared: ReadonlyMap<string, DomainField>,
): PlannedListColumn[] => {
  const fields: PlannedListColumn[] = [];
  const seen = new Set<string>();
  const add = (key: string, because: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    fields.push({ key, because });
  };

  for (const definition of screen.fields) {
    if (states.has(definition.key)) {
      add(definition.key, 'the state: it is the filter every list of these records gets asked for first');
      continue;
    }
    if (declared.get(definition.key)?.filterable === true) {
      add(definition.key, 'the model asked for it with filterable');
      continue;
    }
    if (FILTERABLE_TYPES.has(definition.type)) {
      add(definition.key, `a "${definition.type}" has a small set of values, which is what a filter needs`);
    }
  }
  return fields;
};

/**
 * As chaves da entidade na forma do plano — as declaradas e as que o atalho `unique` produz, na mesma
 * lista e distinguidas por `declaredBy`. Juntá-las é o ponto: quem lê o plano quer saber o que NÃO
 * pode repetir, e não por qual das duas sintaxes isso foi dito.
 */
const plannedKeys = (entity: DomainEntity): PlannedKey[] => [
  ...(entity.keys ?? []).map((key) => ({
    name: key.name,
    kind: key.kind,
    fields: [...key.fields],
    scope: key.scope ?? ('tenant' as RecordKeyScope),
    sparse: key.kind === 'primary' ? false : key.sparse !== false,
    declaredBy: 'entity.keys' as const,
    enforcedBy: ENFORCED_BY,
  })),
  ...entity.fields.filter((field) => field.unique === true).map((field) => ({
    name: `field:${field.key}`,
    kind: 'unique' as RecordKeyKind,
    fields: [field.key],
    scope: 'tenant' as RecordKeyScope,
    sparse: true,
    declaredBy: 'field.unique' as const,
    enforcedBy: ENFORCED_BY,
  })),
];

const ENFORCED_BY = 'a reservation document whose id derives from the value, written in the same batch as the record: '
  + 'creating it is the lock, so two writes at the same instant do not both pass';

const sectionsOf = (screen: CatalogScreenInput, embeds: readonly ExpandedEmbed[]): PlannedFormSection[] => {
  const byName = new Map<string, PlannedFormSection>();
  const objectOfSection = new Map(embeds.map((one) => [one.section, one.valueObject]));

  for (const definition of screen.fields) {
    const name = definition.section?.trim();
    if (!name) continue;
    const current = byName.get(name) ?? {
      name,
      fieldKeys: [],
      ...(objectOfSection.has(name) ? { fromValueObject: objectOfSection.get(name) as string } : {}),
    };
    current.fieldKeys.push(definition.key);
    byName.set(name, current);
  }
  return [...byName.values()];
};

/**
 * ONDE a ação aparece, e a única metade disso que é derivável.
 *
 * O cartão da listagem mostra um punhado de campos. Uma ação desabilitada por causa de um campo que o
 * cartão não mostra é um botão apagado sem explicação nenhuma: a pessoa vê a recusa e não vê o motivo,
 * e o único caminho que resta é abrir o registro — que é justamente onde a ação deveria estar. Então
 * quando a recusa lê um campo fora das colunas, o lugar é o cabeçalho do detalhe.
 *
 * Quando a recusa lê SÓ campos visíveis, as duas colocações são defensáveis e a diferença é de fluxo
 * de trabalho, não de legibilidade — e aí o plano devolve a escolha, em vez de sortear.
 */
const placementOf = (
  disabledWhen: string,
  columns: readonly PlannedListColumn[],
): { placement: ActionPlacement; placementBecause: string } => {
  const visible = new Set(columns.map((one) => one.key));
  const hidden = [...new Set(referencedKeys(disabledWhen))].filter((key) => !visible.has(key));

  if (hidden.length > 0) {
    return {
      placement: 'detail-header',
      placementBecause: `the refusal reads ${hidden.join(', ')}, which the list card does not show — on the card this `
        + 'would be a greyed-out button with no visible reason',
    };
  }
  return {
    placement: 'human-choice',
    placementBecause: 'the refusal reads only fields the card shows, so both placements are legible and the choice is '
      + 'about how people work here: on the card the gesture is available while browsing many records, in the detail '
      + 'header it is available to whoever is reading one',
  };
};

/**
 * O `sourceId` desta tela, pela precedência de `SCREEN_SOURCE_ID_PRECEDENCE`.
 *
 * A divergência que ele ACUSA é uma só, e é a que tem correção: o pacote declara um valor e o livro
 * registra outro para a mesma coleção desta regra. O plano fica com o REGISTRADO e diz qual é — porque
 * a correção é escrever o registrado no pacote, nunca levar o novo para o escritório.
 *
 * A diferença entre o registrado e o que a DERIVAÇÃO produziria hoje não é acusada: ela é o caso
 * normal do dia em que a derivação muda, e o silêncio ali é a regra de segurança funcionando.
 */
const resolveSourceId = (
  entity: string,
  collection: string,
  input: ScreenPlanInput,
  issues: DomainIssue[],
): { sourceId: string; sourceIdFrom: ScreenSourceIdOrigin } => {
  const registered = input.registeredSourceIds?.get(collection)?.trim() ?? '';
  const declared = input.declaredSourceIds?.get(collection)?.trim() ?? '';

  if (registered !== '') {
    if (declared !== '' && declared !== registered) {
      issues.push(make('domain.plan.screen-source-id-divergent', 'error', {
        entity,
        message: `"${collection}" is declared with sourceId "${declared}", and the ledger records `
          + `"${registered}" for this rule. The plan keeps the RECORDED one.`,
        suggestion: `Write "${registered}" in the package and leave it there. A sourceId that changes between two `
          + 'versions of the same package does not fail anywhere: the update installs a SECOND screen beside the '
          + 'first, the records stay in the old collection with no screen over them, and nothing says so.',
        howToDeclareException: 'None. If the recorded value is genuinely wrong, the screen it names has to be dealt '
          + 'with in the offices that already have it — that is a migration, not a new identity.',
      }));
    }
    return { sourceId: registered, sourceIdFrom: 'ledger' };
  }
  if (declared !== '') return { sourceId: declared, sourceIdFrom: 'declared' };

  const derived = deriveScreenSourceId(input.sourceIdNamespace, collection);
  if (derived === '') {
    issues.push(make('domain.plan.screen-source-id-missing', 'error', {
      entity,
      message: `"${collection || entity}" is planned with no universal identity: the namespace `
        + `("${input.sourceIdNamespace}") or the collection is empty, so nothing can be derived.`,
      suggestion: 'The namespace is the extensionId of the model (or its target, when there is no package). Give the '
        + 'model one, or declare the sourceId on the screen — without it the next version installs a second screen '
        + 'instead of updating this one.',
      howToDeclareException: 'None. There is no reading of "this screen has no identity" that survives an update.',
    }));
  }
  return { sourceId: derived, sourceIdFrom: 'derived' };
};

export interface ScreenPlanInput {
  /** O modelo EXPANDIDO — os `embedded` já achatados. */
  model: DomainModel;
  /**
   * O espaço de nomes do `sourceId`: o id da extensão que instala, e o `target` quando não há pacote
   * nenhum (as telas do próprio escritório, que não viajam).
   */
  sourceIdNamespace: string;
  /** O `sourceId` que o `plugin.ts` — ou o retrato da instalação — já declara, por coleção. */
  declaredSourceIds?: ReadonlyMap<string, string>;
  /** O que o livro de rastreabilidade registra para ESTA regra, por coleção. Precede tudo. */
  registeredSourceIds?: ReadonlyMap<string, string>;
  /** As telas que o plano propõe, com os campos já traduzidos. */
  screenInputs: readonly CatalogScreenInput[];
  /** As transições já traduzidas. Definição única: nada as reinterpreta aqui. */
  transitions: readonly MappedTransition[];
  embeds: readonly ExpandedEmbed[];
}

export const buildScreenPlan = (input: ScreenPlanInput): ScreenPlan => {
  const { model, screenInputs, transitions, embeds } = input;
  const issues: DomainIssue[] = [];
  const screens: ScreenLayout[] = [];
  const notScreens: NotAScreen[] = [];

  const byCollection = new Map(screenInputs.map((one) => [one.collection?.trim() || one.key, one]));
  const invariants = model.behavior?.invariants ?? [];

  for (const entity of model.entities) {
    if (entity.kind === 'lookup') {
      notScreens.push({
        entity: entity.name,
        kind: entity.kind,
        becomes: `the option list "${collectionOfEntity(entity)}"`,
        because: 'a list of options is vocabulary — key and label. A screen for it would mean records, a menu entry and '
          + 'four permissions over something the office edits in one field of the Form Design',
      });
      continue;
    }
    // O objeto de valor já não está aqui: `expandEmbedded` o dissolveu nas folhas antes de este plano
    // rodar, e os que ele produziu saem mais abaixo, dos ACHATAMENTOS. Esta linha é o que faz o
    // compilador saber disso junto com quem lê.
    if (entity.kind !== 'entity' && entity.kind !== 'child') continue;

    const collection = collectionOfEntity(entity);
    const screen = byCollection.get(collection);
    if (screen === undefined) continue;

    const states = stateFields(model.behavior, entity.name);
    const declared = fieldByKey(entity);
    const columns = listColumns(screen, states, declared);

    if (columns.length > SCREEN_LIST_COLUMN_BUDGET) {
      issues.push(make('domain.plan.list-columns-over-budget', 'info', {
        entity: entity.name,
        message: `${columns.length} fields of "${collection}" qualify for the list, and a row — on a phone too — holds `
          + `about ${SCREEN_LIST_COLUMN_BUDGET}: ${columns.map((one) => one.key).join(', ')}.`,
        suggestion: 'Decide which ones stay. The plan does not cut for you, because cutting silently hides a field '
          + 'somebody put there on purpose, and nothing on the screen would say it was dropped.',
        howToDeclareException: 'None needed — this is information. Keeping all of them is a legitimate answer for a '
          + 'list people read on a wide screen.',
      }));
    }

    const mine = transitions.filter((one) =>
      one.transition.entity === entity.name && one.actionKey !== undefined && one.supported);

    const actions: PlannedRecordAction[] = mine.map((mapped) => {
      const blocking = invariants.filter((one) =>
        one.scope === 'transition'
        && one.transition === mapped.transition.name
        && one.enforcement === 'blocks');
      const disabledWhen = disabledExpression(mapped, blocking);
      return {
        key: mapped.actionKey as string,
        transition: mapped.transition.name,
        ...(mapped.transition.description === undefined ? {} : { description: mapped.transition.description }),
        eventName: mapped.eventName,
        ...(mapped.fromCheck?.requiresParameter === undefined
          ? {}
          : { requiresParameter: mapped.fromCheck.requiresParameter }),
        workflowCondition: mapped.workflowCondition,
        disabledWhen,
        ...(mapped.permission === undefined
          ? {}
          : { hiddenWhen: notTerm(`hasPermission("${mapped.permission}")`) }),
        ...placementOf(disabledWhen, columns),
      };
    });

    const parent = screen.parentEntity && screen.parentFieldKey
      ? {
        collection: screen.parentEntity,
        fieldKey: screen.parentFieldKey,
        relation: (screen.parentRelation ?? 'owned') as 'owned' | 'related',
      }
      : undefined;

    const humanDecisions = actions
      .filter((one) => one.placement === 'human-choice')
      .map((one) => `where the "${one.key}" action appears: the list card, the detail header, or both`);

    screens.push({
      entity: entity.name,
      kind: entity.kind,
      collection,
      ...resolveSourceId(entity.name, collection, input, issues),
      // O filho é aba do pai, e a regra não tem exceção: uma entrada de menu para ele daria duas
      // portas para o mesmo dado, e a de cima não tem o pai para dizer de quem o registro é.
      presence: entity.kind === 'child' ? 'tab-of-parent' : 'menu-and-detail',
      titleFieldKey: screen.titleFieldKey,
      ...(parent === undefined ? {} : { parent }),
      listColumns: columns,
      filterableFields: filterableFields(screen, states, declared),
      sections: sectionsOf(screen, embeds.filter((one) => one.entity === entity.name)),
      readOnlyFields: screen.fields.filter(isDerived).map((definition) => ({
        key: definition.key,
        because: definition.aggregation === undefined
          ? 'it is computed from the record, and the form disables any field carrying logic.compute'
          : 'it is aggregated from children, and the kernel recomputes it on every child write',
      })),
      referenceFields: screen.fields
        .filter((definition) => definition.type === 'reference')
        .map((definition) => ({
          key: definition.key,
          points: definition.refEntity ?? '',
          multi: definition.multi === true,
          labelResolvedBy: 'the platform, when the record is drawn. Never a second field holding the label: a copied '
            + 'label drifts the day the pointed record is renamed, and nothing on screen says which of the two is right',
        })),
      actions,
      tabs: (entity.tabs ?? []).map((one) => ({ kind: one.kind, because: one.because })),
      keys: plannedKeys(entity),
      humanDecisions,
    });
  }

  // Os objetos de valor. Eles vêm dos ACHATAMENTOS, e não das entidades do modelo, porque a esta
  // altura eles já desapareceram: `expandEmbedded` os dissolve nas folhas antes de qualquer coisa aqui
  // rodar. Eles nunca foram entidades — é o que a estratégia de achatamento diz —, e é justamente por
  // isso que o plano precisa DIZER no que eles se transformaram: quem lê o plano procura pelo nome que
  // escreveu no modelo.
  for (const object of [...new Set(embeds.map((one) => one.valueObject))]) {
    const where = embeds.filter((one) => one.valueObject === object);
    notScreens.push({
      entity: object,
      kind: 'valueObject',
      becomes: `a section of the form of ${where.map((one) => `${one.entity} ("${one.section}")`).join(', ')}`,
      because: 'it has no identity of its own: nobody searches for an address, they search for whoever lives there. '
        + 'The leaves are stored flat on the owner so that compute, validate and the list filter can still reach them',
    });
  }

  // A relação one-to-many que NÃO é filha não rende nada, e dizer isso é parte do plano: a alternativa
  // — uma aba de relacionados por reflexo — enche o detalhe de listas que ninguém pediu.
  for (const raw of model.relationships) {
    const relationship = canonicalRelationship(raw);
    if (relationship.storage !== 'reference') continue;
    if (!model.entities.some((one) => one.name === relationship.targetEntity && one.kind !== 'lookup')) continue;
    notScreens.push({
      entity: `${relationship.targetEntity} <- ${relationship.sourceEntity}.${relationship.sourceField}`,
      kind: 'one-to-many seen from the "one" side',
      becomes: 'nothing',
      because: `nothing is planned on "${relationship.targetEntity}" for the records that point at it. A tab of related `
        + 'records is a decision the rule has to ask for, and it is declared as storage "child" with ownership '
        + '"association" — a tab per incoming reference would fill the detail with lists nobody asked for',
    });
  }

  // Duas telas do MESMO plano com o mesmo id universal. Na instalação a segunda encontra a primeira
  // pela deduplicação por `sourceId`, reusa a chave dela e sobrescreve o que ela declarava — uma das
  // duas telas simplesmente não existe, e o pacote instala sem reclamar de nada.
  const byId = new Map<string, string[]>();
  for (const screen of screens.filter((one) => one.sourceId !== '')) {
    byId.set(screen.sourceId, [...(byId.get(screen.sourceId) ?? []), screen.collection]);
  }
  for (const [sourceId, collections] of byId) {
    if (collections.length < 2) continue;
    issues.push(make('domain.plan.screen-source-id-duplicate', 'error', {
      message: `${collections.length} screens of this plan carry the same sourceId "${sourceId}": `
        + `${collections.join(', ')}.`,
      suggestion: 'The identity is universal, so the installation reads them as ONE screen: the second reuses the key '
        + 'of the first and overwrites what it declared. Give each screen its own — the derivation does, so a '
        + 'duplicate here came from a declaration copied between two screens or from a ledger entry that names one '
        + 'sourceId for two collections.',
      howToDeclareException: 'None. Two screens sharing an identity means one of them does not exist.',
    }));
  }

  return {
    screens,
    notScreens,
    humanDecisions: [...SCREEN_PLAN_HUMAN_DECISIONS, ...screens.flatMap((one) => one.humanDecisions)],
    issues,
  };
};
