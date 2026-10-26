import type { MarketplacePlugin } from '../../../domain/entities/MarketplacePlugin';
import { messageBundleContribution } from '../../../domain/schema/i18n/extensionPoints';
import type { MessageBundle } from '../../../domain/schema/i18n/messages';
import { CORE_ACCESS } from './coreAccess';
import { CORE_UI } from './coreUi';
import { CORE_ADMIN } from './coreAdmin';
import { CORE_MARKETPLACE } from './coreMarketplace';
import { CORE_RECORDS } from './coreRecords';
import { CORE_REPORTS } from './coreReports';
import { CORE_DOCUMENTS } from './coreDocuments';
import { CORE_WORKSPACE } from './coreWorkspace';
import { CORE_SETTINGS } from './coreSettings';
import { CORE_I18N } from './coreI18n';
import { CORE_THEME } from './coreTheme';
import { CORE_AUTOMATION } from './coreAutomation';
import { CORE_DATA } from './coreData';

/**
 * **Português (Brasil)** — o primeiro pacote de tradução, e a prova de que o projeto ficou agnóstico
 * de idioma.
 *
 * O português deixou de ser o idioma DO SISTEMA e virou o idioma DE UM PACOTE. Ele se instala,
 * atualiza e desinstala como qualquer extensão; desinstalá-lo devolve a interface ao inglês, que é o
 * idioma-fonte. Não há nada aqui que um pacote de espanhol ou de alemão não pudesse ter — e é
 * exatamente esse o ponto: se o português precisasse de qualquer tratamento especial, o trabalho não
 * estaria feito.
 *
 * Repare no que este pacote NÃO tem: nenhuma tela, nenhum workflow, nenhuma linha de código. Por
 * isso ele não passa pelo gesto de "Revisar e confiar" — não há código para revisar. E por isso a
 * instalação, a atualização e a desinstalação funcionam sem que o instalador saiba que traduções
 * existem: para ele, é um manifest com contribuições, como qualquer outro.
 *
 * A divisão em um módulo por namespace espelha `src/plugins/messages/` de propósito: as duas listas
 * têm de crescer juntas, e `localePilot.test.ts` falha no dia em que uma chave do núcleo não tiver o
 * par correspondente aqui.
 */
const LOCALE = 'pt-BR';

const bundle = (namespace: string, messages: Record<string, string>): MessageBundle => ({
  locale: LOCALE,
  namespace,
  messages,
});

/**
 * A IMPRESSÃO DIGITAL do catálogo, conferida por `npm run verify-messages`.
 *
 * Um pacote de idioma instalado é um retrato congelado no tenant: o Marketplace só oferece
 * atualização quando a VERSÃO muda. Sem esta trava, acrescentar centenas de chaves e esquecer o
 * `version` deixa todo escritório que já instalou preso na tradução antiga, sem aviso nenhum — e
 * o que ele vê é o texto em inglês, que é o comportamento correto de quem não tem a chave.
 *
 * Mudou o conteúdo, a impressão muda; o gate para e cobra o `version` junto.
 */
export const PT_BR_MESSAGES_FINGERPRINT = '97a4c097444f';

export const localePtBrPlugin: MarketplacePlugin = {
  summary:
    'Deixa a Microteia em português do Brasil. Traduz os textos do sistema e pode ser desinstalado a qualquer momento, devolvendo a interface ao inglês.',
  workflows: [],
  manifest: {
    id: 'com.microteia.locale-pt-br',
    version: '1.131.0',
    kernel: '^2.0.0',
    name: 'Português (Brasil)',
    description: 'Tradução da Microteia para português do Brasil.',
    category: '@core.i18n/category.language',
    icon: 'globe',
    publisher: { name: 'Microteia' },
    contributes: [
      messageBundleContribution(bundle('core.access', CORE_ACCESS)),
      messageBundleContribution(bundle('core.ui', CORE_UI)),
      messageBundleContribution(bundle('core.admin', CORE_ADMIN)),
      messageBundleContribution(bundle('core.marketplace', CORE_MARKETPLACE)),
      messageBundleContribution(bundle('core.records', CORE_RECORDS)),
      messageBundleContribution(bundle('core.reports', CORE_REPORTS)),
      messageBundleContribution(bundle('core.documents', CORE_DOCUMENTS)),
      messageBundleContribution(bundle('core.workspace', CORE_WORKSPACE)),
      messageBundleContribution(bundle('core.settings', CORE_SETTINGS)),
      messageBundleContribution(bundle('core.i18n', CORE_I18N)),
      messageBundleContribution(bundle('core.theme', CORE_THEME)),
      messageBundleContribution(bundle('core.automation', CORE_AUTOMATION)),
      messageBundleContribution(bundle('core.data', CORE_DATA)),
    ],
  },
};
