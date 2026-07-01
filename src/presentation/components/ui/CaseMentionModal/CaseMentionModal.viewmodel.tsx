import { useState, useMemo, useCallback } from 'react';
import { useCaseStore } from '../../../../stores/useCaseStore';
import type { Case } from '../../../../domain/entities';

export interface CaseMentionModalProps {
  onSelect: (case_: Case) => void;
  onClose: () => void;
}

export interface CaseMentionModalViewModel {
  items: Case[];
  keyword: string;
  setKeyword: (v: string) => void;
  handleSelect: (case_: Case) => void;
}

export const useCaseMentionModalViewModel = (
  props: CaseMentionModalProps,
): CaseMentionModalViewModel => {
  const { cases } = useCaseStore();
  const [keyword, setKeyword] = useState('');

  const items = useMemo(() => {
    const q = keyword.toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.caseNumber.toLowerCase().includes(q),
    );
  }, [cases, keyword]);

  const handleSelect = useCallback(
    (c: Case) => { props.onSelect(c); },
    [props],
  );

  return { items, keyword, setKeyword, handleSelect };
};
