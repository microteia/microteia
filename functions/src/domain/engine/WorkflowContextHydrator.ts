import type { Condition, WorkflowDefinition, WorkflowEvent } from '../entities/Workflow';
import type { WorkflowLogger } from '../entities/WorkflowContext';
import type { IWorkflowRecordFetcher } from '../repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import { createSchemaContext, joinSegments, parsePath, stripEventPrefix } from '../schema/pathResolver';
import type { PathRoot, ResolveOptions } from '../schema/pathResolver';
import { buildHydrationPlan } from '../schema/hydrationPlan';
import { collectHopRecordRefs, materializeHops, recordKey } from '../schema/materialize';
import { eventNameToRoot } from '../schema/eventCatalog';
import { extractExpressionPaths } from '../schema/expressionPaths';

export type HydrationCache = Map<string, Record<string, unknown> | null>;

export const createHydrationCache = (): HydrationCache => new Map();

export class WorkflowContextHydrator {
  constructor(
    private readonly fetcher: IWorkflowRecordFetcher,
    private readonly screenProvider: IScreenDefinitionProvider,
  ) {}

  collectReferencedPaths(definition: WorkflowDefinition): string[] {
    const paths = new Set<string>();

    const addAbsolute = (rawPath: string): void => {
      const segments = stripEventPrefix(rawPath);
      if (segments && segments.length > 0) paths.add(joinSegments(segments));
    };
    const addRelative = (rawPath: string): void => {
      const segments = parsePath(rawPath);
      if (segments.length > 0) paths.add(joinSegments(segments));
    };
    const addExpression = (expression: string): void => {
      extractExpressionPaths(expression).forEach(addAbsolute);
    };

    const walkCondition = (condition: Condition): void => {
      switch (condition.kind) {
        case 'FieldComparison':
          addAbsolute(condition.fieldPath);
          if (condition.valueType === 'eventField') addAbsolute(String(condition.value));
          if (condition.valueType === 'expression') addExpression(String(condition.value));
          return;
        case 'Expression':
          addExpression(condition.expression);
          return;
        case 'LogicalAnd':
        case 'LogicalOr':
          condition.conditions.forEach(walkCondition);
          return;
        case 'Not':
          walkCondition(condition.condition);
          return;
        case 'AlwaysTrue':
          return;
      }
    };

    walkCondition(definition.condition);

    for (const step of definition.steps) {
      for (const mapping of Object.values(step.configuration)) {
        if (mapping.kind === 'Event') addRelative(mapping.path);
        else if (mapping.kind === 'Expression') addExpression(mapping.expression);
      }
    }

    return [...paths];
  }

  async hydrate(
    event: WorkflowEvent,
    paths: string[],
    cache: HydrationCache,
    logger?: WorkflowLogger,
    options?: ResolveOptions,
    rootOverride?: PathRoot,
  ): Promise<WorkflowEvent> {
    if (paths.length === 0) return event;

    const payload = event.payload ?? {};
    const screenKey = typeof payload.screenKey === 'string' ? payload.screenKey : undefined;
    const root = rootOverride ?? eventNameToRoot(event.name, screenKey);
    if (!root) return event;

    const screens = await this.screenProvider.getScreens(event.tenantId);
    const ctx = createSchemaContext(screens);
    const plan = buildHydrationPlan(ctx, root, paths, options);

    for (const issue of plan.issues) {
      logger?.warn(`Caminho "${issue.path}" inválido para o evento "${event.name}": ${issue.error}`);
    }
    if (plan.levels.length === 0) return event;

    let hydratedPayload = payload;
    for (const hops of plan.levels) {
      if (hops.length === 0) continue;

      const missingRefs = collectHopRecordRefs(hydratedPayload, hops).filter(
        (ref) => !cache.has(recordKey(ref.collection, ref.id)),
      );
      const idsByCollection = new Map<string, string[]>();
      for (const ref of missingRefs) {
        const ids = idsByCollection.get(ref.collection) ?? [];
        ids.push(ref.id);
        idsByCollection.set(ref.collection, ids);
      }
      for (const [collection, ids] of idsByCollection) {
        const fetched = await this.fetcher.fetchByIds(event.tenantId, collection, ids);
        fetched.forEach((data, id) => cache.set(recordKey(collection, id), data));
      }

      hydratedPayload = materializeHops(hydratedPayload, hops, cache);
    }

    return { ...event, payload: hydratedPayload };
  }
}
