import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

export interface PublicFooterLink {
  label: string;
  to: string;
}

export interface PublicFooterViewModel {
  productLinks: PublicFooterLink[];
  legalLinks: PublicFooterLink[];
  contactEmail: string;
  goTo: (to: string) => void;
}

const PRODUCT_LINKS: PublicFooterLink[] = [
  { label: 'Funcionalidades', to: '/funcionalidades' },
  { label: 'Preços', to: '/precos' },
  { label: 'Contato', to: '/contato' },
];

const LEGAL_LINKS: PublicFooterLink[] = [{ label: 'Termos de Uso e Privacidade', to: '/license' }];

const CONTACT_EMAIL = 'alexnaldo.santos@gmail.com';

export const usePublicFooterViewModel = (): PublicFooterViewModel => {
  const navigate = useNavigate();

  const goTo = useCallback(
    (to: string) => {
      navigate(to);
    },
    [navigate],
  );

  return {
    productLinks: PRODUCT_LINKS,
    legalLinks: LEGAL_LINKS,
    contactEmail: CONTACT_EMAIL,
    goTo,
  };
};
