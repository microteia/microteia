import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import {
  MARKETPLACE_CATALOG,
  accessExamplePlugin,
  authExamplePlugin,
  automationExamplePlugin,
  backendExamplePlugin,
  commandExamplePlugin,
  consumerExamplePlugin,
  documentExamplePlugin,
  libraryExamplePlugin,
  patchExamplePlugin,
  recordTabExamplePlugin,
  portalExamplePlugin,
  reportExamplePlugin,
  settingsExamplePlugin,
  themeExamplePlugin,
  widgetExamplePlugin,
} from './catalog';

/**
 * A COLETÂNEA — os exemplos que viajam como fonte para `extensions/examples/`, e que ninguém instala.
 *
 * Eles têm `.json` versionado pela mesma razão das extensões de primeira parte — `exampleSources.test.ts`
 * compila a fonte reescrita e exige o artefato byte a byte —, mas ficam FORA do `MARKETPLACE_CATALOG`
 * de propósito: são molde de leitura, não coisa que o escritório instala do Marketplace. É essa mesma
 * distinção que o `pack` usa para não cobrar deles o backend que o kernel não sobe.
 *
 * A lista mora aqui, e não dentro de um teste, porque QUATRO deles precisavam dela — o dos templates, o
 * do idioma-fonte, o das migrações e o da cobertura. Enquanto era copiada, acrescentar um exemplo pedia
 * quatro edições idênticas, e esquecer uma delas não reprovava nada: o exemplo simplesmente deixava de
 * ser conferido naquela dimensão, em silêncio.
 *
 * Não é importada pelo aplicativo. O que ele carrega é o `MARKETPLACE_CATALOG`, e nenhum destes está
 * lá — manter as duas listas separadas é o que impede um molde de aparecer na tela de Extensões.
 */
export const TRAVELLING_EXAMPLES: MarketplacePlugin[] = [
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
];

/**
 * TUDO o que chega a `extensions/examples/` — a coletânea mais as extensões de primeira parte, que
 * viajam pelos dois motivos ao mesmo tempo.
 *
 * A distinção acima é sobre o CATÁLOGO ("o escritório instala isto?"); esta é sobre o que o autor tem
 * para LER. Confundi-las mede errado: medir só a coletânea diria que ninguém demonstra um preset de
 * campo ou uma lista de opções, quando o Brasil e o Calendário demonstram os dois — e a lacuna
 * inventada custaria um exemplo escrito à toa.
 *
 * As cinco de primeira parte são exatamente as do catálogo embutido menos os TEMAS, que não têm `.json`
 * versionado e por isso não viajam. É derivado, e não uma segunda lista: `THEME_MARKETPLACE_PLUGINS`
 * entra no catálogo com o id `com.microteia.theme-<nome>`, e é esse prefixo que os separa.
 */
export const ALL_TRAVELLING_EXAMPLES: MarketplacePlugin[] = [
  ...MARKETPLACE_CATALOG.filter((plugin) => !plugin.manifest.id.startsWith('com.microteia.theme-')),
  ...TRAVELLING_EXAMPLES,
];
