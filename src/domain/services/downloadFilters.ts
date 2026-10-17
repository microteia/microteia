import type { DownloadItem } from '../schema/document/documentDownloads';

/** O token de filtro como a tela o guarda — a mesma forma do `CompositeFilter`, sem depender dele. */
export interface DownloadFilterToken {
  key: string;
  values: string[];
}

export const DOWNLOAD_FILTER_KEYS = {
  search: 'search',
  createdBy: 'createdBy',
  via: 'via',
  origin: 'origin',
  template: 'template',
  visibility: 'visibility',
  format: 'format',
  createdFrom: 'createdFrom',
  createdTo: 'createdTo',
  expires: 'expires',
} as const;

/** O item que não veio de registro nenhum — o modelo de dados — tem uma "origem" própria no filtro. */
export const NO_ORIGIN = '__none__';

export type DownloadFormat = 'pdf' | 'docx' | 'other';

export type DownloadExpiryWindow = 'day' | 'week' | 'never';

const DAY_MS = 24 * 60 * 60 * 1000;

export const downloadFormatOf = (item: Pick<DownloadItem, 'contentType' | 'name'>): DownloadFormat => {
  const type = item.contentType.toLowerCase();
  if (type === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  if (type.includes('wordprocessingml') || item.name.toLowerCase().endsWith('.docx')) return 'docx';
  return 'other';
};

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O dia LOCAL (`YYYY-MM-DD`) do instante — o que o seletor de data do filtro escreve. */
const localDay = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const withinExpiry = (item: DownloadItem, window: string, now: Date): boolean => {
  if (window === 'never') return item.expiresAt === null;
  if (!item.expiresAt) return false;
  const limit = window === 'day' ? DAY_MS : 7 * DAY_MS;
  return item.expiresAt.getTime() - now.getTime() <= limit;
};

/**
 * Os itens que passam em TODOS os filtros. Dentro de um filtro de vários valores basta um casar —
 * o mesmo "E entre filtros, OU dentro do filtro" das outras listagens. `searchText` deixa a tela
 * acrescentar à busca o que só ela sabe nomear (a tela de origem, o modelo, quem gerou).
 */
export const filterDownloads = (
  items: readonly DownloadItem[],
  tokens: readonly DownloadFilterToken[],
  now: Date,
  searchText: (item: DownloadItem) => string = (item) => item.name,
): DownloadItem[] => {
  const active = tokens.filter((token) => token.values.length > 0);
  if (active.length === 0) return [...items];

  return items.filter((item) => active.every((token) => {
    const values = token.values;
    switch (token.key) {
      case DOWNLOAD_FILTER_KEYS.search: {
        const haystack = normalize(searchText(item));
        return values.every((value) => haystack.includes(normalize(value.trim())));
      }
      case DOWNLOAD_FILTER_KEYS.createdBy:
        return values.includes(item.createdBy);
      case DOWNLOAD_FILTER_KEYS.via:
        return values.includes(item.createdVia);
      case DOWNLOAD_FILTER_KEYS.origin:
        return values.includes(item.origin?.collection ?? NO_ORIGIN);
      case DOWNLOAD_FILTER_KEYS.template:
        return !!item.templateKey && values.includes(item.templateKey);
      case DOWNLOAD_FILTER_KEYS.visibility:
        return values.includes(item.visibility);
      case DOWNLOAD_FILTER_KEYS.format:
        return values.includes(downloadFormatOf(item));
      case DOWNLOAD_FILTER_KEYS.createdFrom:
        return !!item.createdAt && localDay(item.createdAt) >= values[0];
      case DOWNLOAD_FILTER_KEYS.createdTo:
        return !!item.createdAt && localDay(item.createdAt) <= values[0];
      case DOWNLOAD_FILTER_KEYS.expires:
        return values.some((window) => withinExpiry(item, window, now));
      default:
        return true;
    }
  }));
};
