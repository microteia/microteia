import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import type { MessageBundle } from '../../domain/schema/i18n/messages';

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
 * Repare no que este arquivo NÃO tem: nenhuma tela, nenhum workflow, nenhuma linha de código. Por
 * isso ele não passa pelo gesto de "Revisar e confiar" — não há código para revisar. E por isso a
 * instalação, a atualização e a desinstalação funcionam sem que o instalador saiba que traduções
 * existem: para ele, é um manifest com contribuições, como qualquer outro.
 */
const LOCALE = 'pt-BR';

const bundle = (namespace: string, messages: Record<string, string>): MessageBundle => ({
  locale: LOCALE,
  namespace,
  messages,
});

const CORE_UI: Record<string, string> = {
  'action.save': 'Salvar',
  'action.cancel': 'Cancelar',
  'action.delete': 'Excluir',
  'action.close': 'Fechar',
  'select.placeholder': 'Selecione...',
};

const CORE_ADMIN: Record<string, string> = {
  'page.tenant-settings': 'Escritório',
  'page.access-management': 'Gestão de Acessos',
  'page.audit-logs': 'Auditoria',
  'page.data-processor': 'Processador de Dados',
  'nav.tenant-settings': 'Escritório',
  'nav.audit-logs': 'Auditoria',
};

const CORE_MARKETPLACE: Record<string, string> = {
  'page.marketplace': 'Extensões',
  'page.plugin-author': 'Criar extensão',
  'page.plugin-author-edit': 'Editar extensão',
};

const CORE_RECORDS: Record<string, string> = {
  'page.screen-builder': 'Form Design',
  'page.dynamic-list': 'Tela personalizada',
  'page.dynamic-new': 'Novo registro',
  'page.dynamic-record': 'Registro',
};

const CORE_WORKSPACE: Record<string, string> = {
  'page.profile': 'Meu Perfil',
};

const CORE_SETTINGS: Record<string, string> = {
  'page.settings': 'Configurações',
  'nav.settings': 'Configurações',
};

const CORE_I18N: Record<string, string> = {
  'section.title': 'Idioma e região',
  'section.description':
    'Como este escritório lê texto, datas e valores. A preferência pessoal, quando existir, vence a do escritório.',
  'locale.label': 'Idioma',
  'locale.description':
    'Os idiomas disponíveis vêm dos pacotes de tradução instalados. Texto sem tradução aparece no idioma original.',
  'timezone.label': 'Fuso horário',
  'timezone.description':
    'Usado para decidir a que dia pertence um instante. Em branco, vale o fuso de quem está com a tela aberta.',
  'page.translations': 'Traduções',
  'nav.translations': 'Traduções',
};

export const localePtBrPlugin: MarketplacePlugin = {
  summary:
    'Deixa a Microteia em português do Brasil. Traduz os textos do sistema e pode ser desinstalado a qualquer momento, devolvendo a interface ao inglês.',
  workflows: [],
  manifest: {
    id: 'com.microteia.locale-pt-br',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Português (Brasil)',
    description: 'Tradução da Microteia para português do Brasil.',
    icon: 'globe',
    publisher: { name: 'Microteia' },
    contributes: [
      messageBundleContribution(bundle('core.ui', CORE_UI)),
      messageBundleContribution(bundle('core.admin', CORE_ADMIN)),
      messageBundleContribution(bundle('core.marketplace', CORE_MARKETPLACE)),
      messageBundleContribution(bundle('core.records', CORE_RECORDS)),
      messageBundleContribution(bundle('core.workspace', CORE_WORKSPACE)),
      messageBundleContribution(bundle('core.settings', CORE_SETTINGS)),
      messageBundleContribution(bundle('core.i18n', CORE_I18N)),
    ],
  },
};
