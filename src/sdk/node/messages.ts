import { buildMessageCatalog, translate } from '../../domain/schema/i18n/messages';
import type { MessageBundle, MessageParams } from '../../domain/schema/i18n/messages';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { messageBundlesOf } from '../../domain/schema/i18n/extensionPoints';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { CORE_ACCESS_MESSAGES } from '../../plugins/messages/coreAccess';
import { CORE_ADMIN_MESSAGES } from '../../plugins/messages/coreAdmin';
import { CORE_AUTOMATION_MESSAGES } from '../../plugins/messages/coreAutomation';
import { CORE_DATA_MESSAGES } from '../../plugins/messages/coreData';
import { CORE_I18N_MESSAGES } from '../../plugins/messages/coreI18n';
import { CORE_LICENSE_MESSAGES } from '../../plugins/messages/coreLicense';
import { CORE_MARKETPLACE_MESSAGES } from '../../plugins/messages/coreMarketplace';
import { CORE_RECORDS_MESSAGES } from '../../plugins/messages/coreRecords';
import { CORE_REPORTS_MESSAGES } from '../../plugins/messages/coreReports';
import { CORE_DOCUMENTS_MESSAGES } from '../../plugins/messages/coreDocuments';
import { CORE_SETTINGS_MESSAGES } from '../../plugins/messages/coreSettings';
import { CORE_TENANT_MESSAGES } from '../../plugins/messages/coreTenant';
import { CORE_THEME_MESSAGES } from '../../plugins/messages/coreTheme';
import { CORE_UI_MESSAGES } from '../../plugins/messages/coreUi';
import { CORE_WORKSPACE_MESSAGES } from '../../plugins/messages/coreWorkspace';

/**
 * O tradutor do terminal. Um problema de pacote nasce como REFERÊNCIA de mensagem
 * (`@core.marketplace/issue.package.too-large`) porque a validação corre no domínio, no backend e aqui
 * — três lugares onde não existe idioma. Quem exibe resolve, e no terminal quem exibe é isto.
 *
 * Importa `plugins/messages` porque é FERRAMENTA de build, não runtime: `src/sdk/node/` está para o
 * SDK como `scripts/` está para o repositório, e `export-extensions.mjs` já lê `plugins/` do mesmo
 * jeito. O barril do SDK — que o app importa — continua sem alcançar nada disso, e
 * `sdkPurity.test.ts` é o que cobra.
 *
 * O idioma é o do produto (inglês). O terminal do autor não negocia locale: traduzir a ferramenta
 * exigiria carregar um pacote de idioma antes de haver instalação, e a mensagem que importa é a que
 * ele vai comparar com a documentação — que também é em inglês.
 */
/**
 * TODOS os namespaces do núcleo, e não só o `core.marketplace`.
 *
 * Enquanto era um só, `list_extension_points` devolvia `@core.data/point.entity.title` no lugar de
 * "Domain entity", e descartava a `description` — que é justamente o campo que diria ao autor PARA QUE
 * SERVE cada ponto. A ferramenta que existia para ensinar os pontos de extensão respondia com uma
 * lista de ids e chaves opacas.
 */
export const CORE_BUNDLES: MessageBundle[] = [
  ['core.access', CORE_ACCESS_MESSAGES],
  ['core.admin', CORE_ADMIN_MESSAGES],
  ['core.automation', CORE_AUTOMATION_MESSAGES],
  ['core.data', CORE_DATA_MESSAGES],
  ['core.i18n', CORE_I18N_MESSAGES],
  ['core.license', CORE_LICENSE_MESSAGES],
  ['core.marketplace', CORE_MARKETPLACE_MESSAGES],
  ['core.records', CORE_RECORDS_MESSAGES],
  ['core.reports', CORE_REPORTS_MESSAGES],
  ['core.documents', CORE_DOCUMENTS_MESSAGES],
  ['core.settings', CORE_SETTINGS_MESSAGES],
  ['core.tenant', CORE_TENANT_MESSAGES],
  ['core.theme', CORE_THEME_MESSAGES],
  ['core.ui', CORE_UI_MESSAGES],
  ['core.workspace', CORE_WORKSPACE_MESSAGES],
].map(([namespace, messages]) => ({
  locale: DEFAULT_LOCALE,
  namespace: namespace as string,
  messages: messages as Record<string, string>,
}));

const CATALOG = buildMessageCatalog(CORE_BUNDLES, DEFAULT_LOCALE);

const REFERENCE = /^@([a-z0-9.-]+)\/(.+)$/;

/**
 * Resolve uma referência para texto. Uma referência que o catálogo não conhece volta como ela mesma —
 * feio, mas diagnosticável, e é a mesma tolerância que `translate` já pratica na tela.
 */
export const describeMessage = (message: string, params?: MessageParams): string => {
  const match = REFERENCE.exec(message);
  if (!match) return message;
  return translate(CATALOG, `${match[1]}/${match[2]}`, params);
};

/**
 * O resolvedor DE UM PACOTE — a forma em que `describeWith` é usada em todo lugar que tem o pacote na
 * mão, e que estava sendo remontada em quatro.
 *
 * O nome de um artefato do pacote pode ser uma REFERÊNCIA: `name: message('flow.closing')` é como as
 * extensões de primeira parte são escritas, porque nome de fluxo, de ação e de script é texto que
 * alguém lê. As funções de domínio que os leem — `exportedSurface`, o portão da referência cruzada —
 * devolvem o artefato como ele está, porque rodam onde não existe idioma. Quem imprime resolve, e o
 * catálogo para resolver viaja dentro do próprio pacote.
 */
export const packageText = (pkg: MarketplacePlugin): ((message: string, params?: MessageParams) => string) =>
  describeWith(messageBundlesOf(pkg.manifest.contributes ?? []));

/**
 * O mesmo, mas conhecendo também os textos que o PACOTE traz. Sem isto o terminal imprime
 * `@com.example.hello/extension.name` no lugar do nome — e o autor, que acabou de escrever a frase,
 * vê a chave dela. Os bundles vêm de `manifest.contributes`, que é onde a extensão os declara.
 */
export const describeWith = (bundles: MessageBundle[]) => {
  const catalog = buildMessageCatalog([...bundles, ...CORE_BUNDLES], DEFAULT_LOCALE);
  return (message: string, params?: MessageParams): string => {
    const match = REFERENCE.exec(message);
    if (!match) return message;
    return translate(catalog, `${match[1]}/${match[2]}`, params);
  };
};
