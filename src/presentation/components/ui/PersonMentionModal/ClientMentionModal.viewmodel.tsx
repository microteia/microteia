import { useState, useMemo, useCallback } from 'react';
import { usePersonStore } from '../../../../stores/usePersonStore';
import type { Person } from '../../../../domain/entities';

export interface PersonMentionModalProps {
  onSelect: (person: Person) => void;
  onClose: () => void;
}

export interface PersonMentionModalViewModel {
  items: Person[];
  keyword: string;
  setKeyword: (v: string) => void;
  handleSelect: (person: Person) => void;
}

export const usePersonMentionModalViewModel = (props: PersonMentionModalProps): PersonMentionModalViewModel => {
  const { persons } = usePersonStore();
  const [keyword, setKeyword] = useState('');

  const items = useMemo(() => {
    const q = keyword.toLowerCase();
    if (!q) return persons;
    return persons.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.cpf?.includes(q) ?? false) ||
        (c.cnpj?.includes(q) ?? false) ||
        (c.email?.toLowerCase().includes(q) ?? false),
    );
  }, [persons, keyword]);

  const handleSelect = useCallback(
    (person: Person) => { props.onSelect(person); },
    [props],
  );

  return { items, keyword, setKeyword, handleSelect };
};
