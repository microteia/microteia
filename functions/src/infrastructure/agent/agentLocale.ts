import { DEFAULT_LOCALE } from '../../domain/schema/i18n/localeNegotiation';
import { getDI } from '../di/container';

const LOCALE_SETTING = 'i18n.locale';

/**
 * O idioma em que o agente responde: `user > tenant > default`.
 *
 * A MESMA ordem do cliente, e sem mecanismo novo — é a propriedade `i18n.locale` que a tela de
 * Configurações já grava. O acesso é de uma pessoa, então o idioma é o dela: um escritório em
 * português com um membro que escolheu inglês recebe cada agente no idioma de quem o emitiu.
 */
export const agentLocale = async (tenantId: string, userId: string): Promise<string> => {
  const settings = getDI().getTenantSettingsRepository();
  const [own, office] = await Promise.all([
    settings.getUserValues(tenantId, userId),
    settings.getTenantValues(tenantId),
  ]);

  for (const values of [own, office]) {
    const chosen = values[LOCALE_SETTING];
    if (typeof chosen === 'string' && chosen.trim() !== '') return chosen;
  }
  return DEFAULT_LOCALE;
};
