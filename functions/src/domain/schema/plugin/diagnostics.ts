// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/plugin/diagnostics.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode =
  | 'manifest.invalid'
  | 'manifest.id.invalid'
  | 'manifest.version.invalid'
  | 'manifest.kernel.invalid'
  | 'manifest.kernel.incompatible'
  | 'manifest.field.missing'
  | 'manifest.duplicate'
  | 'dependency.range.invalid'
  | 'dependency.missing'
  | 'dependency.unsatisfied'
  | 'dependency.cycle'
  | 'dependency.disabled'
  | 'contribution.invalid'
  | 'contribution.id.invalid'
  | 'contribution.duplicate'
  | 'contribution.point.unknown'
  | 'contribution.point.incompatible'
  | 'contribution.impl.missing'
  | 'contribution.impl.forbidden'
  | 'contribution.impl.unresolved'
  | 'contribution.conflict'
  | 'extensionPoint.invalid'
  | 'extensionPoint.duplicate'
  | 'capability.id.invalid'
  | 'capability.range.invalid'
  | 'capability.unsatisfied'
  | 'permission.invalid'
  | 'permission.undeclared';

export interface PluginDiagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  pluginId?: string;
  contributionId?: string;
  path?: string;
}

export interface DiagnosticInput {
  code: DiagnosticCode;
  message: string;
  pluginId?: string;
  contributionId?: string;
  path?: string;
}

export const error = (input: DiagnosticInput): PluginDiagnostic => ({ severity: 'error', ...input });

export const warning = (input: DiagnosticInput): PluginDiagnostic => ({ severity: 'warning', ...input });

export const hasErrors = (diagnostics: PluginDiagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === 'error');

export const errorsOf = (diagnostics: PluginDiagnostic[]): PluginDiagnostic[] =>
  diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

export const withPlugin = (pluginId: string, diagnostics: PluginDiagnostic[]): PluginDiagnostic[] =>
  diagnostics.map((diagnostic) => (diagnostic.pluginId ? diagnostic : { ...diagnostic, pluginId }));
