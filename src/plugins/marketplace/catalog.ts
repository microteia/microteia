import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { agentPlugin } from './agent';
import { brasilPlugin } from './brasil';
import { newsPlugin } from './news';
import { dashboardPlugin } from './dashboard';
import { calendarPlugin } from './calendar';
import { businessDaysPlugin } from './businessDays';
import { localePtBrPlugin } from './localePtBr';
import { automationExamplePlugin } from './examples/automation-example/plugin';
import { reportExamplePlugin } from './examples/report-example/plugin';
import { widgetExamplePlugin } from './examples/widget-example/plugin';
import { accessExamplePlugin } from './examples/access-example/plugin';
import { backendExamplePlugin } from './examples/backend-example/plugin';
import { libraryExamplePlugin } from './examples/library-example/plugin';
import { consumerExamplePlugin } from './examples/consumer-example/plugin';
import { patchExamplePlugin } from './examples/patch-example/plugin';
import { themeExamplePlugin } from './examples/theme-example/plugin';
import { authExamplePlugin } from './examples/auth-example/plugin';
import { commandExamplePlugin } from './examples/command-example/plugin';
import { settingsExamplePlugin } from './examples/settings-example/plugin';
import { recordTabExamplePlugin } from './examples/record-tab-example/plugin';
import { portalExamplePlugin } from './examples/portal-example/plugin';
import { documentExamplePlugin } from './examples/document-example/plugin';
import { THEME_MARKETPLACE_PLUGINS } from './themes';

/**
 * Os exemplos de `examples/` são MOLDE de autoria: uma pasta por exemplo, cada um viaja como fonte e
 * nenhum entra no catálogo embutido. A separação de diretório não é arrumação — é o que impede as
 * extensões de primeira parte de se perderem no meio dos moldes, que são muitos mais e existem para ser
 * lidos, não instalados.
 */
export { agentPlugin, brasilPlugin, newsPlugin, dashboardPlugin, calendarPlugin, businessDaysPlugin, localePtBrPlugin };

/**
 * Catálogo do Marketplace EMBUTIDO: extensões de PRIMEIRA PARTE que viajam no bundle da aplicação.
 * Aparecem em Extensões com o selo "Do sistema", instalam com um clique e — por virem do próprio
 * código da aplicação — dispensam o gesto de revisão de código (`hasTrustedProvenance`), então a
 * tela em código executa direto. É o caminho curto para desenvolver e testar uma extensão nossa:
 * editar o `.ts`, recarregar, "Atualizar" na linha da extensão.
 *
 * O botão "Atualizar" aparece sempre que o pacote embutido difere do instalado, e não só quando a
 * versão sobe — durante o desenvolvimento a versão costuma ficar parada enquanto o código muda.
 *
 * O mesmo pacote também é distribuível como `.json` (`extension-templates/`, gerado por
 * `npm run build:extensions`), para importar em escritórios que não rodam este bundle.
 */
export {
  automationExamplePlugin,
  reportExamplePlugin,
  widgetExamplePlugin,
  accessExamplePlugin,
  backendExamplePlugin,
  libraryExamplePlugin,
  consumerExamplePlugin,
  patchExamplePlugin,
  themeExamplePlugin,
  authExamplePlugin,
  commandExamplePlugin,
  settingsExamplePlugin,
  recordTabExamplePlugin,
  documentExamplePlugin,
  portalExamplePlugin,
};

export const MARKETPLACE_CATALOG: MarketplacePlugin[] = [
  localePtBrPlugin,
  agentPlugin,
  brasilPlugin,
  dashboardPlugin,
  calendarPlugin,
  businessDaysPlugin,
  newsPlugin,
  ...THEME_MARKETPLACE_PLUGINS,
];
