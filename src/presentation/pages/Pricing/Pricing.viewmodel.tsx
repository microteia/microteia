import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface PricingPlan {
  name: string;
  price: string;
  priceDetail: string;
  description: string;
  features: string[];
  highlighted: boolean;
}

export interface PricingViewModel {
  plans: PricingPlan[];
  goToLogin: () => void;
}

const PLANS: PricingPlan[] = [
  {
    name: 'Gratuito',
    price: 'R$ 0',
    priceDetail: 'para 1 usuário',
    description: 'Ideal para começar sozinho, com acesso completo ao sistema.',
    features: [
      'Processos, prazos e clientes ilimitados',
      'Calendário, financeiro e contratos',
      'Pushes do Tribunal com IA',
      '1 usuário incluído',
    ],
    highlighted: false,
  },
  {
    name: 'Usuário adicional',
    price: 'R$ 99,90',
    priceDetail: 'por usuário, além do primeiro',
    description: 'Convide advogados e secretários para o seu escritório.',
    features: [
      'Tudo do plano Gratuito',
      'Um valor por cada membro adicional convidado',
      'Perfis de acesso por membro (admin, advogado, secretaria, usuário)',
    ],
    highlighted: true,
  },
];

export const usePricingViewModel = (): PricingViewModel => {
  const navigate = useNavigate();

  const goToLogin = useCallback(() => navigate('/login'), [navigate]);

  return { plans: PLANS, goToLogin };
};
