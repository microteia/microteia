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
  /**
   * REFERÊNCIA de mensagem (`@core.marketplace/diagnostic.…`), não o texto. O diagnóstico nasce no
   * domínio e no backend, onde não existe idioma; quem o exibe resolve a referência com o catálogo
   * do usuário. Os valores que a frase interpola vão em `messageParams`.
   */
  message: string;
  messageParams?: Record<string, string>;
  pluginId?: string;
  contributionId?: string;
  /**
   * Índice da contribuição culpada. É o que separa, sem ambiguidade, um problema do manifest
   * (que descarta o plugin inteiro) de um problema de uma contribuição (que descarta só ela) —
   * o `contributionId` não serve para isso porque pode ser justamente o campo inválido.
   */
  contributionIndex?: number;
  path?: string;
}

export interface DiagnosticInput {
  code: DiagnosticCode;
  message: string;
  messageParams?: Record<string, string>;
  pluginId?: string;
  contributionId?: string;
  contributionIndex?: number;
  path?: string;
}

export const isContributionScoped = (diagnostic: PluginDiagnostic): boolean =>
  diagnostic.contributionIndex !== undefined;

export const error = (input: DiagnosticInput): PluginDiagnostic => ({ severity: 'error', ...input });

export const warning = (input: DiagnosticInput): PluginDiagnostic => ({ severity: 'warning', ...input });

export const hasErrors = (diagnostics: PluginDiagnostic[]): boolean =>
  diagnostics.some((diagnostic) => diagnostic.severity === 'error');

export const errorsOf = (diagnostics: PluginDiagnostic[]): PluginDiagnostic[] =>
  diagnostics.filter((diagnostic) => diagnostic.severity === 'error');

export const withPlugin = (pluginId: string, diagnostics: PluginDiagnostic[]): PluginDiagnostic[] =>
  diagnostics.map((diagnostic) => (diagnostic.pluginId ? diagnostic : { ...diagnostic, pluginId }));
