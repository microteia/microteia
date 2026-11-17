import { createContext, useContext } from 'react';

/**
 * As respostas da barra `filters` mais próxima, por chave de filtro, já na forma do relatório
 * (`widgetFilterAnswer`). Fora de uma barra é vazio — e um nó ligado (`bind`) fora dela se comporta como
 * se nada estivesse ligado.
 */
export const WidgetFilterContext = createContext<Readonly<Record<string, unknown>>>({});

export const useWidgetFilterValues = (): Readonly<Record<string, unknown>> => useContext(WidgetFilterContext);

/**
 * A extensão que contribuiu o painel. É o que deixa um filtro de escolha achar a tela do PRÓPRIO pacote
 * depois que a instalação deu outra chave a ela — a contribuição não é reescrita na instalação, o campo
 * é. Ausente (o painel do Marketplace, a licença), vale o nome global.
 */
export const WidgetOwnerContext = createContext<string | undefined>(undefined);

export const useWidgetOwner = (): string | undefined => useContext(WidgetOwnerContext);
