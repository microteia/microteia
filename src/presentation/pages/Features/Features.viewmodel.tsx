import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import dashboardImg from '../../../assets/screenshots/dashboard.png';
import calendarioImg from '../../../assets/screenshots/calendario.png';
import processosImg from '../../../assets/screenshots/processos.png';
import contratosImg from '../../../assets/screenshots/contratos.png';
import financeiroImg from '../../../assets/screenshots/financeiro.png';
import pushesTribunalImg from '../../../assets/screenshots/pushes-tribunal.png';
import noticiasImg from '../../../assets/screenshots/noticias.png';
import auditoriaImg from '../../../assets/screenshots/auditoria.png';
import escritorioMembrosImg from '../../../assets/screenshots/escritorio-membros.png';
import escritorioIaImg from '../../../assets/screenshots/escritorio-ia.png';
import escritorioPushConfigImg from '../../../assets/screenshots/escritorio-push-config.png';
import commandPaletteImg from '../../../assets/screenshots/command-palette.png';

export interface FeatureSection {
  title: string;
  description: string;
  image: string;
}

export interface FeaturesViewModel {
  sections: FeatureSection[];
  goToLogin: () => void;
}

const SECTIONS: FeatureSection[] = [
  {
    title: 'Dashboard',
    description:
      'Uma visão consolidada de processos ativos, pessoas, prazos pendentes e vencidos, com gráficos de análise por período.',
    image: dashboardImg,
  },
  {
    title: 'Calendário',
    description: 'Veja todos os prazos do mês organizados por dia e arraste-os entre datas quando precisar reagendar.',
    image: calendarioImg,
  },
  {
    title: 'Processos',
    description: 'Cadastre processos com polos, fase, valor da causa e vincule pessoas e prazos a cada um.',
    image: processosImg,
  },
  {
    title: 'Contratos',
    description: 'Controle vigência, partes contratantes, valores e tags de cada contrato do escritório.',
    image: contratosImg,
  },
  {
    title: 'Financeiro',
    description: 'Lançamentos financeiros com filtros por vencimento, status e categoria, tudo por escritório.',
    image: financeiroImg,
  },
  {
    title: 'Pushes do Tribunal',
    description: 'A inteligência artificial lê e-mails de tribunais, identifica o processo e permite que você defina os prazos de forma personalizada.',
    image: pushesTribunalImg,
  },
  {
    title: 'Notícias',
    description: 'Acompanhe as novidades e atualizações do sistema direto de dentro do Microteia.',
    image: noticiasImg,
  },
  {
    title: 'Auditoria',
    description: 'Todo evento importante do escritório fica registrado, com data, hora e detalhes da alteração.',
    image: auditoriaImg,
  },
  {
    title: 'Escritório e equipe',
    description: 'Convide advogados e secretários para o seu escritório e defina o perfil de cada membro.',
    image: escritorioMembrosImg,
  },
  {
    title: 'Conexão de IA configurável',
    description: 'Escolha o provedor e o modelo de inteligência artificial usados pelo seu escritório.',
    image: escritorioIaImg,
  },
  {
    title: 'Regras de monitoramento por e-mail',
    description: 'Defina remetentes e assuntos permitidos para controlar o que o monitor de e-mails processa.',
    image: escritorioPushConfigImg,
  },
  {
    title: 'Busca universal',
    description: 'Encontre páginas, processos, contratos e muito mais em segundos com o atalho de busca central.',
    image: commandPaletteImg,
  },
];

export const useFeaturesViewModel = (): FeaturesViewModel => {
  const navigate = useNavigate();

  const goToLogin = useCallback(() => navigate('/login'), [navigate]);

  return { sections: SECTIONS, goToLogin };
};
