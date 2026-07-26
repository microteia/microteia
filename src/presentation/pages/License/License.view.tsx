import React from 'react';
import { RiArrowLeftLine } from 'react-icons/ri';
import { useLicenseViewModel } from './License.viewmodel';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { S } from './License.styles';

export const LicenseView: React.FC = () => {
  const vm = useLicenseViewModel();

  return (
    <S.Page>
      <S.Card>
        {vm.showBackButton && (
          <S.BackLink onClick={vm.goBack}>
            <RiArrowLeftLine /> Voltar
          </S.BackLink>
        )}

        <S.Logo>
          <img src="/logo.png" alt="Microteia" style={{ width: '64px', height: '64px' }} />
        </S.Logo>

        <S.Title>Termos de Uso e Política de Privacidade</S.Title>
        <S.UpdatedAt>Última atualização: {vm.updatedAt}</S.UpdatedAt>

        <S.BannerGroup>
          <InfoBanner
            variant="warning"
            message="O Microteia está em fase beta. O sistema pode conter erros, instabilidades ou indisponibilidades temporárias. O uso é por conta e risco do escritório e dos usuários cadastrados."
          />
          <InfoBanner
            variant="warning"
            message="O monitor de e-mails é uma ferramenta de apoio que identifica e permite que você defina os prazos de forma personalizada. A conferência e a confirmação de todas as informações extraídas — datas, prazos e teor das intimações — são de responsabilidade exclusiva do advogado responsável pelo processo. O Microteia não substitui a conferência humana e não garante que nenhum prazo será perdido."
          />
        </S.BannerGroup>

        <S.Section>
          <S.SectionTitle>1. Aceitação dos termos</S.SectionTitle>
          <S.Paragraph>
            O Microteia é um sistema de gestão para escritórios de advocacia, oferecido no modelo SaaS
            (software como serviço), multi-tenant. Ao criar uma conta ou utilizar o sistema, o usuário e o
            escritório ao qual ele pertence declaram ter lido, compreendido e aceito integralmente estes
            Termos de Uso e esta Política de Privacidade. Caso não concorde com qualquer cláusula, o usuário
            não deve utilizar o sistema.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>2. Descrição do serviço</S.SectionTitle>
          <S.Paragraph>
            O Microteia permite o cadastro e a gestão de clientes, processos, prazos, contratos, lançamentos
            financeiros e comunicações do escritório, incluindo recursos de apoio baseados em inteligência
            artificial para leitura e classificação de e-mails, intimações e movimentações processuais. Os
            dados de cada escritório (tenant) são armazenados de forma isolada dos demais escritórios que
            utilizam o sistema.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>3. Fase beta e limitação de garantias</S.SectionTitle>
          <S.Paragraph>
            O Microteia encontra-se em fase de desenvolvimento e testes (beta). Isso significa que:
          </S.Paragraph>
          <S.List>
            <S.ListItem>o sistema pode apresentar falhas, indisponibilidades, perda temporária de dados ou comportamento inesperado;</S.ListItem>
            <S.ListItem>funcionalidades podem ser alteradas, suspensas ou descontinuadas sem aviso prévio;</S.ListItem>
            <S.ListItem>não há garantia de disponibilidade contínua (uptime) nem de ausência total de erros;</S.ListItem>
            <S.ListItem>recomenda-se fortemente manter controles paralelos e conferência manual de prazos e informações críticas enquanto o sistema estiver em fase beta.</S.ListItem>
          </S.List>
        </S.Section>

        <S.Section>
          <S.SectionTitle>4. Monitor de e-mails, intimações e prazos</S.SectionTitle>
          <S.Paragraph>
            O Microteia oferece um recurso de leitura automática de e-mails e documentos (intimações, pushes
            de tribunais, notificações) que utiliza inteligência artificial para identificar processos,
            extrair datas e sugerir prazos. Este recurso é uma ferramenta de apoio à organização do escritório
            e não uma garantia de acompanhamento processual.
          </S.Paragraph>
          <S.Paragraph>
            É de responsabilidade exclusiva do advogado e do escritório usuário:
          </S.Paragraph>
          <S.List>
            <S.ListItem>conferir manualmente todas as intimações, prazos e movimentações identificadas pelo sistema junto aos autos e aos diários oficiais;</S.ListItem>
            <S.ListItem>confirmar a exatidão de datas, prazos e informações extraídas automaticamente antes de tomar qualquer decisão processual com base nelas;</S.ListItem>
            <S.ListItem>manter rotinas próprias de controle de prazos, independentemente do uso do Microteia;</S.ListItem>
            <S.ListItem>verificar regularmente a caixa de e-mail e os canais oficiais de intimação, já que falhas de leitura, classificação incorreta ou indisponibilidade do serviço de e-mail ou de terceiros podem ocorrer.</S.ListItem>
          </S.List>
          <S.Paragraph>
            O Microteia não se responsabiliza por perda de prazo, preclusão, revelia ou qualquer prejuízo
            processual decorrente de falha, atraso, erro de interpretação da inteligência artificial,
            indisponibilidade do sistema ou de serviços de terceiros (provedores de e-mail, tribunais,
            provedores de nuvem), ou pela ausência de conferência humana das informações apresentadas.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>5. Cadastro e responsabilidade pela conta</S.SectionTitle>
          <S.Paragraph>
            O usuário é responsável pela veracidade dos dados cadastrados, pela guarda de suas credenciais de
            acesso e por todas as atividades realizadas em sua conta. O escritório (tenant) é responsável por
            definir corretamente os papéis (admin, advogado, secretaria, usuário) de cada membro e pelas
            permissões concedidas.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>6. Privacidade e proteção de dados</S.SectionTitle>
          <S.Paragraph>
            Coletamos e tratamos dados pessoais em conformidade com a Lei Geral de Proteção de Dados
            (Lei nº 13.709/2018 — LGPD), incluindo:
          </S.Paragraph>
          <S.List>
            <S.ListItem>dados de cadastro do usuário (nome, e-mail, foto de perfil);</S.ListItem>
            <S.ListItem>dados inseridos pelo escritório sobre clientes, processos, contratos e financeiro;</S.ListItem>
            <S.ListItem>conteúdo de e-mails e documentos processados pelo monitor de e-mails, para fins de identificação de prazos e movimentações;</S.ListItem>
            <S.ListItem>dados de uso e auditoria do sistema, para fins de segurança e rastreabilidade.</S.ListItem>
          </S.List>
          <S.Paragraph>
            Os dados de cada escritório são armazenados de forma isolada dos demais tenants e não são
            compartilhados com outros escritórios. Os dados podem ser processados por provedores de
            infraestrutura em nuvem e por serviços de inteligência artificial estritamente necessários ao
            funcionamento do sistema, sempre sob obrigação contratual de confidencialidade. Não vendemos nem
            compartilhamos dados pessoais com terceiros para fins de publicidade.
          </S.Paragraph>
          <S.Paragraph>
            O titular dos dados pode, a qualquer momento, solicitar acesso, correção, portabilidade ou
            exclusão de seus dados pessoais, respeitadas as obrigações legais de guarda de informações
            processuais e fiscais, entrando em contato pelo e-mail indicado ao final destes termos.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>7. Segurança da informação</S.SectionTitle>
          <S.Paragraph>
            Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados armazenados,
            incluindo controle de acesso por perfil, isolamento entre escritórios e registro de auditoria.
            Nenhum sistema é totalmente livre de riscos, e o usuário reconhece que nenhuma medida de
            segurança garante proteção absoluta contra incidentes.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>8. Limitação de responsabilidade</S.SectionTitle>
          <S.Paragraph>
            Na máxima extensão permitida pela legislação aplicável, o Microteia e seu responsável não se
            responsabilizam por danos indiretos, lucros cessantes, perda de clientes, perda de prazos
            processuais ou quaisquer prejuízos decorrentes do uso ou da impossibilidade de uso do sistema,
            incluindo falhas técnicas, indisponibilidade, erros da inteligência artificial ou de serviços de
            terceiros. O uso do sistema não substitui o julgamento profissional, a diligência e a conferência
            manual exigidas do exercício da advocacia.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>9. Propriedade intelectual</S.SectionTitle>
          <S.Paragraph>
            Todo o código-fonte, design, marca e demais elementos do Microteia são protegidos por direitos
            autorais e pertencem ao seu autor, sendo vedadas a cópia, engenharia reversa, redistribuição ou
            exploração comercial não autorizada do sistema.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>10. Alterações destes termos</S.SectionTitle>
          <S.Paragraph>
            Estes termos podem ser atualizados a qualquer momento, especialmente durante a fase beta do
            sistema. A data da última atualização é sempre exibida no topo desta página. O uso continuado do
            sistema após alterações implica concordância com os novos termos.
          </S.Paragraph>
        </S.Section>

        <S.Section>
          <S.SectionTitle>11. Legislação aplicável</S.SectionTitle>
          <S.Paragraph>
            Estes termos são regidos pelas leis da República Federativa do Brasil, sendo eleito o foro do
            domicílio do responsável pelo sistema para dirimir eventuais controvérsias, ressalvada disposição
            legal em contrário.
          </S.Paragraph>
        </S.Section>

        <S.Divider />

        <S.Section>
          <S.SectionTitle>Direitos autorais e contato</S.SectionTitle>
          <S.Paragraph>
            Todos os direitos autorais sobre o Microteia pertencem ao advogado responsável pelo seu
            desenvolvimento.
          </S.Paragraph>
          <S.ContactCard>
            <p><strong>Alexnaldo Carvalho dos Santos</strong></p>
            <p>OAB/BA 56.834</p>
            <p>E-mail: alexnaldo.santos@gmail.com</p>
          </S.ContactCard>
        </S.Section>
      </S.Card>
    </S.Page>
  );
};
