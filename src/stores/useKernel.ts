import { createContext, useContext } from 'react';
import type { CapabilityRequirement, ResolvedProvider } from '../domain/schema/plugin/capability';
import type { QualifiedContribution } from '../domain/schema/plugin/contribution';
import type { PluginDiagnostic } from '../domain/schema/plugin/diagnostics';
import type { LoadResult, PluginHost } from '../kernel';

export interface KernelContextValue {
  host: PluginHost;
  result: LoadResult;
}

export const KernelContext = createContext<KernelContextValue | null>(null);

export const useKernel = (): KernelContextValue => {
  const context = useContext(KernelContext);
  if (!context) throw new Error('useKernel precisa estar dentro de <KernelProvider>');
  return context;
};

export const useContributions = (point: string): QualifiedContribution[] =>
  useKernel().host.contributions.query(point);

export const useContribution = (point: string): QualifiedContribution | undefined =>
  useKernel().host.contributions.queryOne(point);

export const useCapability = (
  requirement: CapabilityRequirement,
  boundPluginId?: string,
): ResolvedProvider | null => useKernel().host.capabilities.resolve(requirement, boundPluginId);

export const useImplementation = <T,>(contribution: QualifiedContribution): T | undefined => {
  const { host } = useKernel();
  if (contribution.impl?.kind !== 'code') return undefined;
  return host.implementations.resolve<T>(contribution.pluginId, contribution.impl.key);
};

export const usePluginDiagnostics = (): PluginDiagnostic[] => useKernel().result.diagnostics;
