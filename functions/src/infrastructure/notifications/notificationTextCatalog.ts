import type { InstalledExtensionCache } from '../../data/services/InstalledExtensionCache';
import type { INotificationTextCatalog, NotificationTextResolver } from '../../domain/repositories/INotificationDelivery';
import { agentCatalog, agentText } from '../agent/agentMessages';

/**
 * Título e mensagem no idioma de quem RECEBE — e não no de quem escreveu o fluxo.
 *
 * É o caminho do gateway de agente, sem mecanismo novo: o catálogo do núcleo mais o que as extensões
 * instaladas contribuem em `i18n.messages`, de modo que a referência de uma extensão (`@agenda/…`)
 * também traduz. O que não é referência — o texto que o escritório digitou no passo — passa intacto.
 */
export const makeNotificationTextCatalog = (extensions: InstalledExtensionCache): INotificationTextCatalog => ({
  resolverFor: async (tenantId, locale): Promise<NotificationTextResolver> => {
    const catalog = agentCatalog(await extensions.messageBundles(tenantId), locale);
    return (value, params) => agentText(catalog, value, params).text;
  },
});
