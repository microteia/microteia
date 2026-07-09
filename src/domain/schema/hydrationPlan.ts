import type { FkHop, PathRoot, ResolveOptions, SchemaContext } from './pathResolver';
import { parsePath, resolvePath } from './pathResolver';

export interface HydrationPlanIssue {
  path: string;
  error: string;
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
  const issues: HydrationPlanIssue[] = [];

  for (const path of paths) {
    const resolution = resolvePath(ctx, root, parsePath(path), options);
    if (!resolution.valid) {
      issues.push({ path, error: resolution.error ?? 'caminho inválido' });
      continue;
    }
    resolution.hops.forEach((hop, index) => {
      if (!hopsByTarget.has(hop.materializeAt)) {
        hopsByTarget.set(hop.materializeAt, { hop, level: index + 1 });
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

  const maxLevel = Math.max(0, ...[...hopsByTarget.values()].map((entry) => entry.level));
  const levels: FkHop[][] = Array.from({ length: maxLevel }, () => []);
  for (const { hop, level } of hopsByTarget.values()) {
    levels[level - 1].push(hop);
  }

  return { levels, issues };
};
