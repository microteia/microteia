import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../stores/useAuth';
import dashboardImg from '../../../assets/screenshots/dashboard.png';
import calendarioImg from '../../../assets/screenshots/calendario.png';
import financeiroImg from '../../../assets/screenshots/financeiro.png';
import pushesTribunalImg from '../../../assets/screenshots/pushes-tribunal.png';

export interface HomeHighlight {
  title: string;
  description: string;
  image: string;
}

export interface HomeValueProp {
  title: string;
  description: string;
}

export interface HomeViewModel {
  isCheckingSession: boolean;
  heroImage: string;
  valueProps: HomeValueProp[];
  highlights: HomeHighlight[];
  goToLogin: () => void;
  goToFeatures: () => void;
  goToPricing: () => void;
}

const VALUE_PROPS: HomeValueProp[] = [
  {
    title: 'Seu escritório, sem custo',
    description:
      'Crie sua conta e comece a organizar processos, prazos e clientes agora mesmo — o plano para 1 usuário é gratuito.',
  },
  {
    title: 'Faça parte de um escritório',
    description: 'Foi convidado por um colega? Entre com sua conta e comece a trabalhar dentro do escritório dele.',
  },
  {
    title: 'Convide sua equipe',
    description: 'Adicione advogados e secretários ao seu escritório e defina o perfil de cada um.',
  },
];

const HIGHLIGHTS: HomeHighlight[] = [
  {
    title: 'Calendário com arraste e solte',
    description: 'Organize prazos visualmente e mude datas arrastando entre os dias.',
    image: calendarioImg,
  },
  {
    title: 'Financeiro do escritório',
    description: 'Lançamentos, vencimentos e filtros por período em um só lugar.',
    image: financeiroImg,
  },
  {
    title: 'Pushes do Tribunal com IA',
    description: 'A inteligência artificial lê e-mails de tribunais e permite que você defina os prazos de forma personalizada.',
    image: pushesTribunalImg,
  },
];

export const useHomeViewModel = (): HomeViewModel => {
  const navigate = useNavigate();
  const { user, isEmailVerified, loading } = useAuth();

  useEffect(() => {
    if (!loading && user && isEmailVerified) {
      navigate('/app', { replace: true });
    }
  }, [loading, user, isEmailVerified, navigate]);

  const goToLogin = useCallback(() => navigate('/login'), [navigate]);
  const goToFeatures = useCallback(() => navigate('/funcionalidades'), [navigate]);
  const goToPricing = useCallback(() => navigate('/precos'), [navigate]);

  return {
    isCheckingSession: loading || Boolean(user && isEmailVerified),
    heroImage: dashboardImg,
    valueProps: VALUE_PROPS,
    highlights: HIGHLIGHTS,
    goToLogin,
    goToFeatures,
    goToPricing,
  };
};
