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
 * O texto abaixo acompanha a versão-fonte em `messages/coreLicense.ts` cláusula por cláusula. Toda
 * alteração ali obriga a alteração aqui no MESMO commit: um contrato traduzido pela metade descreve
 * um serviço que não existe.
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
    'O Microteia está em fase beta. O software pode conter erros, instabilidades ou indisponibilidades temporárias. O uso é por conta e risco do escritório e dos usuários cadastrados.',

  'acceptance.title': '1. Aceitação dos termos',
  'acceptance.text':
    'O Microteia é uma plataforma AI-first para aplicações de negócio: cada escritório declara a aplicação de que precisa — telas, coleções, formulários, automações e perfis de acesso — e a estende com extensões instaláveis. O software é licenciado para ser instalado e operado pelo próprio escritório. Ao criar uma conta ou utilizar uma instalação do Microteia, o usuário e o escritório ao qual ele pertence declaram ter lido, compreendido e aceito integralmente estes Termos de Uso e esta Política de Privacidade. Caso não concorde com qualquer cláusula, o usuário não deve utilizar o software.',

  'service.title': '2. Descrição do serviço',
  'service.text':
    'O Microteia não impõe um domínio de negócio: ele oferece a plataforma sobre a qual cada escritório monta a própria aplicação, declarando as telas, coleções, formulários, relatórios, automações e perfis de acesso de que precisa, e instalando extensões criadas por ele mesmo ou por terceiros. Recursos de inteligência artificial apoiam tanto a autoria dessas declarações quanto a leitura, a classificação e o processamento do conteúdo submetido a eles. O que cada extensão faz, e quais dados ela trata, está descrito na própria extensão e nos termos que ela carrega. Uma mesma instalação pode hospedar mais de um escritório (tenant), e os dados de cada um ficam isolados dos demais dentro dela.',

  'install.title': '3. Onde o software roda, e de quem são os dados',
  'install.text':
    'O Microteia é instalado em um projeto de nuvem que pertence ao escritório — o Firebase dele —, e não em um ambiente operado pelo autor do software. Este é o fato mais importante deste contrato, e tudo o que vem abaixo decorre dele:',
  'install.item.project':
    'o projeto de nuvem, a conta de cobrança dele e as credenciais administrativas são do escritório, que também decide em que região os dados ficam hospedados;',
  'install.item.data':
    'todos os dados — registros, arquivos, perfis de acesso, trilha de auditoria e backups — são gravados e permanecem dentro desse projeto, sob controle exclusivo do escritório;',
  'install.item.access':
    'o autor do software não tem acesso permanente à instalação, aos dados nem às credenciais dela, e depende do acesso que o próprio escritório conceder, de forma temporária e explícita, quando pedir suporte;',
  'install.item.operation':
    'disponibilidade, backup, retenção, restauração e o custo dos serviços de nuvem são responsabilidade do escritório que opera a instalação, conforme os termos do provedor de nuvem dele.',

  'beta.title': '4. Fase beta e limitação de garantias',
  'beta.text': 'O Microteia encontra-se em fase de desenvolvimento e testes (beta). Isso significa que:',
  'beta.item.failures':
    'o software pode apresentar falhas, indisponibilidades, perda temporária de dados ou comportamento inesperado;',
  'beta.item.changes': 'funcionalidades podem ser alteradas, suspensas ou descontinuadas sem aviso prévio;',
  'beta.item.uptime':
    'não há garantia de disponibilidade contínua (uptime) nem de ausência total de erros;',
  'beta.item.parallel':
    'recomenda-se fortemente manter controles paralelos e conferência manual das informações críticas enquanto o software estiver em fase beta.',

  'account.title': '5. Contas, perfis e responsabilidades do escritório',
  'account.text':
    'O usuário é responsável pela veracidade dos dados que cadastra, pela guarda de suas credenciais de acesso e por todas as atividades realizadas em sua conta. O escritório é responsável pelos perfis de acesso que cria, pelas permissões concedidas a cada membro, pelo que fazem em seu nome as extensões que instala e as automações que declara, e pelo conteúdo que ele e seus usuários colocam na instalação — inclusive por ter o direito de tratar esse conteúdo.',

  'privacy.title': '6. Proteção de dados',
  'privacy.text':
    'O Microteia é feito para que os dados de uma instalação fiquem nela. Isso é questão de arquitetura, não de promessa:',
  'privacy.item.no-collection':
    'o software não envia ao autor registros, documentos, estatísticas de uso nem dados pessoais do escritório, e não mantém cópia fora da instalação;',
  'privacy.item.processing':
    'os dados são processados pelo provedor de nuvem cujo projeto hospeda a instalação e pelos serviços de inteligência artificial, e-mail ou integração que o próprio escritório configura com as credenciais dele — nunca por serviços que o escritório não habilitou;',
  'privacy.item.extensions':
    'uma extensão que precise de serviço externo o declara nos próprios termos, e instalar a extensão é o que a autoriza: uma extensão desinstalada ou desativada deixa de processar qualquer coisa;',
  'privacy.item.audit':
    'os registros de uso e auditoria existem para segurança e rastreabilidade, e também permanecem dentro da instalação.',
  'privacy.controller':
    'O escritório que opera a instalação é o controlador dos dados nela. É ele que determina o que se coleta, para qual finalidade, por quanto tempo se guarda e quem pode ver, e é ele que responde pela base legal desse tratamento perante os próprios usuários, clientes e autoridades.',
  'privacy.laws':
    'O que a lei de proteção de dados exige varia de país para país, e estes termos não elegem nenhuma delas: o escritório identifica quais leis se aplicam a ele — pelo lugar onde está estabelecido e pelo lugar onde estão seus usuários e as pessoas cujos dados ele trata — e as cumpre, inclusive quanto a nomear encarregado, manter registro das operações de tratamento ou comunicar incidentes.',
  'privacy.rights':
    'Pedido de acesso, correção, portabilidade ou exclusão de dados pessoais deve ser dirigido ao escritório que opera a instalação: ele é o único com acesso aos dados e o único capaz de responder. O autor do software não guarda esses dados nem tem como agir sobre eles.',

  'security.title': '7. Segurança da informação',
  'security.text':
    'O software oferece os mecanismos; operá-los é do escritório. O Microteia traz controle de acesso por permissão, isolamento entre tenants, regras de segurança aplicadas no servidor para dados e arquivos, e trilha de auditoria. Ao lado disso, e não menos decisivas, estão as medidas que só o escritório pode tomar:',
  'security.item.credentials':
    'proteger as credenciais administrativas do projeto de nuvem, e as contas que as detêm;',
  'security.item.permissions':
    'revisar os perfis de acesso que cria, e retirar o acesso de quem sai do escritório;',
  'security.item.extensions':
    'avaliar uma extensão antes de instalá-la — extensão ativa roda dentro da instalação, com o acesso que o escritório lhe deu;',
  'security.item.backup':
    'manter backups cuja restauração ele tenha de fato testado, e aplicar as versões do software que corrigem falhas conhecidas.',
  'security.note':
    'Nenhum sistema é totalmente livre de riscos, e o escritório reconhece que nenhuma medida de segurança garante proteção absoluta contra incidentes. Investigar e comunicar um incidente ocorrido numa instalação cabe ao escritório que a opera.',

  'liability.title': '8. Limitação de responsabilidade',
  'liability.text':
    'Na máxima extensão permitida pela legislação aplicável, o autor do Microteia não se responsabiliza por danos indiretos, lucros cessantes, perda de negócios, perda de prazos, perda ou vazamento de dados, nem por quaisquer prejuízos decorrentes do uso ou da impossibilidade de uso do software — incluindo falhas técnicas, indisponibilidade, erros da inteligência artificial, o comportamento das extensões e automações que o escritório escolheu instalar ou declarar, e os atos ou omissões dos serviços de nuvem e de terceiros contratados pelo escritório. A instalação roda no projeto do próprio escritório e é operada por ele; o autor não a administra. O uso do software não substitui o julgamento profissional, a diligência e a conferência manual exigidos pela atividade que o escritório exerce nele.',

  'ip.title': '9. Propriedade intelectual',
  'ip.text':
    'Todo o código-fonte, design, marca e demais elementos do Microteia são protegidos por direitos autorais e pertencem ao seu autor. O escritório recebe uma licença não exclusiva e não transferível para instalar e usar o software no próprio projeto, para a própria operação; não recebe o direito de redistribuí-lo, sublicenciá-lo ou oferecê-lo como serviço a terceiros. São vedadas a cópia, a engenharia reversa e a exploração comercial não autorizada. Uma extensão criada por terceiro pertence ao próprio autor dela, e seu uso é regido pelos termos que ela carrega.',

  'changes.title': '10. Alterações destes termos',
  'changes.text':
    'Estes termos podem ser atualizados, especialmente durante a fase beta. Cada instalação carrega a versão destes termos que veio com a versão do software que ela roda, e a data da última atualização é sempre exibida no topo desta página. O uso continuado depois de atualizar o software implica concordância com os termos que vieram nele.',

  'law.title': '11. Lei aplicável',
  'law.text':
    'Estes termos não elegem a lei de um único país. Cada parte cumpre a legislação que se aplica a ela, e o escritório que opera a instalação responde pelas exigências da própria jurisdição e daquelas onde estão seus usuários e clientes. Quando norma imperativa da lei aplicável conflitar com uma cláusula destes termos, essa cláusula fica limitada ao mínimo necessário para que o restante permaneça válido. Eventual controvérsia é resolvida, preferencialmente, no domicílio da parte demandada, ressalvada disposição legal em contrário.',

  'extensions.title': 'Termos das extensões instaladas',
  'extensions.text':
    'Cada extensão instalada e ativa neste escritório pode trazer os próprios termos de licença, escritos por quem a criou. Eles são reproduzidos abaixo e se somam aos termos acima — nunca os substituem. Uma extensão desinstalada ou desativada deixa de aparecer aqui, porque os termos dela deixam de valer.',

  'contact.title': 'Direitos autorais e contato',
  'contact.text':
    'Todos os direitos autorais sobre o Microteia pertencem ao autor responsável pelo seu desenvolvimento.',
  'contact.email-label': 'E-mail:',
};

export const ptBrLicensePlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'locale.pt-br.license',
    version: '1.2.0',
    kernel: '^2.0.0',
    name: 'Terms and Privacy — Português (Brasil)',
    description: 'Translation of the Terms of Use and the Privacy Policy into Brazilian Portuguese.',
    dependencies: { 'core.i18n': '^1.0.0' },
    contributes: [messageBundleContribution(bundle('core.license', CORE_LICENSE))],
  },
};
