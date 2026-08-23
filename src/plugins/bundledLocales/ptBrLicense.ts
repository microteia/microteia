import type { PluginRecord } from '../../kernel';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import type { MessageBundle } from '../../domain/schema/i18n/messages';

/**
 * **Termos de Uso em Português (Brasil)** — um plugin SÓ para o documento jurídico, e EMBUTIDO.
 *
 * Ele é separado do pacote de idioma do sistema por dois motivos que se somam: um contrato completo
 * é maior que toda a interface junta, e quem revisa contrato não é quem revisa botão.
 *
 * E ele viaja no bundle, em vez de ser instalado por escritório, por um motivo que só apareceu
 * quando a tela foi testada: `/license` é rota PÚBLICA, servida pelo `LocaleProvider` de cima, que
 * enxerga apenas `CORE_PLUGINS`. Uma extensão instalada num tenant nunca chegaria lá — e é
 * justamente quem ainda não tem conta, clicando em "Termos de Uso" no cadastro, que mais precisa
 * ler o documento na própria língua.
 *
 * O raciocínio de fundo é que instalar por tenant nunca fez sentido aqui: os Termos são o documento
 * DA MICROTEIA, idêntico para todo escritório. Nunca foram dado de tenant.
 *
 * O texto abaixo é o documento que já estava no ar, palavra por palavra. Ele não foi reescrito nesta
 * migração: o que mudou foi de onde ele vem.
 */
const bundle = (namespace: string, messages: Record<string, string>): MessageBundle => ({
  locale: 'pt-BR',
  namespace,
  messages,
});

const CORE_LICENSE: Record<string, string> = {
  'page.title': 'Termos de Uso e Política de Privacidade',
  'updated-at': 'Última atualização: {date}',

  'banner.beta':
    'O Microteia está em fase beta. O sistema pode conter erros, instabilidades ou indisponibilidades temporárias. O uso é por conta e risco do escritório e dos usuários cadastrados.',
  'banner.email-monitor':
    'O monitor de e-mails é uma ferramenta de apoio que identifica e permite que você defina os prazos de forma personalizada. A conferência e a confirmação de todas as informações extraídas — datas, prazos e teor das intimações — são de responsabilidade exclusiva do advogado responsável pelo processo. O Microteia não substitui a conferência humana e não garante que nenhum prazo será perdido.',

  'acceptance.title': '1. Aceitação dos termos',
  'acceptance.text':
    'O Microteia é um sistema de gestão para escritórios de advocacia, oferecido no modelo SaaS (software como serviço), multi-tenant. Ao criar uma conta ou utilizar o sistema, o usuário e o escritório ao qual ele pertence declaram ter lido, compreendido e aceito integralmente estes Termos de Uso e esta Política de Privacidade. Caso não concorde com qualquer cláusula, o usuário não deve utilizar o sistema.',

  'service.title': '2. Descrição do serviço',
  'service.text':
    'O Microteia permite o cadastro e a gestão de clientes, processos, prazos, contratos, lançamentos financeiros e comunicações do escritório, incluindo recursos de apoio baseados em inteligência artificial para leitura e classificação de e-mails, intimações e movimentações processuais. Os dados de cada escritório (tenant) são armazenados de forma isolada dos demais escritórios que utilizam o sistema.',

  'beta.title': '3. Fase beta e limitação de garantias',
  'beta.text': 'O Microteia encontra-se em fase de desenvolvimento e testes (beta). Isso significa que:',
  'beta.item.failures':
    'o sistema pode apresentar falhas, indisponibilidades, perda temporária de dados ou comportamento inesperado;',
  'beta.item.changes': 'funcionalidades podem ser alteradas, suspensas ou descontinuadas sem aviso prévio;',
  'beta.item.uptime':
    'não há garantia de disponibilidade contínua (uptime) nem de ausência total de erros;',
  'beta.item.parallel':
    'recomenda-se fortemente manter controles paralelos e conferência manual de prazos e informações críticas enquanto o sistema estiver em fase beta.',

  'monitor.title': '4. Monitor de e-mails, intimações e prazos',
  'monitor.text':
    'O Microteia oferece um recurso de leitura automática de e-mails e documentos (intimações, pushes de tribunais, notificações) que utiliza inteligência artificial para identificar processos, extrair datas e sugerir prazos. Este recurso é uma ferramenta de apoio à organização do escritório e não uma garantia de acompanhamento processual.',
  'monitor.responsibility': 'É de responsabilidade exclusiva do advogado e do escritório usuário:',
  'monitor.item.check':
    'conferir manualmente todas as intimações, prazos e movimentações identificadas pelo sistema junto aos autos e aos diários oficiais;',
  'monitor.item.confirm':
    'confirmar a exatidão de datas, prazos e informações extraídas automaticamente antes de tomar qualquer decisão processual com base nelas;',
  'monitor.item.own-routines':
    'manter rotinas próprias de controle de prazos, independentemente do uso do Microteia;',
  'monitor.item.official-channels':
    'verificar regularmente a caixa de e-mail e os canais oficiais de intimação, já que falhas de leitura, classificação incorreta ou indisponibilidade do serviço de e-mail ou de terceiros podem ocorrer.',
  'monitor.disclaimer':
    'O Microteia não se responsabiliza por perda de prazo, preclusão, revelia ou qualquer prejuízo processual decorrente de falha, atraso, erro de interpretação da inteligência artificial, indisponibilidade do sistema ou de serviços de terceiros (provedores de e-mail, tribunais, provedores de nuvem), ou pela ausência de conferência humana das informações apresentadas.',

  'account.title': '5. Cadastro e responsabilidade pela conta',
  'account.text':
    'O usuário é responsável pela veracidade dos dados cadastrados, pela guarda de suas credenciais de acesso e por todas as atividades realizadas em sua conta. O escritório (tenant) é responsável por definir corretamente os papéis (admin, advogado, secretaria, usuário) de cada membro e pelas permissões concedidas.',

  'privacy.title': '6. Privacidade e proteção de dados',
  'privacy.text':
    'Coletamos e tratamos dados pessoais em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), incluindo:',
  'privacy.item.account': 'dados de cadastro do usuário (nome, e-mail, foto de perfil);',
  'privacy.item.records':
    'dados inseridos pelo escritório sobre clientes, processos, contratos e financeiro;',
  'privacy.item.email':
    'conteúdo de e-mails e documentos processados pelo monitor de e-mails, para fins de identificação de prazos e movimentações;',
  'privacy.item.audit': 'dados de uso e auditoria do sistema, para fins de segurança e rastreabilidade.',
  'privacy.isolation':
    'Os dados de cada escritório são armazenados de forma isolada dos demais tenants e não são compartilhados com outros escritórios. Os dados podem ser processados por provedores de infraestrutura em nuvem e por serviços de inteligência artificial estritamente necessários ao funcionamento do sistema, sempre sob obrigação contratual de confidencialidade. Não vendemos nem compartilhamos dados pessoais com terceiros para fins de publicidade.',
  'privacy.rights':
    'O titular dos dados pode, a qualquer momento, solicitar acesso, correção, portabilidade ou exclusão de seus dados pessoais, respeitadas as obrigações legais de guarda de informações processuais e fiscais, entrando em contato pelo e-mail indicado ao final destes termos.',

  'security.title': '7. Segurança da informação',
  'security.text':
    'Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados armazenados, incluindo controle de acesso por perfil, isolamento entre escritórios e registro de auditoria. Nenhum sistema é totalmente livre de riscos, e o usuário reconhece que nenhuma medida de segurança garante proteção absoluta contra incidentes.',

  'liability.title': '8. Limitação de responsabilidade',
  'liability.text':
    'Na máxima extensão permitida pela legislação aplicável, o Microteia e seu responsável não se responsabilizam por danos indiretos, lucros cessantes, perda de clientes, perda de prazos processuais ou quaisquer prejuízos decorrentes do uso ou da impossibilidade de uso do sistema, incluindo falhas técnicas, indisponibilidade, erros da inteligência artificial ou de serviços de terceiros. O uso do sistema não substitui o julgamento profissional, a diligência e a conferência manual exigidas do exercício da advocacia.',

  'ip.title': '9. Propriedade intelectual',
  'ip.text':
    'Todo o código-fonte, design, marca e demais elementos do Microteia são protegidos por direitos autorais e pertencem ao seu autor, sendo vedadas a cópia, engenharia reversa, redistribuição ou exploração comercial não autorizada do sistema.',

  'changes.title': '10. Alterações destes termos',
  'changes.text':
    'Estes termos podem ser atualizados a qualquer momento, especialmente durante a fase beta do sistema. A data da última atualização é sempre exibida no topo desta página. O uso continuado do sistema após alterações implica concordância com os novos termos.',

  'law.title': '11. Legislação aplicável',
  'law.text':
    'Estes termos são regidos pelas leis da República Federativa do Brasil, sendo eleito o foro do domicílio do responsável pelo sistema para dirimir eventuais controvérsias, ressalvada disposição legal em contrário.',

  'contact.title': 'Direitos autorais e contato',
  'contact.text':
    'Todos os direitos autorais sobre o Microteia pertencem ao advogado responsável pelo seu desenvolvimento.',
  'contact.email-label': 'E-mail:',
};

export const ptBrLicensePlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'locale.pt-br.license',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Terms and Privacy — Português (Brasil)',
    description: 'Translation of the Terms of Use and the Privacy Policy into Brazilian Portuguese.',
    dependencies: { 'core.i18n': '^1.0.0' },
    contributes: [messageBundleContribution(bundle('core.license', CORE_LICENSE))],
  },
};
