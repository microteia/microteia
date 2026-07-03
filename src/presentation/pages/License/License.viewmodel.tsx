import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export interface LicenseViewModel {
  updatedAt: string;
  showBackButton: boolean;
  goBack: () => void;
}

export const useLicenseViewModel = (): LicenseViewModel => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const showBackButton = searchParams.get('from') === 'login';

  const goBack = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return {
    updatedAt: '3 de julho de 2026',
    showBackButton,
    goBack,
  };
};
