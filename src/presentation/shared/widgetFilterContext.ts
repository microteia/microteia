import { createContext, useContext } from 'react';

/**
 * As respostas da barra `filters` mais próxima, por chave de filtro. Fora de uma barra é vazio — e um
 * nó ligado (`bind`) fora dela se comporta como se nada estivesse ligado.
 */
export const WidgetFilterContext = createContext<Readonly<Record<string, string>>>({});

export const useWidgetFilterValues = (): Readonly<Record<string, string>> => useContext(WidgetFilterContext);
