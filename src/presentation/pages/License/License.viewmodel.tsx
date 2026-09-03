import { useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLabel, useLocaleFormat } from '../../shared/i18n/useT';
import { usePluginLicenses } from '../../shared/usePluginLicenses';
import type { WidgetSpec } from '../../../domain/schema/ui/widgetSpec';

/**
 * A data da última revisão viaja em ISO e é formatada pelo idioma em vigor — antes era a frase
 * "3 de julho de 2026" escrita à mão, que ficaria em português dentro de um documento traduzido.
 *
 * Mexer nela é declarar que o documento mudou; ela não acompanha o deploy.
 */
const LAST_UPDATED_AT = '2026-09-03';

/** A identidade do autor é DADO, não texto: não traduz, e por isso não entra no catálogo. */
const AUTHOR_NAME = 'Alexnaldo Carvalho dos Santos';
const AUTHOR_EMAIL = 'alexnaldo.santos@gmail.com';

/** Um termo de extensão pronto para a tela: o nome já no idioma em vigor, a árvore como veio. */
export interface ExtensionTerm {
  pluginId: string;
  name: string;
  license: WidgetSpec;
}

export interface LicenseViewModel {
  updatedAt: string;
  authorName: string;
  authorEmail: string;
  showBackButton: boolean;
  goBack: () => void;
  /**
   * Os termos das extensões NO AR neste escritório, anexados ao contrato da Microteia.
   *
   * Vazio na rota pública — ali o host é o de base, e quem ainda não entrou não tem escritório cujas
   * extensões pudessem valer. Ver `usePluginLicenses`.
   */
  extensionTerms: ExtensionTerm[];
}

export const useLicenseViewModel = (): LicenseViewModel => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { formatLongDate } = useLocaleFormat();
  const label = useLabel();
  const licenses = usePluginLicenses();

  const showBackButton = searchParams.get('from') === 'login';

  const extensionTerms = useMemo<ExtensionTerm[]>(
    () => licenses
      .map((entry) => ({ pluginId: entry.pluginId, name: label(entry.name), license: entry.license }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [licenses, label],
  );

  const goBack = useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return {
    updatedAt: formatLongDate(`${LAST_UPDATED_AT}T12:00:00`),
    authorName: AUTHOR_NAME,
    authorEmail: AUTHOR_EMAIL,
    showBackButton,
    goBack,
    extensionTerms,
  };
};
