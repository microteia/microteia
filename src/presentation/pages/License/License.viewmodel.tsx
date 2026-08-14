import { useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLocaleFormat } from '../../shared/i18n/useT';

/**
 * A data da última revisão viaja em ISO e é formatada pelo idioma em vigor — antes era a frase
 * "3 de julho de 2026" escrita à mão, que ficaria em português dentro de um documento traduzido.
 *
 * Mexer nela é declarar que o documento mudou; ela não acompanha o deploy.
 */
const LAST_UPDATED_AT = '2026-07-03';

/** A identidade do autor é DADO, não texto: não traduz, e por isso não entra no catálogo. */
const AUTHOR_NAME = 'Alexnaldo Carvalho dos Santos';
const AUTHOR_REGISTRATION = 'OAB/BA 56.834';
const AUTHOR_EMAIL = 'alexnaldo.santos@gmail.com';

export interface LicenseViewModel {
  updatedAt: string;
  authorName: string;
  authorRegistration: string;
  authorEmail: string;
  showBackButton: boolean;
  goBack: () => void;
}

export const useLicenseViewModel = (): LicenseViewModel => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatLongDate } = useLocaleFormat();

  const showBackButton = searchParams.get('from') === 'login';

  const goBack = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return {
    updatedAt: formatLongDate(`${LAST_UPDATED_AT}T12:00:00`),
    authorName: AUTHOR_NAME,
    authorRegistration: AUTHOR_REGISTRATION,
    authorEmail: AUTHOR_EMAIL,
    showBackButton,
    goBack,
  };
};
