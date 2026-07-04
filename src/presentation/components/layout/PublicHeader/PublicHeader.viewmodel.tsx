import { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export interface PublicHeaderLink {
  label: string;
  to: string;
}

export interface PublicHeaderViewModel {
  links: PublicHeaderLink[];
  isActive: (to: string) => boolean;
  isMenuOpen: boolean;
  toggleMenu: () => void;
  goTo: (to: string) => void;
  goToLogin: () => void;
}

const LINKS: PublicHeaderLink[] = [
  { label: 'Funcionalidades', to: '/funcionalidades' },
  { label: 'Preços', to: '/precos' },
  { label: 'Contato', to: '/contato' },
];

export const usePublicHeaderViewModel = (): PublicHeaderViewModel => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const goTo = useCallback(
    (to: string) => {
      setIsMenuOpen(false);
      navigate(to);
    },
    [navigate],
  );

  const goToLogin = useCallback(() => {
    setIsMenuOpen(false);
    navigate('/login');
  }, [navigate]);

  const isActive = useCallback((to: string) => location.pathname === to, [location.pathname]);

  return { links: LINKS, isActive, isMenuOpen, toggleMenu, goTo, goToLogin };
};
