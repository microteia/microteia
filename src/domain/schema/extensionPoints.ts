import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import { UI_EXTENSION_POINTS } from './ui/uiExtensionPoints';
import { DATA_EXTENSION_POINTS } from './dataExtensionPoints';
import { REPORT_EXTENSION_POINTS } from './report/reportExtensionPoints';
import { DOCUMENT_EXTENSION_POINTS } from './document/documentTemplate';
import { I18N_EXTENSION_POINTS } from './i18n/extensionPoints';
import { THEME_EXTENSION_POINTS } from './theme/extensionPoints';
import { ACCESS_EXTENSION_POINTS } from './access/extensionPoints';
import { AUTH_EXTENSION_POINTS } from './auth/authExtensionPoints';
import { TIME_EXTENSION_POINTS } from './time/extensionPoints';
import { PORTAL_EXTENSION_POINTS } from './portalExtensionPoints';
import { NOTIFICATION_EXTENSION_POINTS } from './notifications';
import { WORKFLOW_STEP_EXTENSION_POINTS } from './workflowStepContribution';

/**
 * TODOS os pontos de extensão do kernel, num lugar só.
 *
 * Existe porque a agregação estava escrita À MÃO em três arquivos — o relatório de cobertura do SDK,
 * o guia de autoria e o servidor MCP —, e um ponto novo deixava as três incompletas sem reprovar em
 * nada. Não é hipótese: o `mcp.ts` omitia `AUTH_EXTENSION_POINTS`, então o agente de autoria nunca
 * enxergou `auth.provider`, e nada acusou por quanto tempo isso durou.
 *
 * É a mesma regra que já vale para o resto: afirmação sobre o kernel num documento gerado é
 * DERIVADA, nunca prosa. `extensionPoints.test.ts` varre as fontes e reprova a família que não
 * estiver aqui.
 */
export const KERNEL_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  ...UI_EXTENSION_POINTS,
  ...DATA_EXTENSION_POINTS,
  ...REPORT_EXTENSION_POINTS,
  ...DOCUMENT_EXTENSION_POINTS,
  ...I18N_EXTENSION_POINTS,
  ...THEME_EXTENSION_POINTS,
  ...ACCESS_EXTENSION_POINTS,
  ...AUTH_EXTENSION_POINTS,
  ...TIME_EXTENSION_POINTS,
  ...PORTAL_EXTENSION_POINTS,
  ...NOTIFICATION_EXTENSION_POINTS,
  ...WORKFLOW_STEP_EXTENSION_POINTS,
];
