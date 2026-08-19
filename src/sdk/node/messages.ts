import { buildMessageCatalog, translate } from '../../domain/schema/i18n/messages';
import type { MessageBundle, MessageParams } from '../../domain/schema/i18n/messages';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { CORE_MARKETPLACE_MESSAGES } from '../../plugins/messages/coreMarketplace';

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
const CATALOG = buildMessageCatalog(
  [{ locale: DEFAULT_LOCALE, namespace: 'core.marketplace', messages: CORE_MARKETPLACE_MESSAGES }],
  DEFAULT_LOCALE,
);

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
 * O mesmo, mas conhecendo também os textos que o PACOTE traz. Sem isto o terminal imprime
 * `@com.example.hello/extension.name` no lugar do nome — e o autor, que acabou de escrever a frase,
 * vê a chave dela. Os bundles vêm de `manifest.contributes`, que é onde a extensão os declara.
 */
export const describeWith = (bundles: MessageBundle[]) => {
  const catalog = buildMessageCatalog(
    [
      ...bundles,
      { locale: DEFAULT_LOCALE, namespace: 'core.marketplace', messages: CORE_MARKETPLACE_MESSAGES },
    ],
    DEFAULT_LOCALE,
  );
  return (message: string, params?: MessageParams): string => {
    const match = REFERENCE.exec(message);
    if (!match) return message;
    return translate(catalog, `${match[1]}/${match[2]}`, params);
  };
};
