// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/kernel/PluginHost.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { Contribution, QualifiedContribution } from '../domain/schema/plugin/contribution';
import { findDuplicateContributions, validateContribution } from '../domain/schema/plugin/contribution';
import type { PluginDiagnostic } from '../domain/schema/plugin/diagnostics';
import { error, hasErrors, isContributionScoped, warning } from '../domain/schema/plugin/diagnostics';
import type { PluginManifest } from '../domain/schema/plugin/pluginManifest';
import { dependencyRange, validatePluginManifest } from '../domain/schema/plugin/pluginManifest';
import { KERNEL_VERSION } from '../domain/schema/plugin/kernelVersion';
import { satisfiesRange } from '../domain/schema/plugin/semver';
import type { CapabilityRegistry } from './CapabilityRegistry';
import { createCapabilityRegistry } from './CapabilityRegistry';
import type { ContributionRegistry } from './ContributionRegistry';
import { createContributionRegistry } from './ContributionRegistry';
import type { ExtensionPointRegistry } from './ExtensionPointRegistry';
import { createExtensionPointRegistry } from './ExtensionPointRegistry';
import type { ImplementationRegistry } from './ImplementationRegistry';
import { createImplementationRegistry } from './ImplementationRegistry';

export interface PluginRecord {
  manifest: PluginManifest;
  /** Só plugins first-party são confiáveis; é o que libera `impl: { kind: 'code' }`. */
  trusted?: boolean;
  /** Tabela de implementações `code`, fornecida pelo próprio módulo do plugin interno. */
  implementations?: Record<string, unknown>;
}

export interface LoadResult {
  loaded: string[];
  skipped: string[];
  diagnostics: PluginDiagnostic[];
}

export interface PluginHostOptions {
  kernelVersion?: string;
}

export interface PluginHost {
  load(records: PluginRecord[]): LoadResult;
  isLoaded(pluginId: string): boolean;
  loadedIds(): string[];
  manifestOf(pluginId: string): PluginManifest | undefined;
  diagnostics(): PluginDiagnostic[];
  diagnosticsOf(pluginId: string): PluginDiagnostic[];
  readonly contributions: ContributionRegistry;
  readonly points: ExtensionPointRegistry;
  readonly capabilities: CapabilityRegistry;
  readonly implementations: ImplementationRegistry;
}

const sortedIds = (ids: Iterable<string>): string[] => Array.from(ids).sort();

/**
 * Ordena os plugins de forma que toda dependência venha antes de quem depende dela (Kahn).
 * O que sobrar fora da ordem está em um ciclo — ou depende de alguém que está.
 */
const topologicalOrder = (
  eligible: Map<string, PluginRecord>,
): { order: string[]; unresolved: string[] } => {
  const pendingCount = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const id of eligible.keys()) {
    const dependencies = Object.keys(eligible.get(id)?.manifest.dependencies ?? {}).filter((dependencyId) =>
      eligible.has(dependencyId),
    );
    pendingCount.set(id, dependencies.length);
    for (const dependencyId of dependencies) {
      const bucket = dependents.get(dependencyId);
      if (bucket) bucket.push(id);
      else dependents.set(dependencyId, [id]);
    }
  }

  let ready = sortedIds(Array.from(pendingCount).filter(([, count]) => count === 0).map(([id]) => id));
  const order: string[] = [];

  while (ready.length > 0) {
    const id = ready.shift() as string;
    order.push(id);
    const unlocked: string[] = [];
    for (const dependentId of dependents.get(id) ?? []) {
      const remaining = (pendingCount.get(dependentId) ?? 0) - 1;
      pendingCount.set(dependentId, remaining);
      if (remaining === 0) unlocked.push(dependentId);
    }
    if (unlocked.length > 0) ready = sortedIds([...ready, ...unlocked]);
  }

  const resolved = new Set(order);
  return { order, unresolved: sortedIds(Array.from(eligible.keys()).filter((id) => !resolved.has(id))) };
};

export const createPluginHost = (options: PluginHostOptions = {}): PluginHost => {
  const kernelVersion = options.kernelVersion ?? KERNEL_VERSION;
  const contributions = createContributionRegistry();
  const points = createExtensionPointRegistry();
  const capabilities = createCapabilityRegistry();
  const implementations = createImplementationRegistry();

  let loadedRecords = new Map<string, PluginRecord>();
  let allDiagnostics: PluginDiagnostic[] = [];

  const load = (records: PluginRecord[]): LoadResult => {
    contributions.clear();
    points.clear();
    capabilities.clear();
    implementations.clear();
    loadedRecords = new Map();
    allDiagnostics = [];

    const diagnostics: PluginDiagnostic[] = [];
    const skipped = new Set<string>();
    const declared = new Map<string, PluginRecord>();
    const eligible = new Map<string, PluginRecord>();

    for (const record of records) {
      const pluginId = record?.manifest?.id;
      if (declared.has(pluginId)) {
        diagnostics.push(
          error({
            code: 'manifest.duplicate',
            message: '@core.marketplace/diagnostic.plugin.duplicate',
            messageParams: { id: pluginId },
            pluginId,
          }),
        );
        continue;
      }
      declared.set(pluginId, record);

      const manifestDiagnostics = validatePluginManifest(record.manifest, {
        trusted: record.trusted ?? false,
        kernelVersion,
        validateContributions: false,
      });
      diagnostics.push(...manifestDiagnostics);

      if (hasErrors(manifestDiagnostics)) skipped.add(pluginId);
      else eligible.set(pluginId, record);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const pluginId of sortedIds(eligible.keys())) {
        const dependencies = eligible.get(pluginId)?.manifest.dependencies ?? {};
        for (const [dependencyId, declaredDependency] of Object.entries(dependencies)) {
          const range = dependencyRange(declaredDependency);
          const dependency = eligible.get(dependencyId);
          if (!dependency) {
            diagnostics.push(
              error({
                code: declared.has(dependencyId) ? 'dependency.disabled' : 'dependency.missing',
                message: declared.has(dependencyId)
                  ? '@core.marketplace/diagnostic.dependency.disabled'
                  : '@core.marketplace/diagnostic.dependency.missing',
                messageParams: { id: pluginId, dependency: dependencyId },
                pluginId,
                path: `dependencies.${dependencyId}`,
              }),
            );
          } else if (!satisfiesRange(dependency.manifest.version, range)) {
            diagnostics.push(
              error({
                code: 'dependency.unsatisfied',
                message: '@core.marketplace/diagnostic.dependency.unsatisfied',
                messageParams: { id: pluginId, dependency: dependencyId, range, installed: dependency.manifest.version },
                pluginId,
                path: `dependencies.${dependencyId}`,
              }),
            );
          } else {
            continue;
          }
          eligible.delete(pluginId);
          skipped.add(pluginId);
          changed = true;
          break;
        }
      }
    }

    const { order, unresolved } = topologicalOrder(eligible);
    for (const pluginId of unresolved) {
      diagnostics.push(
        error({
          code: 'dependency.cycle',
          message: '@core.marketplace/diagnostic.dependency.cycle',
          messageParams: { id: pluginId },
          pluginId,
        }),
      );
      eligible.delete(pluginId);
      skipped.add(pluginId);
    }

    for (const pluginId of order) {
      const record = eligible.get(pluginId) as PluginRecord;
      for (const point of record.manifest.extensionPoints ?? []) {
        diagnostics.push(...points.register({ ...point, ownerPluginId: pluginId }));
      }
    }

    for (const pluginId of order) {
      const record = eligible.get(pluginId) as PluginRecord;
      const table = record.implementations;
      if (!table) continue;
      if (!record.trusted) {
        diagnostics.push(
          warning({
            code: 'contribution.impl.forbidden',
            message: '@core.marketplace/diagnostic.plugin.code-ignored',
            messageParams: { id: pluginId },
            pluginId,
          }),
        );
        continue;
      }
      for (const [key, implementation] of Object.entries(table)) {
        implementations.register(pluginId, key, implementation);
      }
    }

    const pointSnapshot = points.snapshot();

    for (const pluginId of order) {
      const record = eligible.get(pluginId) as PluginRecord;
      const trusted = record.trusted ?? false;
      const declaredContributions = record.manifest.contributes ?? [];

      const contributionDiagnostics: PluginDiagnostic[] = [
        ...findDuplicateContributions(declaredContributions, pluginId),
      ];
      declaredContributions.forEach((contribution, index) => {
        contributionDiagnostics.push(
          ...validateContribution(contribution, {
            pluginId,
            trusted,
            point: pointSnapshot.get(contribution?.point),
            index,
          }),
          ...unresolvedImplDiagnostics(contribution, pluginId, index),
        );
      });

      const rejected = new Set(
        contributionDiagnostics
          .filter((diagnostic) => diagnostic.severity === 'error' && isContributionScoped(diagnostic))
          .map((diagnostic) => diagnostic.contributionIndex),
      );

      diagnostics.push(...contributionDiagnostics);
      declaredContributions.forEach((contribution, index) => {
        if (rejected.has(index)) return;
        contributions.register({ ...contribution, pluginId } as QualifiedContribution);
      });

      for (const provision of record.manifest.provides ?? []) {
        capabilities.registerProvider(pluginId, provision);
      }

      loadedRecords.set(pluginId, record);
    }

    diagnostics.push(...conflictDiagnostics());
    diagnostics.push(...unsatisfiedCapabilityDiagnostics(order, eligible));

    allDiagnostics = diagnostics;
    return { loaded: order, skipped: sortedIds(skipped), diagnostics };
  };

  const unresolvedImplDiagnostics = (
    contribution: Contribution,
    pluginId: string,
    index: number,
  ): PluginDiagnostic[] => {
    if (contribution?.impl?.kind !== 'code') return [];
    if (implementations.has(pluginId, contribution.impl.key)) return [];
    return [
      error({
        code: 'contribution.impl.unresolved',
        message: '@core.marketplace/diagnostic.contribution.impl.unresolved',
        messageParams: { id: contribution.id, key: contribution.impl.key, plugin: pluginId },
        pluginId,
        contributionId: contribution.id,
        contributionIndex: index,
        path: `contributes[${index}].impl.key`,
      }),
    ];
  };

  const conflictDiagnostics = (): PluginDiagnostic[] =>
    contributions
      .points()
      .filter((pointId) => points.get(pointId)?.multiple === false && contributions.query(pointId).length > 1)
      .map((pointId) => {
        const competing = contributions.query(pointId);
        const winner = competing[0];
        return warning({
          code: 'contribution.conflict',
          message: '@core.marketplace/diagnostic.contribution.conflict',
          messageParams: { point: pointId, count: String(competing.length), winner: `${winner.pluginId}:${winner.id}` },
          pluginId: winner.pluginId,
          contributionId: winner.id,
        });
      });

  const unsatisfiedCapabilityDiagnostics = (
    order: string[],
    eligible: Map<string, PluginRecord>,
  ): PluginDiagnostic[] =>
    order.flatMap((pluginId) =>
      (eligible.get(pluginId)?.manifest.consumes ?? [])
        .filter((requirement) => !requirement.optional && capabilities.resolve(requirement) === null)
        .map((requirement) =>
          warning({
            code: 'capability.unsatisfied',
            message: '@core.marketplace/diagnostic.capability.unsatisfied',
            messageParams: { id: pluginId, capability: requirement.capability, range: requirement.range },
            pluginId,
          }),
        ),
    );

  return {
    load,
    isLoaded: (pluginId) => loadedRecords.has(pluginId),
    loadedIds: () => Array.from(loadedRecords.keys()),
    manifestOf: (pluginId) => loadedRecords.get(pluginId)?.manifest,
    diagnostics: () => [...allDiagnostics],
    diagnosticsOf: (pluginId) => allDiagnostics.filter((diagnostic) => diagnostic.pluginId === pluginId),
    contributions,
    points,
    capabilities,
    implementations,
  };
};
