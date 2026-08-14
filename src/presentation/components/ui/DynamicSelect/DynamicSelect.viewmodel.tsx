import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type React from 'react';
import { useAnchoredDropdown, type AnchoredDropdownPosition } from '../../../hooks/useAnchoredDropdown';

import { useT } from '../../../shared/i18n/useT';
export interface DynamicSelectOption {
  value: string;
  label: string;
  color?: string;
  meta?: string;
}

export interface InternalOption extends DynamicSelectOption {
  isDynamic: boolean;
  isOrphan: boolean;
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
  dropPos: AnchoredDropdownPosition;
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
  handleRestoreClick: (e: React.MouseEvent, item: InternalOption) => Promise<void>;
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
  const t = useT('core.ui');
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
  const [pendingDelete, setPendingDelete] = useState<InternalOption | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { dropPos, reposition } = useAnchoredDropdown({ open, anchorRef: wrapperRef, dropdownRef });

  const allOptions = useMemo<InternalOption[]>(() => [
    ...staticOptions.map(o => ({ ...o, isDynamic: false, isOrphan: false })),
    ...dynamicOptions.map(o => ({ ...o, isDynamic: true, isOrphan: false })),
  ], [staticOptions, dynamicOptions]);

  const orphanOptions = useMemo<InternalOption[]>(() => {
    const known = new Set(allOptions.map(o => o.value));
    const selectedValues = multiSelect ? values : (value ? [value] : []);
    return selectedValues
      .filter(v => v && !known.has(v))
      .map(v => ({ value: v, label: v, isDynamic: false, isOrphan: true }));
  }, [allOptions, multiSelect, values, value]);

  const listedOptions = useMemo(() =>
    [...allOptions, ...orphanOptions],
    [allOptions, orphanOptions]
  );

  const filtered = useMemo(() =>
    listedOptions.filter(o =>
      o.label.toLowerCase().includes(query.toLowerCase()) ||
      (o.meta ?? '').toLowerCase().includes(query.toLowerCase())
    ),
    [listedOptions, query]
  );

  const selectedOption = useMemo(() =>
    listedOptions.find(o => o.value === value),
    [listedOptions, value]
  );

  const selectedOptions = useMemo(() =>
    listedOptions.filter(o => values.includes(o.value)),
    [listedOptions, values]
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
      ? t('dynamic-select.option.delete.message', { label: pendingDelete.label })
      : ''
    ),
    [deleteConfirmMessageProp, pendingDelete, t]
  );

  const handleOpen = useCallback(() => {
    if (disabled) return;
    reposition();
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [disabled, reposition]);

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

  const handleRestoreClick = useCallback(async (e: React.MouseEvent, item: InternalOption) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onAdd) return;
    setAddLoading(true);
    try {
      await onAdd(item.label);
    } finally {
      setAddLoading(false);
    }
  }, [onAdd]);

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
    handleRestoreClick,
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
