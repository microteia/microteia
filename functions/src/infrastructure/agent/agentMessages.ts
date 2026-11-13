import type { MessageBundle, MessageCatalog, MessageParams } from '../../domain/schema/i18n/messages';
import { buildMessageCatalog, translate } from '../../domain/schema/i18n/messages';
import { parseMessageRef } from '../../domain/schema/i18n/messageRef';
import { DEFAULT_LOCALE, normalizeLocale } from '../../domain/schema/i18n/localeNegotiation';
import { CORE_ACCESS_MESSAGES } from '../../plugins/messages/coreAccess';
import { CORE_ADMIN_MESSAGES } from '../../plugins/messages/coreAdmin';
import { CORE_ASSISTANT_MESSAGES } from '../../plugins/messages/coreAssistant';
import { CORE_AUTOMATION_MESSAGES } from '../../plugins/messages/coreAutomation';
import { CORE_DATA_MESSAGES } from '../../plugins/messages/coreData';
import { CORE_MARKETPLACE_MESSAGES } from '../../plugins/messages/coreMarketplace';
import { CORE_RECORDS_MESSAGES } from '../../plugins/messages/coreRecords';
import { CORE_REPORTS_MESSAGES } from '../../plugins/messages/coreReports';
import { CORE_DOCUMENTS_MESSAGES } from '../../plugins/messages/coreDocuments';
import { CORE_TENANT_MESSAGES } from '../../plugins/messages/coreTenant';
import { CORE_UI_MESSAGES } from '../../plugins/messages/coreUi';
import { CORE_WORKSPACE_MESSAGES } from '../../plugins/messages/coreWorkspace';

/**
 * Os catálogos do NÚCLEO no idioma-fonte, do lado que emite as referências.
 *
 * A lista é o conjunto de namespaces que `functions/src` cita, e não uma escolha: `agentMessages.test.ts`
 * varre o backend e reprova quando ele passa a citar um namespace que não está aqui. Sem isso, uma
 * referência nova resolveria para a própria chave crua e ninguém notaria — que é exatamente o defeito
 * que este módulo existe para não ter.
 *
 * Os cinco namespaces que sobram (`core.auth`, `core.i18n`, `core.license`, `core.settings`,
 * `core.theme`) ficam de fora porque o backend não os emite. Trazê-los "por precaução" custaria
 * carregar texto de tela em toda partida a frio de function.
 */
export const KERNEL_MESSAGE_NAMESPACES: Readonly<Record<string, Record<string, string>>> = {
  'core.access': CORE_ACCESS_MESSAGES,
  'core.admin': CORE_ADMIN_MESSAGES,
  'core.assistant': CORE_ASSISTANT_MESSAGES,
  'core.automation': CORE_AUTOMATION_MESSAGES,
  'core.data': CORE_DATA_MESSAGES,
  'core.marketplace': CORE_MARKETPLACE_MESSAGES,
  'core.records': CORE_RECORDS_MESSAGES,
  'core.reports': CORE_REPORTS_MESSAGES,
  'core.documents': CORE_DOCUMENTS_MESSAGES,
  'core.tenant': CORE_TENANT_MESSAGES,
  'core.ui': CORE_UI_MESSAGES,
  'core.workspace': CORE_WORKSPACE_MESSAGES,
};

const KERNEL_BUNDLES: MessageBundle[] = Object.entries(KERNEL_MESSAGE_NAMESPACES).map(
  ([namespace, messages]) => ({ locale: DEFAULT_LOCALE, namespace, messages }),
);

/**
 * O catálogo com que o gateway resolve o que devolve ao agente.
 *
 * `extensionBundles` traz o que as extensões instaladas contribuem em `i18n.messages` — e é isso que
 * faz a tradução funcionar aqui sem mecanismo novo: um escritório com o pacote de idioma instalado
 * tem os bundles em pt-BR entre eles, e o agente passa a responder em português pela mesma via que a
 * tela usa. Nada foi acrescentado ao núcleo para isso.
 */
export const agentCatalog = (extensionBundles: MessageBundle[], locale: string): MessageCatalog =>
  buildMessageCatalog(
    [...KERNEL_BUNDLES, ...extensionBundles],
    normalizeLocale(locale) || DEFAULT_LOCALE,
  );

/** Uma frase resolvida ao lado da REFERÊNCIA que a originou. */
export interface AgentText {
  text: string;
  /** `null` quando o valor não era uma referência — ver abaixo. */
  ref: string | null;
}

/**
 * Resolve o que vem do backend — e deixa passar intacto o que não é nosso.
 *
 * O reconhecimento da referência é `parseMessageRef`, e não um `startsWith('@')` escrito aqui: é a
 * mesma porta que a tela usa, e ela sabe duas coisas que um prefixo não sabe — que a chave plena do
 * catálogo NÃO leva o `@`, e que um `@` no meio de uma frase ("suporte@microteia.app") não é
 * referência.
 *
 * O que não é referência já está pronto: é a mensagem que o ESCRITÓRIO escreveu numa regra de campo,
 * ou o `console.log` de um Script dele. Traduzir isso não faria sentido, e é a mesma regra que o
 * `resolveLabel` da tela aplica — uma porta só, sem decisão no ponto de emissão.
 *
 * O que este módulo acrescenta a `resolveLabel` é devolver a referência JUNTO do texto, e não em
 * lugar dele. Um modelo que recebe só "Formato inválido" não tem como distinguir dois motivos
 * diferentes que compartilham a frase; e quem depura precisa da chave. Custa um campo.
 */
export const agentText = (
  catalog: MessageCatalog,
  value: string,
  params?: MessageParams,
): AgentText => {
  const ref = parseMessageRef(value);
  return ref === null
    ? { text: value, ref: null }
    : { text: translate(catalog, ref.full, params), ref: value };
};
