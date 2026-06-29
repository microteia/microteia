import { useState, useMemo, useCallback } from 'react';
import { useNews } from '../../../../stores/useNews';
import type { News, NewsCategory } from '../../../../domain/entities';

const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  GENERAL: 'Geral',
  JURISPRUDENCE: 'Jurisprudência',
  LEGISLATION: 'Legislação',
  ANNOUNCEMENT: 'Comunicado',
  CIRCULAR: 'Circular',
};

export interface NewsMentionModalProps {
  onSelect: (news: News) => void;
  onClose: () => void;
}

export interface NewsMentionModalViewModel {
  items: News[];
  keyword: string;
  setKeyword: (v: string) => void;
  handleSelect: (news: News) => void;
  getCategoryLabel: (category: string) => string;
}

export const useNewsMentionModalViewModel = (
  props: NewsMentionModalProps,
): NewsMentionModalViewModel => {
  const { news } = useNews();

  const [keyword, setKeyword] = useState('');

  // Todas as notícias já carregadas pelo NewsStore são visíveis ao usuário atual
  // (sistema ou do tenant selecionado)
  const visibleNews = news;

  const items = useMemo(() => {
    const q = keyword.toLowerCase();
    if (!q) return visibleNews;
    return visibleNews.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.summary.toLowerCase().includes(q),
    );
  }, [visibleNews, keyword]);

  const getCategoryLabel = useCallback(
    (category: string) => NEWS_CATEGORY_LABELS[category as NewsCategory] ?? category,
    [],
  );

  const handleSelect = useCallback(
    (n: News) => {
      props.onSelect(n);
    },
    [props],
  );

  return {
    items,
    keyword,
    setKeyword,
    handleSelect,
    getCategoryLabel,
  };
};
