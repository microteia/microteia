import type { FkHop, PathRoot, PathSegment, ResolveOptions, SchemaContext } from './pathResolver';
import { parsePath, resolvePath } from './pathResolver';

const fieldAccessedAfterHop = (pathSegments: PathSegment[], hop: FkHop): string | undefined => {
  const start = parsePath(hop.materializeAt).length;
  for (let i = start; i < pathSegments.length; i += 1) {
    const segment = pathSegments[i];
    if (segment.kind === 'key') return segment.name;
  }
  return undefined;
};

export interface HydrationPlanIssue {
  path: string;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string;
  errorParams?: Record<string, string>;
}

export interface HydrationPlan {
  levels: FkHop[][];
  issues: HydrationPlanIssue[];
}

export const buildHydrationPlan = (
  ctx: SchemaContext,
  root: PathRoot,
  paths: string[],
  options?: ResolveOptions,
): HydrationPlan => {
  const hopsByTarget = new Map<string, { hop: FkHop; level: number }>();
  const accessedByTarget = new Map<string, Set<string>>();
  const issues: HydrationPlanIssue[] = [];

  for (const path of paths) {
    const pathSegments = parsePath(path);
    const resolution = resolvePath(ctx, root, pathSegments, options);
    if (!resolution.valid) {
      issues.push({
        path,
        error: resolution.error ?? '@core.automation/mutation.path.invalid',
        errorParams: resolution.errorParams ?? { path },
      });
      continue;
    }
    resolution.hops.forEach((hop, index) => {
      if (!hopsByTarget.has(hop.materializeAt)) {
        hopsByTarget.set(hop.materializeAt, { hop, level: index + 1 });
      }
      const accessed = fieldAccessedAfterHop(pathSegments, hop);
      if (accessed) {
        const set = accessedByTarget.get(hop.materializeAt) ?? new Set<string>();
        set.add(accessed);
        accessedByTarget.set(hop.materializeAt, set);
      }
    });
  }

  for (const entry of hopsByTarget.values()) {
    const lastDot = entry.hop.atPath.lastIndexOf('.');
    if (lastDot < 0) continue;
    const fkKey = entry.hop.atPath.slice(lastDot + 1);
    let parentPath = entry.hop.atPath.slice(0, lastDot);
    while (/\.\d+$/.test(parentPath)) {
      parentPath = parentPath.slice(0, parentPath.lastIndexOf('.'));
    }
    const parent = hopsByTarget.get(parentPath);
    if (!parent || parent.hop.fields === 'all' || parent.hop.fields.includes(fkKey)) continue;
    parent.hop = { ...parent.hop, fields: [...parent.hop.fields, fkKey] };
  }

  for (const [materializeAt, entry] of hopsByTarget) {
    const accessed = accessedByTarget.get(materializeAt);
    if (!accessed) continue;
    const nativeFields = [...accessed].filter((field) => !hopsByTarget.has(`${materializeAt}.${field}`));
    if (nativeFields.length === 0) continue;
    const fields =
      entry.hop.fields === 'all'
        ? entry.hop.fields
        : [...new Set([...entry.hop.fields, ...nativeFields])];
    entry.hop = { ...entry.hop, fields, requiredFields: nativeFields };
  }

  const maxLevel = Math.max(0, ...[...hopsByTarget.values()].map((entry) => entry.level));
  const levels: FkHop[][] = Array.from({ length: maxLevel }, () => []);
  for (const { hop, level } of hopsByTarget.values()) {
    levels[level - 1].push(hop);
  }

  return { levels, issues };
};
