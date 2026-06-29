import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type React from 'react';

export interface DynamicSelectOption {
  value: string;
  label: string;
  color?: string;
  meta?: string;
}

export interface InternalOption extends DynamicSelectOption {
  isDynamic: boolean;
}

export interface DynamicSelectProps {
  staticOptions?: DynamicSelectOption[];
  dynamicOptions?: DynamicSelectOption[];
  multiSelect?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  values?: string[];
  onChangeMulti?: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  onAdd?: (label: string) => Promise<void>;
  onDelete?: (value: string) => Promise<void>;
  deleteConfirmTitle?: string;
  deleteConfirmMessage?: string;
}

export interface DynamicSelectViewModel {
  open: boolean;
  query: string;
  activeIdx: number;
  dropPos: { top: number; left: number; minWidth: number };
  pendingDelete: InternalOption | null;
  deleteLoading: boolean;
  addLoading: boolean;
  filtered: InternalOption[];
  selectedOption: InternalOption | undefined;
  selectedOptions: InternalOption[];
  canAdd: boolean;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  searchRef: React.RefObject<HTMLInputElement | null>;
  isSelected: (value: string) => boolean;
  handleOpen: () => void;
  handleSelect: (value: string) => void;
  handleClear: (e: React.MouseEvent) => void;
  handleClearAll: (e: React.MouseEvent) => void;
  onQueryChange: (q: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  handleDeleteClick: (e: React.MouseEvent, item: InternalOption) => void;
  handleConfirmDelete: () => Promise<void>;
  handleCancelDelete: () => void;
  handleAdd: () => Promise<void>;
  setActiveIdx: (idx: number) => void;
  placeholder: string;
  disabled: boolean;
  multiSelect: boolean;
  hasOnAdd: boolean;
  hasOnDelete: boolean;
}

export const useDynamicSelectViewModel = (props: DynamicSelectProps): DynamicSelectViewModel => {
  const {
    staticOptions = [],
    dynamicOptions = [],
    multiSelect = false,
    value,
    onChange,
    values = [],
    onChangeMulti,
    placeholder = 'Selecione...',
    disabled = false,
    onAdd,
    onDelete,
    deleteConfirmTitle = 'Excluir item',
    deleteConfirmMessage: deleteConfirmMessageProp,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, minWidth: 0 });
  const [pendingDelete, setPendingDelete] = useState<InternalOption | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allOptions = useMemo<InternalOption[]>(() => [
    ...staticOptions.map(o => ({ ...o, isDynamic: false })),
    ...dynamicOptions.map(o => ({ ...o, isDynamic: true })),
  ], [staticOptions, dynamicOptions]);

  const filtered = useMemo(() =>
    allOptions.filter(o =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.meta ?? '').toLowerCase().includes(query.toLowerCase())
    ),
    [allOptions, query]
  );

  const selectedOption = useMemo(() =>
    allOptions.find(o => o.value === value),
    [allOptions, value]
  );

  const selectedOptions = useMemo(() =>
    allOptions.filter(o => values.includes(o.value)),
    [allOptions, values]
  );

  const isSelected = useCallback((val: string) =>
    multiSelect ? values.includes(val) : value === val,
    [multiSelect, values, value]
  );

  const canAdd = useMemo(() => {
    if (!onAdd || !query.trim()) return false;
    const q = query.trim().toLowerCase();
    return !allOptions.some(o => o.label.toLowerCase() === q);
  }, [onAdd, query, allOptions]);

  const deleteConfirmMessage = useMemo(() =>
    deleteConfirmMessageProp ??
    (pendingDelete
      ? `Deseja excluir "${pendingDelete.label}"? Esta ação não pode ser desfeita.`
      : ''
    ),
    [deleteConfirmMessageProp, pendingDelete]
  );

  const handleOpen = useCallback(() => {
    if (disabled) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setDropPos({ top: rect.bottom + 6, left: rect.left, minWidth: rect.width });
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [disabled]);

  const handleSelect = useCallback((val: string) => {
    if (multiSelect) {
      const next = values.includes(val)
        ? values.filter(v => v !== val)
        : [...values, val];
      onChangeMulti?.(next);
    } else {
      onChange?.(val);
      setOpen(false);
      setQuery('');
    }
  }, [multiSelect, values, onChangeMulti, onChange]);

  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.('');
  }, [onChange]);

  const handleClearAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeMulti?.([]);
  }, [onChangeMulti]);

  const onQueryChange = useCallback((q: string) => setQuery(q), []);

  const handleAdd = useCallback(async () => {
    if (!onAdd || !query.trim()) return;
    setAddLoading(true);
    try {
      await onAdd(query.trim());
      setQuery('');
      setActiveIdx(0);
    } finally {
      setAddLoading(false);
    }
  }, [onAdd, query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const maxIdx = filtered.length - 1 + (canAdd ? 1 : 0);
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, maxIdx)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (canAdd && activeIdx === filtered.length) {
        void handleAdd();
      } else if (filtered[activeIdx]) {
        handleSelect(filtered[activeIdx].value);
      }
    }
    if (e.key === 'Escape') setOpen(false);
  }, [filtered, canAdd, activeIdx, handleAdd, handleSelect]);

  const handleDeleteClick = useCallback((e: React.MouseEvent, item: InternalOption) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
    setPendingDelete(item);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDelete || !onDelete) return;
    setDeleteLoading(true);
    try {
      await onDelete(pendingDelete.value);
    } finally {
      setDeleteLoading(false);
      setPendingDelete(null);
    }
  }, [pendingDelete, onDelete]);

  const handleCancelDelete = useCallback(() => setPendingDelete(null), []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inWrapper = wrapperRef.current?.contains(e.target as Node);
      const inDropdown = dropdownRef.current?.contains(e.target as Node);
      if (!inWrapper && !inDropdown) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleScroll = (e: Event) => {
      if (dropdownRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const timer = setTimeout(() => window.addEventListener('scroll', handleScroll, true), 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting cursor index synchronously when search input changes is architecturally required
    setActiveIdx(0);
  }, [query]);

  return {
    open,
    query,
    activeIdx,
    dropPos,
    pendingDelete,
    deleteLoading,
    addLoading,
    filtered,
    selectedOption,
    selectedOptions,
    canAdd,
    deleteConfirmTitle,
    deleteConfirmMessage,
    wrapperRef,
    dropdownRef,
    searchRef,
    isSelected,
    handleOpen,
    handleSelect,
    handleClear,
    handleClearAll,
    onQueryChange,
    handleKeyDown,
    handleDeleteClick,
    handleConfirmDelete,
    handleCancelDelete,
    handleAdd,
    setActiveIdx,
    placeholder,
    disabled,
    multiSelect,
    hasOnAdd: !!onAdd,
    hasOnDelete: !!onDelete,
  };
};
