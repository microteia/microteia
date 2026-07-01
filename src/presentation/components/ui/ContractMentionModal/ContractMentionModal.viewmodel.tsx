import { useState, useMemo, useCallback } from 'react';
import { useContractStore } from '../../../../stores/useContractStore';
import type { Contract } from '../../../../domain/entities';

export interface ContractMentionModalProps {
  onSelect: (contract: Contract) => void;
  onClose: () => void;
}

export interface ContractMentionModalViewModel {
  items: Contract[];
  keyword: string;
  setKeyword: (v: string) => void;
  handleSelect: (contract: Contract) => void;
}

export const useContractMentionModalViewModel = (
  props: ContractMentionModalProps,
): ContractMentionModalViewModel => {
  const { contracts } = useContractStore();
  const [keyword, setKeyword] = useState('');

  const items = useMemo(() => {
    const q = keyword.toLowerCase();
    if (!q) return contracts;
    return contracts.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q),
    );
  }, [contracts, keyword]);

  const handleSelect = useCallback(
    (c: Contract) => { props.onSelect(c); },
    [props],
  );

  return { items, keyword, setKeyword, handleSelect };
};
