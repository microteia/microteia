// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportExtensionPoints.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportExtensionPoints.ts
// é GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Contribution, ImplRef } from '../plugin/contribution';
import type { ExtensionPointDefinition } from '../plugin/extensionPoint';
import { hasBlockingReportIssue, validateReportSpecShape } from './validateReportSpec';
import type { ReportSpec } from './reportSpec';

export const REPORT_DEFINITION_POINT = 'report.definition';

export const REPORT_API_VERSION = '1.0.0';

/**
 * O ponto pelo qual um relatório chega ao escritório dentro de um pacote.
 *
 * `allowedImplKinds` aceita `widget` e `code` pela mesma razão que `ui.page`: um relatório
 * DECLARATIVO é dado puro e qualquer pacote pode trazê-lo sem gesto de confiança nenhum, enquanto um
 * relatório escrito EM CÓDIGO é uma view — e `isTrustedOnlyImplKind` já a restringe a quem foi
 * revisado. Contribuição SEM `impl` é o caminho declarativo, e é o normal.
 *
 * `implRequired` é falso justamente para isso: o relatório existe sem implementação alguma. É o que
 * separa este ponto de `ui.page`, onde uma página sem implementação não seria nada.
 */
export const REPORT_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: REPORT_DEFINITION_POINT,
    apiVersion: REPORT_API_VERSION,
    title: '@core.reports/point.definition.title',
    description: '@core.reports/point.definition.description',
    ownerPluginId: 'core.reports',
    allowedImplKinds: ['widget', 'code'],
    implRequired: false,
    multiple: true,
  },
];

/**
 * O relatório como ele viaja numa contribuição.
 *
 * `templateId` é o endereço estável dele no pacote — o mesmo contrato de `ActionModuleTemplate`, e o
 * que permite ao escritório editar o relatório de uma extensão sem que a atualização dela perca de
 * vista qual era qual.
 */
export interface ReportContributionMetadata {
  templateId: string;
  title: string;
  description?: string;
  icon?: string;
  spec: ReportSpec;
  /** Onde ele aparece, no molde de `UiWidgetMetadata.surface`. Ausente = a lista de Relatórios. */
  surface?: string;
  order?: number;
  hideFromSidebar?: boolean;
}

const slugId = (value: string): string =>
  value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase();

export const reportContribution = (
  metadata: ReportContributionMetadata,
  impl?: ImplRef,
): Contribution => ({
  point: REPORT_DEFINITION_POINT,
  id: slugId(metadata.templateId),
  apiVersion: REPORT_API_VERSION,
  metadata: metadata as unknown as Record<string, unknown>,
  ...(impl ? { impl } : {}),
});

/**
 * Lê de volta o relatório de uma contribuição, descartando metadata malformada de terceiro.
 *
 * NUNCA lança, e descarta pelos problemas BLOQUEANTES apenas: um relatório que só traz avisos —
 * granularidade que este kernel não conhece, dobra que ele degrada — continua valendo, porque é
 * exatamente esse o comportamento que a regra da compatibilidade promete.
 */
export const reportOf = (contribution: Contribution): ReportContributionMetadata | undefined => {
  const metadata = contribution?.metadata as Partial<ReportContributionMetadata> | undefined;
  if (!metadata || typeof metadata.templateId !== 'string' || metadata.templateId.trim() === '') {
    return undefined;
  }
  if (typeof metadata.title !== 'string' || metadata.title.trim() === '') return undefined;

  const spec = metadata.spec as ReportSpec | undefined;
  if (!spec || typeof spec !== 'object' || typeof spec.v !== 'number') return undefined;
  if (hasBlockingReportIssue(validateReportSpecShape(spec))) return undefined;

  return metadata as ReportContributionMetadata;
};
