import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface ContactViewModel {
  email: string;
  mailtoHref: string;
  goToLogin: () => void;
}

const CONTACT_EMAIL = 'alexnaldo.santos@gmail.com';

export const useContactViewModel = (): ContactViewModel => {
  const navigate = useNavigate();

  const goToLogin = useCallback(() => navigate('/login'), [navigate]);

  return {
    email: CONTACT_EMAIL,
    mailtoHref: `mailto:${CONTACT_EMAIL}`,
    goToLogin,
  };
};
