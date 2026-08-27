/**
 * A camada de MODELO DE DOMÍNIO do SDK, num ponto só.
 *
 * Existe como entrada própria — e não dissolvida no barril — porque `sdkPurity.test.ts` percorre o
 * fechamento REAL de imports a partir de cada entrada: com esta na lista, o dia em que alguém trouxer
 * um store, o React ou o Firebase para dentro de um detector reprova no `npm test`, e não na máquina
 * de quem instalou o SDK.
 */

export type {
  DerivedFrom,
  DomainAggregation,
  DomainDenormalization,
  DomainEntity,
  DomainField,
  DomainIssue,
  DomainModel,
  DomainRelationship,
  DomainSeverity,
  EntityKind,
  EntityTab,
  EntityTabKind,
  Ownership,
  ParseResult,
  RelationshipStorage,
  RelationshipType,
  SemanticType,
} from './domainModel';
export {
  AGGREGATION_OPS,
  DELETE_SEMANTICS,
  DERIVED_FROM,
  DOMAIN_MODEL_VERSION,
  DOMAIN_SEVERITIES,
  EMBEDDED_STRATEGY,
  ENTITY_KINDS,
  ENTITY_TAB_KINDS,
  OWNERSHIPS,
  RELATIONSHIP_STORAGES,
  RELATIONSHIP_TYPES,
  SCREEN_IS_NOT_AN_ENTITY_MODEL,
  SEMANTIC_TYPES,
  hasBlockingIssue,
  parseDomainModel,
  sortIssues,
} from './domainModel';

export type {
  BehaviorEffect,
  BehaviorGuard,
  BehaviorInvariant,
  BehaviorModel,
  BehaviorState,
  BehaviorStateOption,
  BehaviorTransition,
  BehaviorTrigger,
  EffectKind,
  InvariantEnforcement,
  InvariantScope,
  TriggerKind,
} from './behaviorModel';
export {
  A_STATE_IS_A_KEY,
  EFFECT_KINDS,
  INVARIANT_ENFORCEMENTS,
  INVARIANT_SCOPES,
  TRIGGER_KINDS,
  effectEntity,
  enforcementOfScope,
  isSelfLoop,
  parseBehaviorModel,
  stateOfEntity,
} from './behaviorModel';

export type { BehaviorConcern, BehaviorMechanism, MappedTransition, TransitionFromCheck } from './behaviorMapping';
export {
  BEHAVIOR_CONCERNS,
  BEHAVIOR_MECHANISMS,
  DESCRIPTION_REQUIRED_BECAUSE,
  DESCRIPTION_REQUIRED_EVENTS,
  SCHEDULE_TRIGGER_SUPPORTED,
  mapTransition,
  mechanismsFor,
  referenceParameterKey,
  transitionSummary,
} from './behaviorMapping';

export type { BehaviorValidation } from './validateBehaviorModel';
export { validateBehaviorModel } from './validateBehaviorModel';

export type { DomainIssueCode } from './detectors';
export { DETECTORS, DOMAIN_ISSUE_CODES, detectorList } from './detectors';

export type {
  CatalogEntity,
  CatalogField,
  CatalogList,
  CatalogScreenInput,
  DomainCatalog,
  ParentRelation,
} from './catalog';
export { buildDomainCatalog, catalogEntity, declaredScreenSourceIds } from './catalog';

export type { MappedRelationship, StorageMechanism } from './storageMapping';
export { STORAGE_MECHANISMS, canonicalRelationship, mapRelationship, relationshipSummary } from './storageMapping';

export type { DomainValidation } from './validateDomainModel';
export { validateDomainModel } from './validateDomainModel';

export type {
  ArtifactPlan,
  ArtifactPlanOptions,
  LedgerIntegrity,
  PlanOperation,
  PlanTrace,
  PlannedDeactivation,
  PlannedField,
  PlannedLookup,
  PlannedMigration,
  PlannedScreen,
} from './artifactPlan';
export { applyPlanToCatalog, buildArtifactPlan } from './artifactPlan';

export type {
  ActionPlacement,
  NotAScreen,
  ScreenSourceIdOrigin,
  PlannedFormSection,
  PlannedListColumn,
  PlannedReadOnlyField,
  PlannedRecordAction,
  PlannedReferenceField,
  PlannedTab,
  ScreenLayout,
  ScreenPlan,
  ScreenPlanInput,
  ScreenPlanRule,
  ScreenPresence,
} from './screenPlan';
export {
  SCREEN_LIST_COLUMN_BUDGET,
  SCREEN_PLAN_HUMAN_DECISIONS,
  SCREEN_PLAN_RULES,
  SCREEN_SOURCE_ID_PRECEDENCE,
  buildScreenPlan,
  deriveScreenSourceId,
} from './screenPlan';

export type { BusinessRule, ParsedBusinessRule } from './businessRule';
export { businessRuleSummary, checkBusinessRule, parseBusinessRule } from './businessRule';

export type { LedgerProduced, LedgerReality, RuleDelta, RuleLedger, RuleLedgerEntry } from './traceability';
export {
  RULE_LEDGER_FILE,
  RULE_LEDGER_VERSION,
  emptyRuleLedger,
  ledgerEntryOf,
  ledgerFindings,
  parseRuleLedger,
  registeredScreenSourceIds,
  ruleDelta,
  ruleFingerprint,
  ruleLedgerEntry,
  withRuleEntry,
} from './traceability';

export type { CoverageItem, CoverageSummary, CoverageSurface } from './coverage';
export { COVERAGE_SURFACES, coverageGaps, coverageSummary, mechanismCoverage } from './coverage';

export { domainModelJsonSchema } from './jsonSchema';

export { collectionOfEntity, expandEmbedded } from './toPlatform';
