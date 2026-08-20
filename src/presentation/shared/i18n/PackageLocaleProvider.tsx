import React, { useMemo } from 'react';
import type { MessageCatalog } from '../../../domain/schema/i18n/messages';
import { LocaleContext, useOptionalLocale } from '../../../stores/useLocale';

interface PackageLocaleProviderProps {
  catalog: MessageCatalog;
  children: React.ReactNode;
}

/**
 * Troca o catálogo em vigor dentro de uma SUBÁRVORE, mantendo o resto do contexto de idioma intacto.
 *
 * Existe para o que a tela não resolve por conta própria. Nome e resumo de uma extensão são strings
 * que o ViewModel já entrega prontas; a descrição rica dela é uma Widget DSL renderizada pelo
 * `WidgetRenderer`, que resolve os rótulos dele mesmo, no ponto de render — e ali a única forma de
 * lhe dar o catálogo do pacote é pelo contexto. Ver `usePackageCatalog`.
 */
export const PackageLocaleProvider: React.FC<PackageLocaleProviderProps> = ({ catalog, children }) => {
  const base = useOptionalLocale();
  const value = useMemo(() => ({ ...base, catalog }), [base, catalog]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};
