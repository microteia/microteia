import type { Contribution } from '../../domain/schema/plugin/contribution';
import { ADMIN_NAV_GROUP, AUTOMATION_NAV_GROUP, CUSTOMIZATION_NAV_GROUP } from '../../domain/schema/ui/uiExtensionPoints';
import { navGroup } from '../../sdk/contributions';

/**
 * Os grupos da barra lateral que o NÚCLEO declara. Moram fora do manifest do `core.ui` para que o
 * servidor MCP de autoria os leia sem arrastar o kernel: a lista que o autor consulta antes de
 * declarar um grupo é esta, e não uma cópia que envelheceria calada.
 */
export const CORE_UI_NAV_GROUPS: Contribution[] = [
  navGroup({ key: CUSTOMIZATION_NAV_GROUP, label: '@core.ui/nav.group.customization', order: 102 }),
  navGroup({ key: AUTOMATION_NAV_GROUP, label: '@core.ui/nav.group.automation', order: 106 }),
  navGroup({ key: ADMIN_NAV_GROUP, label: '@core.ui/nav.group.admin', order: 110 }),
];
