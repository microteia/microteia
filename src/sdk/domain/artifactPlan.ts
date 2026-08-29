import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { RecordKeyKind, RecordKeySpec } from '../../domain/schema/recordKeys';
import type { BusinessRule } from './businessRule';
import { checkBusinessRule } from './businessRule';
import type { CatalogEntity, CatalogException, CatalogScreenInput, DomainCatalog, ParentRelation } from './catalog';
import { buildDomainCatalog, catalogEntity, collectionOfScreen, declaredScreenSourceIds, exceptionKey } from './catalog';
import type { DomainEntity, DomainIssue, DomainModel } from './domainModel';
import { hasBlockingIssue, sortIssues } from './domainModel';
import type { DomainIssueCode } from './detectors';
import type { ScreenPlan } from './screenPlan';
import { buildScreenPlan } from './screenPlan';

/**
 * As chaves da entidade, declaradas e açucaradas, na mesma lista. O plano fala de RESTRIÇÃO, não da
 * sintaxe que a escreveu — quem lê quer saber o que não pode repetir.
 */
const screenKeysOf = (entity: DomainEntity): RecordKeySpec[] => [
  ...(entity.keys ?? []).map((key) => ({ ...key })),
  ...entity.fields
    .filter((field) => field.unique === true)
    .map((field) => ({ name: `field:${field.key}`, kind: 'unique' as RecordKeyKind, fields: [field.key] })),
];
import { relationshipSummary } from './storageMapping';
import type { RuleDelta, RuleLedger, RuleLedgerEntry } from './traceability';
import {
  RULE_LEDGER_FILE,
  ledgerEntryOf,
  ledgerFindings,
  registeredScreenSourceIds,
  ruleDelta,
  ruleLedgerEntry,
} from './traceability';
import { collectionOfEntity, collectionResolver, modelExceptions, modelScreenInputs, originFor } from './toPlatform';
import { validateDomainModel } from './validateDomainModel';

/**
 * O PLANO DE ARTEFATOS — o que deve existir, e onde. Nunca arquivos.
 *
 * Duas coisas o definem, e as duas são recusas:
 *
 * - **Ele não gera.** Quem escreve o `plugin.ts` é o agente; o que ele recebe daqui é a lista do que
 *   tem de existir, com a relação já resolvida. Um gerador que reinterpretasse o relacionamento
 *   traria de volta exatamente o problema que o modelo existe para resolver — duas leituras da mesma
 *   frase, divergindo em silêncio.
 * - **Ele é um DIFF, não uma criação.** O escritório já tem coleções, e um plano que as ignorasse
 *   proporia recriar o que existe. Chave e tipo de campo são imutáveis, tela com registro não se
 *   apaga por plano, e mudança de formato de dado gravado pede migração declarada. Quando a operação
 *   é impossível, o plano DIZ que é — contorná-la seria escolher pelo escritório.
 */

export type PlanOperation = 'create' | 'update' | 'unchanged' | 'blocked';

export interface PlannedField {
  operation: PlanOperation;
  key: string;
  label: string;
  type: FieldDefinition['type'];
  required: boolean;
  multi: boolean;
  refEntity?: string;
  lookupCollection?: string;
  aggregation?: { from: string; via: string; op: string; field?: string };
  computeExpression?: string;
  section?: string;
  /** Por que a operação é o que é, quando não é óbvio. */
  reason?: string;
}

export interface PlannedScreen {
  operation: PlanOperation;
  entity: string;
  kind: 'entity' | 'child';
  collection: string;
  titleFieldKey: string;
  parent?: { collection: string; fieldKey: string; relation: ParentRelation };
  ownerPluginId?: string;
  fields: PlannedField[];
  /**
   * As chaves que esta tela passa a ter, e as que ela já tinha.
   *
   * Uma chave NOVA sobre uma coleção que já tem registros não vale no dia em que é instalada: ela
   * nasce `pending`, alguém varre o que está gravado, e só então passa a valer. Está no plano porque
   * é o único jeito de quem lê saber que aquela varredura existe — uma chave que "já vale" e encontra
   * duas duplicatas antigas travaria a gravação seguinte por um motivo que ninguém mostrou.
   */
  keys: PlannedScreenKey[];
  /** Campos que existem lá e que este modelo não descreve. O plano NUNCA os remove. */
  retainedFields: string[];
  /** Chaves que existem lá e que este modelo não descreve. O plano NUNCA as remove. */
  retainedKeys: string[];
}

export interface PlannedScreenKey {
  operation: PlanOperation;
  name: string;
  kind: RecordKeyKind;
  fields: string[];
  /**
   * A chave nova sobre uma coleção que PODE ter registros nasce pendente. O plano não vê registro
   * nenhum — então ele não afirma que a coleção está vazia: ele diz que a varredura é parte de
   * instalar a chave.
   */
  adoption: 'immediate' | 'sweep-existing-records';
}

export interface PlannedLookup {
  operation: PlanOperation;
  collection: string;
  label: string;
  /** As telas do plano que a consomem. */
  usedBy: string[];
  /**
   * As opções SEMENTE, quando esta lista serve um campo de ESTADO.
   *
   * É o único artefato que o comportamento produz sozinho, e ele produz porque é o único lugar onde
   * a chave de um estado pode morar num pacote: `LookupModuleTemplate.options` é gravada apenas
   * quando a coleção está vazia, e a partir daí as opções são dado do escritório. Sem elas, uma
   * máquina de estados instalada não tem nenhum estado para escolher — o escritório digitaria as
   * opções à mão, e a primeira chave digitada diferente pararia toda transição em silêncio.
   */
  options?: { key: string; label: string }[];
}

export interface PlannedMigration {
  collection: string;
  field: string;
  /** O que mudou no formato do que já está gravado. */
  change: string;
}

/**
 * O que a regra criou e não precisa mais. DESATIVAR, nunca excluir — e a diferença não é cautela.
 *
 * Excluir uma tela é decidir o que acontece com os registros que estão nela, e este plano não vê
 * registro nenhum: ele lê declarações de pacote e, quando há, um retrato do escritório. Desativar é
 * reversível, tira a tela do caminho de todo mundo e deixa o dado onde está — e quem olha os registros
 * decide o resto. É a mesma postura de `domain.plan.removal-soft-block`, agora com o motivo vindo da
 * regra em vez do modelo.
 */
export interface PlannedDeactivation {
  kind: 'screen' | 'list' | 'action';
  target: string;
  because: string;
  howTo: string;
}

/**
 * A integridade do livro, agora que ele é a fonte da identidade das telas. Ela vem POR FORA dos
 * problemas também, e não só como um `DomainIssue`: um livro que escorregou não tem sintoma na tela
 * de hoje, e quem lê a resposta da tool precisa esbarrar nisso sem procurar.
 */
export interface LedgerIntegrity {
  /** O arquivo em que o livro mora. */
  file: string;
  /** O que não fecha, uma frase cada. Vazio = o livro e a realidade dizem a mesma coisa. */
  findings: string[];
}

/** A leva desta regra, e o que ela mudou em relação à anterior. */
export interface PlanTrace {
  /** O arquivo de trabalho onde o vínculo mora. Ver `traceability.ts` para o porquê de ser aqui. */
  file: string;
  entry: RuleLedgerEntry;
  delta: RuleDelta;
}

export interface ArtifactPlanOptions {
  /**
   * A regra que originou o modelo. Presente, o plano vira a leva DELA: as checagens regra↔modelo
   * entram nos problemas e o vínculo é montado para gravação.
   */
  rule?: BusinessRule;
  /** O livro de rastreabilidade lido do workspace. Ausente = nunca houve leva anterior. */
  ledger?: RuleLedger;
}

export interface ArtifactPlan {
  ok: boolean;
  target: DomainModel['target'];
  extensionId?: string;
  /** A leitura de negócio dos relacionamentos: "Customer 1:N Sale". */
  relationships: string[];
  screens: PlannedScreen[];
  /**
   * O que a pessoa VÊ, decidido por regra: colunas, filtros, seções, somente-leitura, e uma ação de
   * registro por transição de gesto. Ver `screenPlan.ts`.
   */
  screenPlan: ScreenPlan;
  lookups: PlannedLookup[];
  /** O que a regra criou antes e não pede mais. O plano propõe desativar; nunca excluir. */
  deactivations: PlannedDeactivation[];
  /** O vínculo regra -> artefatos, quando o plano foi pedido com uma regra. */
  trace: PlanTrace | null;
  /**
   * O que não fecha entre o livro de rastreabilidade e o que existe. `null` quando não havia leva
   * anterior desta regra para conferir contra. Ver `ledgerFindings`.
   */
  ledgerIntegrity: LedgerIntegrity | null;
  migrationsRequired: PlannedMigration[];
  /** Presente quando o plano muda uma extensão — a versão dela e o VERSIONS.md andam junto. */
  versionBump: { extensionId: string; because: string[] } | null;
  issues: DomainIssue[];
  /** As telas exatamente como o plano as propõe. É o que `applyPlanToCatalog` aplica. */
  screenInputs: CatalogScreenInput[];
  /**
   * As duplicações que este modelo declarou. Viajam com o plano porque `source` e `reason` não têm
   * onde morar num `FieldDefinition`: sem isto, o snapshot vira um campo comum e a sessão seguinte
   * torna a acusá-lo — a exceção declarada custaria uma aprovação por sessão, para sempre.
   */
  declaredExceptions: CatalogException[];
}

const make = (code: DomainIssueCode, severity: DomainIssue['severity'], draft: Omit<DomainIssue, 'code' | 'severity'>): DomainIssue => ({
  code,
  severity,
  ...draft,
});

const sameAggregation = (a: PlannedField['aggregation'], b: PlannedField['aggregation']): boolean => {
  if (a === undefined || b === undefined) return a === b;
  return a.from === b.from && a.via === b.via && a.op === b.op && (a.field ?? null) === (b.field ?? null);
};

const toPlannedField = (definition: FieldDefinition): Omit<PlannedField, 'operation' | 'reason'> => ({
  key: definition.key,
  label: definition.label,
  type: definition.type,
  required: definition.required === true,
  multi: definition.multi === true,
  ...(definition.refEntity ? { refEntity: definition.refEntity } : {}),
  ...(definition.lookupCollection ? { lookupCollection: definition.lookupCollection } : {}),
  ...(definition.aggregation
    ? {
      aggregation: {
        from: definition.aggregation.from,
        via: definition.aggregation.via,
        op: definition.aggregation.op as string,
        ...(definition.aggregation.field ? { field: definition.aggregation.field } : {}),
      },
    }
    : {}),
  ...(definition.logic?.compute?.trim() ? { computeExpression: definition.logic.compute.trim() } : {}),
  ...(definition.section ? { section: definition.section } : {}),
});

/**
 * A reconciliação de UM campo. As duas travas duras estão aqui: `type` não muda depois de criado, e o
 * que muda o FORMATO do que já está gravado — um escalar virando lista — não é uma alteração de
 * declaração, é uma conversão de dado, e conversão de dado se declara em `package.migrations`.
 */
const reconcileField = (
  planned: Omit<PlannedField, 'operation' | 'reason'>,
  existing: CatalogEntity | undefined,
  collection: string,
  entityName: string,
  issues: DomainIssue[],
  migrations: PlannedMigration[],
): PlannedField => {
  const current = existing?.fields.find((one) => one.key === planned.key);
  if (current === undefined) return { ...planned, operation: 'create' };

  if (current.type !== planned.type) {
    issues.push(make('domain.plan.field-type-immutable', 'error', {
      entity: entityName,
      field: planned.key,
      message: `"${collection}.${planned.key}" already exists as "${current.type}" and the model declares it as "${planned.type}". `
        + 'A field type is immutable after creation — records are already stored in the old shape.',
      suggestion: `Keep the existing type, or declare a NEW field with another key and leave "${planned.key}" alone. `
        + 'If the data really has to convert, that is a migration plus a new field, never a retype in place.',
      howToDeclareException: 'None. The platform refuses the retype in the Form Design too, and for the same reason.',
    }));
    return { ...planned, operation: 'blocked', reason: `type is immutable: stored as "${current.type}"` };
  }

  if (current.multi !== planned.multi) {
    migrations.push({
      collection,
      field: planned.key,
      change: planned.multi
        ? 'a single value becomes a list: every stored value has to be wrapped in an array'
        : 'a list becomes a single value: every stored array has to be collapsed',
    });
    issues.push(make('domain.plan.migration-required', 'error', {
      entity: entityName,
      field: planned.key,
      message: `"${collection}.${planned.key}" changes between single and multiple, which changes the shape of data already written `
        + `(${current.multi ? 'an array' : 'a string'} becomes ${planned.multi ? 'an array' : 'a string'}).`,
      suggestion: 'Declare a `migration` in the package: an id, a version, and a script that converts what the earlier version wrote. '
        + 'It runs once per organization, in the sandbox, and it must read the collection name from `input.collections` rather than hard-coding it.',
      howToDeclareException: 'If no organization has this extension installed yet, there is nothing to convert — say so and change the declaration. '
        + 'The check cannot know that from here, which is why it asks.',
    }));
    return { ...planned, operation: 'blocked', reason: 'changes the shape of data already written' };
  }

  const differs = current.required !== planned.required
    || (current.refEntity ?? undefined) !== planned.refEntity
    || (current.lookupCollection ?? undefined) !== planned.lookupCollection
    || !sameAggregation(current.aggregation, planned.aggregation)
    || (current.computeExpression ?? undefined) !== planned.computeExpression;

  return differs
    ? { ...planned, operation: 'update', reason: 'the declaration differs from what is installed' }
    : { ...planned, operation: 'unchanged' };
};

const sameParent = (
  planned: PlannedScreen['parent'],
  existing: CatalogEntity['parent'],
): boolean => {
  if (planned === undefined || existing === undefined) return planned === existing;
  return planned.collection === existing.collection
    && planned.fieldKey === existing.fieldKey
    && planned.relation === existing.relation;
};

/**
 * O plano. Passa pelo validador primeiro, sempre: um modelo com ERRO não vira plano — é a mesma
 * postura de `validate_plugin`, que não deixa um pacote inválido chegar à instalação.
 */
export const buildArtifactPlan = (
  model: DomainModel,
  catalog: DomainCatalog,
  options: ArtifactPlanOptions = {},
): ArtifactPlan => {
  const validation = validateDomainModel(model, catalog);
  const working = validation.expanded.model;
  const ruleIssues = options.rule === undefined ? [] : checkBusinessRule(options.rule, working);

  if (!validation.ok) {
    return {
      ok: false,
      target: working.target,
      ...(working.extensionId === undefined ? {} : { extensionId: working.extensionId }),
      relationships: working.relationships.map(relationshipSummary),
      screens: [],
      screenPlan: { screens: [], notScreens: [], humanDecisions: [], issues: [] },
      lookups: [],
      deactivations: [],
      trace: null,
      ledgerIntegrity: null,
      migrationsRequired: [],
      versionBump: null,
      issues: sortIssues([
        make('domain.plan.blocked-by-model', 'error', {
          message: `The model does not pass validation (${validation.issues.filter((one) => one.severity === 'error').length} blocking problem(s)), so there is no artifact plan. `
            + 'Modelling comes before generation; a plan built on a broken model would generate the defect faithfully.',
          suggestion: 'Fix the blocking problems below and ask again.',
          howToDeclareException: 'None. This is the gate.',
        }),
        ...validation.issues,
        ...ruleIssues,
      ]),
      screenInputs: [],
      declaredExceptions: [],
    };
  }

  const issues: DomainIssue[] = [...validation.issues.filter((one) => one.severity !== 'error'), ...ruleIssues];
  const migrations: PlannedMigration[] = [];
  const existingCollections = new Set(catalog.entities.map((one) => one.collection));
  const resolve = collectionResolver(working, existingCollections);
  const screenInputs = modelScreenInputs(working, resolve);
  const origin = originFor(working);

  const screens: PlannedScreen[] = [];
  for (const entity of working.entities) {
    if (entity.kind !== 'entity' && entity.kind !== 'child') continue;
    const collection = collectionOfEntity(entity);
    const input = screenInputs.find((one) => one.key === collection) as CatalogScreenInput;
    const existing = catalogEntity(catalog, collection);

    if (existing?.ownerPluginId && working.extensionId && existing.ownerPluginId !== working.extensionId) {
      issues.push(make('domain.plan.collection-owned-elsewhere', 'warning', {
        entity: entity.name,
        message: `"${collection}" is owned by "${existing.ownerPluginId}". Your extension can ADD fields to it, and owns only the fields it adds.`,
        suggestion: 'Write it as a `screenPatch` rather than a `screen`: the target screen, its title, its icon and its configuration stay with its owner, '
          + 'and uninstalling yours removes only your fields.',
        howToDeclareException: 'None. The structure of somebody else\'s screen is theirs; there is no declaration that takes it over.',
      }));
    }

    const parent = input.parentEntity && input.parentFieldKey
      ? { collection: input.parentEntity, fieldKey: input.parentFieldKey, relation: (input.parentRelation ?? 'owned') as ParentRelation }
      : undefined;

    const fields = input.fields.map((definition) => reconcileField(
      toPlannedField(definition),
      existing,
      collection,
      entity.name,
      issues,
      migrations,
    ));

    const declaredKeys = new Set(fields.map((one) => one.key));
    const retainedFields = (existing?.fields ?? []).map((one) => one.key).filter((key) => !declaredKeys.has(key));
    if (retainedFields.length > 0) {
      issues.push(make('domain.plan.removal-soft-block', 'warning', {
        entity: entity.name,
        message: `"${collection}" has ${retainedFields.length} field(s) this model does not describe: ${retainedFields.join(', ')}. The plan keeps them.`,
        suggestion: 'Removing a field, or a whole screen, means deciding what happens to the records that hold values in it — and this plan cannot see the records. '
          + 'If they really should go, do it in the Form Design, where the platform can tell you what is there.',
        howToDeclareException: 'Fields the organization added to your screen are theirs and are preserved on every update. That is by design, not an oversight.',
      }));
    }

    const existingKeyNames = new Set((existing?.keys ?? []).map((one) => one.name));
    const plannedScreenKeys: PlannedScreenKey[] = screenKeysOf(entity).map((key) => ({
      operation: existingKeyNames.has(key.name) ? 'unchanged' : 'create',
      name: key.name,
      kind: key.kind,
      fields: [...key.fields],
      // Só a tela que NASCE agora pode garantir que não há o que varrer. Sobre uma coleção que já
      // existia, a única resposta honesta é que alguém tem de olhar o que está gravado.
      adoption: existing === undefined ? 'immediate' : 'sweep-existing-records',
    }));
    const declaredKeyNames = new Set(plannedScreenKeys.map((one) => one.name));
    const retainedKeys = [...existingKeyNames].filter((name) => !declaredKeyNames.has(name));

    const changed = fields.some((one) => one.operation !== 'unchanged')
      || plannedScreenKeys.some((one) => one.operation !== 'unchanged')
      || (existing !== undefined && (!sameParent(parent, existing.parent) || existing.titleFieldKey !== input.titleFieldKey));

    screens.push({
      operation: existing === undefined ? 'create' : changed ? 'update' : 'unchanged',
      entity: entity.name,
      kind: entity.kind,
      collection,
      titleFieldKey: input.titleFieldKey,
      ...(parent === undefined ? {} : { parent }),
      ...(working.extensionId === undefined ? {} : { ownerPluginId: working.extensionId }),
      fields,
      keys: plannedScreenKeys,
      retainedFields,
      retainedKeys,
    });
  }

  // As listas de opções: as entidades `kind: 'lookup'` do modelo mais toda coleção que um campo
  // `select` aponta. Declarar a lista é o que faz a regra do Firestore aceitar escrita nela.
  const lookupCollections = new Map<string, { label: string; usedBy: string[] }>();
  for (const entity of working.entities.filter((one) => one.kind === 'lookup')) {
    lookupCollections.set(collectionOfEntity(entity), { label: entity.name, usedBy: [] });
  }
  for (const entity of working.entities) {
    for (const field of entity.fields) {
      if (!field.lookup) continue;
      const current = lookupCollections.get(field.lookup) ?? { label: field.lookup, usedBy: [] };
      current.usedBy.push(`${entity.name}.${field.key}`);
      lookupCollections.set(field.lookup, current);
    }
  }
  const existingLookups = new Set(catalog.lookups.map((one) => one.collection));
  // As opções de estado, pela lista que as serve. A tradução está em `PlannedLookup.options`.
  const stateOptions = new Map((working.behavior?.states ?? [])
    .filter((state) => state.lookup !== undefined && state.options.length > 0)
    .map((state) => [state.lookup as string, state.options.map((one) => ({ key: one.key, label: one.label }))]));
  const lookups: PlannedLookup[] = [...lookupCollections.entries()].map(([collection, one]) => ({
    operation: existingLookups.has(collection) ? 'unchanged' : 'create',
    collection,
    label: one.label,
    usedBy: one.usedBy,
    ...(stateOptions.has(collection) ? { options: stateOptions.get(collection) } : {}),
  }));

  // O PLANO DE TELAS. Roda depois das telas e das listas porque ele decide sobre o que já foi
  // resolvido — colunas sobre os campos traduzidos, ações sobre as transições já mapeadas. Duas
  // leituras da mesma frase é o que este subsistema existe para não ter.
  //
  // A IDENTIDADE das telas entra aqui, e a ordem das três fontes é a regra de segurança: o que o livro
  // registrou vem primeiro, o que o pacote já declara vem depois, e só o que é NOVO é derivado. Ver
  // `SCREEN_SOURCE_ID_PRECEDENCE`.
  const previousEntry = options.rule === undefined ? undefined : ledgerEntryOf(options.ledger, options.rule.id);
  const screenPlan = buildScreenPlan({
    model: working,
    screenInputs,
    transitions: validation.transitions,
    embeds: validation.expanded.embeds,
    // Sem extensão não há pacote, e a tela do próprio escritório não viaja: o alvo é o espaço de nomes
    // dela, e ele basta porque a coleção é única dentro de um escritório.
    sourceIdNamespace: working.extensionId ?? working.target,
    // O catálogo inteiro, e vale dizer o que ele ainda não tem: o retrato da instalação não exporta
    // `sourceId`, então uma tela que exista SÓ no escritório (Form Design, ou outra extensão) cai na
    // derivação. Adotá-la exigiria a identidade DELA, que só a instalação conhece — e o dia em que o
    // retrato a carregar, ela entra por aqui sem mudar mais nada.
    declaredSourceIds: declaredScreenSourceIds(catalog.screens),
    registeredSourceIds: registeredScreenSourceIds(previousEntry),
  });
  issues.push(...screenPlan.issues);

  const sourceIdByCollection = new Map(screenPlan.screens.map((one) => [one.collection, one.sourceId]));

  // A tela planejada que não chegou ao plano de telas ficaria sem identidade nenhuma, e a instalação
  // seguinte a trataria como uma tela nova. Não há caminho conhecido que produza isso — as duas listas
  // saem das mesmas entidades —, e é justamente por isso que a conferência é aqui: o dia em que uma
  // delas passar a filtrar algo que a outra não filtra, isto reprova em vez de instalar uma segunda tela.
  for (const screen of screens) {
    if ((sourceIdByCollection.get(screen.collection) ?? '') !== '') continue;
    issues.push(make('domain.plan.screen-source-id-missing', 'error', {
      entity: screen.entity,
      message: `The plan proposes "${screen.collection}" and no universal identity for it.`,
      suggestion: 'Every planned screen carries a sourceId — it is what makes the next version of the package UPDATE '
        + 'this screen instead of installing a second one beside it.',
      howToDeclareException: 'None. This is the plan disagreeing with itself.',
    }));
  }

  // A RASTREABILIDADE e o único caso novo de reconciliação: a regra mudou, e uma tela que ela criou
  // não é mais necessária.
  const deactivations: PlannedDeactivation[] = [];
  let trace: PlanTrace | null = null;

  let ledgerIntegrity: LedgerIntegrity | null = null;

  if (options.rule !== undefined) {
    const entry = ruleLedgerEntry(
      options.rule,
      {
        screens: screens.map((one) => one.collection),
        lists: lookups.map((one) => one.collection),
        actions: screenPlan.screens.flatMap((one) => one.actions.map((action) => action.key)),
        transitions: validation.transitions.filter((one) => one.supported).map((one) => one.transition.name),
        permissions: validation.transitions.flatMap((one) => (one.permission === undefined ? [] : [one.permission])),
      },
      Object.fromEntries(sourceIdByCollection),
    );
    const delta = ruleDelta(previousEntry, entry);
    trace = { file: RULE_LEDGER_FILE, entry, delta };

    const findings = ledgerFindings(previousEntry, {
      producedScreensAlreadyThere: screens.filter((one) => one.operation !== 'create').map((one) => one.collection),
      knownScreens: [...new Set([...catalog.screens.map(collectionOfScreen), ...screens.map((one) => one.collection)])],
      producedListsAlreadyThere: lookups.filter((one) => one.operation !== 'create').map((one) => one.collection),
      knownLists: [...new Set([...catalog.lookups.map((one) => one.collection), ...lookups.map((one) => one.collection)])],
    });
    if (previousEntry !== undefined) ledgerIntegrity = { file: RULE_LEDGER_FILE, findings };
    if (findings.length > 0) {
      issues.push(make('domain.plan.ledger-out-of-step', 'warning', {
        message: `The ${RULE_LEDGER_FILE} of this rule does not agree with what exists here: ${findings.join('; ')}.`,
        suggestion: `Write \`trace.contents\` to ${RULE_LEDGER_FILE} — it is this leva with the identities in it. The `
          + 'book is written by hand, and it stopped being only a record of provenance the day it became the source of '
          + 'the screen identity: a line that slipped costs nothing today and installs a SECOND screen on the next '
          + 'pass, in every office at once.',
        howToDeclareException: 'A screen the book names and nobody has any more is legitimate if it was deleted in the '
          + 'Form Design. Take the line out of the book on purpose — leaving it there means the next pass keeps '
          + 'reserving an identity for something that does not exist.',
      }));
    }

    for (const collection of delta.dropped.screens) {
      deactivations.push({
        kind: 'screen',
        target: collection,
        because: `"${options.rule.id}" created "${collection}" and the rule as it reads now does not need it.`,
        howTo: 'Declare the screen with `enabled: false` and `hideFromSidebar: true`, and keep it in the package. '
          + 'Removing the declaration is not the same thing: the collection and its documents stay in the '
          + 'organization either way, and a screen that is gone from the package is a screen nobody can turn back on.',
      });
    }
    for (const collection of delta.dropped.lists) {
      deactivations.push({
        kind: 'list',
        target: collection,
        because: `"${options.rule.id}" created the list "${collection}" and the rule as it reads now does not use it.`,
        howTo: 'Leave the declaration where it is. A list the office already edited is the office\'s data, and dropping '
          + 'the declaration does not delete it — it only stops anything from referring to it, which is what you '
          + 'wanted anyway.',
      });
    }
    for (const key of delta.dropped.actions) {
      deactivations.push({
        kind: 'action',
        target: key,
        because: `"${options.rule.id}" asked for the "${key}" gesture and the rule as it reads now does not.`,
        howTo: 'Declare the action with `enabled: false`, or take it out of the screen\'s cardActionIds / '
          + 'viewActionIds. The second keeps the automation callable from elsewhere; the first stops it entirely.',
      });
    }

    if (deactivations.length > 0) {
      issues.push(make('domain.plan.deactivate-proposed', 'warning', {
        message: `The rule "${options.rule.id}" no longer needs ${deactivations.length} thing(s) it created: `
          + `${deactivations.map((one) => `${one.kind} "${one.target}"`).join(', ')}. The plan proposes DISABLING them.`,
        suggestion: 'Disable, never delete. Deleting a screen means deciding what happens to the records in it, and '
          + 'this plan sees no records — it reads package declarations and, when there is one, a snapshot of the '
          + 'organization. Disabling is reversible, takes the screen out of everybody\'s way, and leaves the data '
          + 'exactly where it is for whoever does look at the records.',
        howToDeclareException: 'Only somebody looking at those records. If they are gone or were never there, deleting '
          + 'is fine — and it is done in the Form Design, where the platform can say what is in them.',
      }));
    }
  }

  const because = [
    ...screens.filter((one) => one.operation !== 'unchanged').map((one) => `${one.operation} screen "${one.collection}"`),
    ...lookups.filter((one) => one.operation !== 'unchanged').map((one) => `${one.operation} list "${one.collection}"`),
    ...deactivations.map((one) => `disable ${one.kind} "${one.target}"`),
  ];

  const versionBump = working.target === 'extension' && working.extensionId && because.length > 0
    ? { extensionId: working.extensionId, because }
    : null;

  if (versionBump !== null) {
    issues.push(make('domain.plan.version-bump-required', 'info', {
      message: `This plan changes "${versionBump.extensionId}", so its manifest.version has to move in the same change, with an entry at the top of its VERSIONS.md.`,
      suggestion: 'Semver: patch for a fix, minor for something new, major for anything that breaks what an earlier version wrote. '
        + 'The entry is written for whoever USES the extension — the change they will notice, never the field you touched. '
        + 'An extension changed without a new version never reaches the organizations that already have it.',
      howToDeclareException: 'Only being told to leave the version alone.',
    }));
  }

  const sorted = sortIssues(issues);
  return {
    ok: !hasBlockingIssue(sorted),
    target: working.target,
    ...(working.extensionId === undefined ? {} : { extensionId: working.extensionId }),
    relationships: working.relationships.map(relationshipSummary),
    screens,
    screenPlan,
    lookups,
    deactivations,
    trace,
    ledgerIntegrity,
    migrationsRequired: migrations,
    versionBump,
    issues: sorted,
    // O `sourceId` viaja com a tela proposta: é assim que aplicar o plano ao catálogo faz a passada
    // seguinte LER a identidade em vez de derivá-la outra vez.
    screenInputs: screenInputs.map((one) => ({
      ...one,
      ...(sourceIdByCollection.get(collectionOfScreen(one)) ? { sourceId: sourceIdByCollection.get(collectionOfScreen(one)) } : {}),
      fields: one.fields.map((field) => ({ ...field, origin })),
    })),
    declaredExceptions: modelExceptions(working, working.extensionId ?? working.target),
  };
};

/**
 * Aplica o plano ao catálogo — o que a instalação faria, em memória.
 *
 * Existe para que "rodar duas vezes não propõe nada" seja uma PROVA e não uma expectativa: o segundo
 * plano roda contra o catálogo que o primeiro produziria, e todas as operações têm de voltar
 * `unchanged`. Sem isto, a reconciliação seria uma promessa que só um escritório de verdade cobraria.
 */
export const applyPlanToCatalog = (catalog: DomainCatalog, plan: ArtifactPlan): DomainCatalog => {
  const planned = new Map(plan.screenInputs.map((one) => [one.collection?.trim() || one.key, one]));
  const merged: CatalogScreenInput[] = catalog.screens.map((screen) => {
    const collection = screen.collection?.trim() || screen.key;
    const replacement = planned.get(collection);
    if (replacement === undefined) return screen;
    planned.delete(collection);
    // O plano nunca remove: os campos que ele não descreve continuam onde estavam.
    const byKey = new Map(screen.fields.map((field) => [field.key, field]));
    for (const field of replacement.fields) byKey.set(field.key, field);
    return { ...screen, ...replacement, fields: [...byKey.values()] };
  });

  // As exceções do plano SOMAM às que o catálogo já trazia, e a chave dedupe: aplicar o mesmo plano
  // duas vezes não multiplica a declaração.
  const byKey = new Map(catalog.exceptions.map((one) => [exceptionKey(one.collection, one.field), one]));
  for (const one of plan.declaredExceptions) byKey.set(exceptionKey(one.collection, one.field), one);

  return buildDomainCatalog(
    [...merged, ...planned.values()],
    [
      ...catalog.lookups,
      ...plan.lookups.filter((one) => one.operation === 'create').map((one) => ({ collection: one.collection, label: one.label })),
    ],
    catalog.tagLists,
    [...byKey.values()],
  );
};
