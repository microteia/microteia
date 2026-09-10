import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { SETTINGS_NAMESPACE } from './settingsMessages';

/** **Portuguese (Brazil) for the Settings example** — the translation travels inside the package. */
const SETTINGS_PT_BR: Record<string, string> = {
  'package.name': 'Configuração, pelo exemplo',
  'package.category': 'Configuração',
  'package.description':
    'Uma seção de configurações com cada tipo de propriedade que a plataforma edita — e os termos de licença que este pacote pede que o escritório aceite.',
  'package.summary':
    'Como uma extensão é configurada sem trazer uma tela para isso. A tela de Configurações é um hospedeiro genérico: ela não conhece nenhuma configuração em particular, e se nada for contribuído ela está vazia por definição. Este pacote declara uma seção com um de cada tipo de propriedade que o editor sabe desenhar, nos dois escopos, e carrega os termos que pede que o escritório aceite antes de instalar.',

  'section.title': 'Exemplo de configurações',
  'section.description': 'Um de cada tipo de propriedade, para que o editor possa ser lido em vez de adivinhado.',

  'prop.enabled': 'Ativado',
  'prop.enabled.description': 'Um interruptor. Nos dois escopos, para que uma pessoa possa diferir do padrão do escritório.',
  'prop.batch': 'Tamanho do lote',
  'prop.batch.description': 'Um número com limites. Só do escritório — é sobre a instalação, não sobre uma pessoa.',
  'prop.label': 'Título do relatório',
  'prop.label.description': 'Texto livre.',
  'prop.mode': 'Modo',
  'prop.mode.description': 'Uma lista fechada de escolhas.',
  'prop.mode.strict': 'Estrito',
  'prop.mode.lenient': 'Tolerante',
  'prop.senders': 'Remetentes permitidos',
  'prop.senders.description':
    'Uma lista de textos, validada item a item. Existe para que uma extensão que precisa de "vários endereços" não tenha de pedir um bloco de JSON.',
  'prop.senders.placeholder': 'alguem@exemplo.com',
  'prop.extra': 'Avançado',
  'prop.extra.description': 'O que o vocabulário acima não diz — a saída de emergência, e o último recurso.',

  'licence.heading': 'Termos do exemplo de configurações',
  'licence.body':
    'Este exemplo é material de leitura, sem garantia de espécie alguma. Ele não guarda dado próprio e não envia nada a lugar nenhum.\n\nOs termos declarados por uma extensão SOMAM-SE aos que a Microteia já pede — nunca os substituem.',
};

export const settingsPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: SETTINGS_NAMESPACE,
    messages: SETTINGS_PT_BR,
  });
