import type { MessageBundle } from '../../domain/schema/i18n/messages';
import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';

/**
 * Os textos do NÚCLEO no idioma-fonte, um módulo por namespace.
 *
 * Eram um arquivo só; viraram uma pasta quando o piloto de ~40 chaves deu lugar à migração inteira e
 * a lista passou de dois mil pares. A razão original de haver UM lugar continua valendo e continua
 * atendida: `buildTranslationPackage` monta o modelo de tradução a partir do CATÁLOGO, não deste
 * arquivo — quem traduz continua recebendo uma lista só, independente de como o repositório a divide.
 *
 * Cada bundle é carimbado com o `namespace` do plugin DONO do texto: quem responde por
 * `core.admin/nav.audit-logs` é o `core.admin`, mesmo que a frase esteja escrita aqui.
 *
 * Toda chave aqui é texto do PRODUTO. O que o escritório digita — nome de tela criada no Form Design,
 * rótulo de campo, opção de lista — não entra e nunca entrará: é dado dele.
 */
export const coreMessage = (namespace: string, messages: Record<string, string>): MessageBundle => ({
  locale: DEFAULT_LOCALE,
  namespace,
  messages,
});

export { CORE_UI_MESSAGES } from './coreUi';
export { CORE_ADMIN_MESSAGES } from './coreAdmin';
export { CORE_MARKETPLACE_MESSAGES } from './coreMarketplace';
export { CORE_RECORDS_MESSAGES } from './coreRecords';
export { CORE_WORKSPACE_MESSAGES } from './coreWorkspace';
export { CORE_SETTINGS_MESSAGES } from './coreSettings';
export { CORE_I18N_MESSAGES } from './coreI18n';
export { CORE_THEME_MESSAGES } from './coreTheme';
export { CORE_AUTOMATION_MESSAGES } from './coreAutomation';
export { CORE_DATA_MESSAGES } from './coreData';
export { CORE_LICENSE_MESSAGES } from './coreLicense';
