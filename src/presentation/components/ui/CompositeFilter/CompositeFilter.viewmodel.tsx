import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useSavedFilter } from '../../../../stores/useSavedFilter';
import type { SavedFilter } from '../../../../domain/entities';
import { useAnchoredDropdown, type AnchoredDropdownPosition } from '../../../hooks/useAnchoredDropdown';

export type FilterType = 'select' | 'multiselect' | 'text' | 'date';

export interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

export interface FilterDef {
  key: string;
  label: string;
  type: FilterType;
  options?: FilterOption[];
  placeholder?: string;
}

export interface FilterToken {
  key: string;
  values: string[];
}

export type { SavedFilter };

type Phase = 'idle' | 'filter-select' | 'value-select';

export interface CompositeFilterViewModel {
  phase: Phase;
  inputValue: string;
  activeDef: FilterDef | null;
  pendingMulti: string[];
  activeIdx: number;
  filteredDefs: FilterDef[];
  filteredOptions: FilterOption[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  dateInputRef: React.RefObject<HTMLInputElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  dropPos: AnchoredDropdownPosition;
  screenFilters: SavedFilter[];
  isSaving: boolean;
  saveName: string;
  saveInputRef: React.RefObject<HTMLInputElement | null>;
  onContainerClick: () => void;
  onInputFocus: () => void;
  onInputChange: (v: string) => void;
  onInputKeyDown: (e: React.KeyboardEvent) => void;
  onSelectDef: (def: FilterDef) => void;
  onToggleMulti: (value: string) => void;
  onDateChange: (value: string) => void;
  onConfirmMulti: () => void;
  onRemoveToken: (key: string, value?: string) => void;
  onEditToken: (key: string) => void;
  onClearAll: () => void;
  onMouseEnterOption: (idx: number) => void;
  onStartSave: () => void;
  onSaveNameChange: (name: string) => void;
  onConfirmSave: () => void;
  onCancelSave: () => void;
  onSaveInputKeyDown: (e: React.KeyboardEvent) => void;
  onApplySavedFilter: (filter: SavedFilter) => void;
  onRemoveSavedFilter: (id: string) => void;
}

export const useCompositeFilterViewModel = (
  defs: FilterDef[],
  tokens: FilterToken[],
  onChange: (tokens: FilterToken[]) => void,
  screenKey?: string | null,
): CompositeFilterViewModel => {
  const { filters, saveFilter, removeFilter } = useSavedFilter();

  const [phase, setPhase] = useState<Phase>('idle');
  const [inputValue, setInputValue] = useState('');
  const [activeDef, setActiveDef] = useState<FilterDef | null>(null);
  const [pendingMulti, setPendingMulti] = useState<string[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [lastAppliedFilter, setLastAppliedFilter] = useState<{ id: string; name: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const saveInputRef = useRef<HTMLInputElement>(null);

  const isOpen = phase !== 'idle' || isSaving;
  const { dropPos, reposition } = useAnchoredDropdown({
    open: isOpen,
    anchorRef: containerRef,
    dropdownRef,
    desiredMaxHeight: 480,
  });

  const screenFilters = useMemo(
    () => (screenKey ? filters.filter((f) => f.screenKey === screenKey) : []),
    [filters, screenKey],
  );

  const filteredDefs = defs.filter((d) =>
    d.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const filteredOptions = (activeDef?.options ?? []).filter((o) =>
    o.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const close = useCallback(() => {
    setPhase('idle');
    setInputValue('');
    setActiveDef(null);
    setPendingMulti([]);
    setActiveIdx(0);
    setIsSaving(false);
    setSaveName('');
    inputRef.current?.blur();
  }, []);

  const open = useCallback(() => {
    reposition();
    setPhase('filter-select');
    setInputValue('');
    setActiveIdx(0);
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [reposition]);

  const upsertToken = useCallback(
    (key: string, values: string[]) => {
      const exists = tokens.some((t) => t.key === key);
      onChange(
        exists
          ? tokens.map((t) => (t.key === key ? { key, values } : t))
          : [...tokens, { key, values }],
      );
    },
    [tokens, onChange],
  );

  const applyPending = useCallback(() => {
    if (!activeDef || activeDef.type === 'text') return;
    const hasValue = activeDef.type === 'date' ? Boolean(pendingMulti[0]) : pendingMulti.length > 0;
    if (hasValue) {
      upsertToken(activeDef.key, pendingMulti);
    } else {
      onChange(tokens.filter((t) => t.key !== activeDef.key));
    }
  }, [activeDef, pendingMulti, upsertToken, onChange, tokens]);

  const onConfirmMulti = useCallback(() => {
    applyPending();
    close();
  }, [applyPending, close]);

  const enterValueSelect = useCallback(
    (def: FilterDef) => {
      const currentValues = tokens.find((t) => t.key === def.key)?.values ?? [];
      if (def.type === 'text') {
        setInputValue(currentValues[0] ?? '');
      } else if (def.type === 'date') {
        setPendingMulti(currentValues.length === 1 ? [...currentValues] : ['']);
        setInputValue('');
      } else {
        setPendingMulti([...currentValues]);
        setInputValue('');
      }
      setActiveDef(def);
      setPhase('value-select');
      setActiveIdx(0);
      if (def.type === 'date') {
        setTimeout(() => dateInputRef.current?.focus(), 20);
      } else {
        setTimeout(() => inputRef.current?.focus(), 20);
      }
    },
    [tokens],
  );

  const onSelectDef = enterValueSelect;

  const onEditToken = useCallback(
    (key: string) => {
      const def = defs.find((d) => d.key === key);
      if (def) enterValueSelect(def);
    },
    [defs, enterValueSelect],
  );

  const onContainerClick = useCallback(() => {
    if (phase === 'idle') open();
    else inputRef.current?.focus();
  }, [phase, open]);

  const onInputFocus = useCallback(() => {
    if (phase === 'idle') reposition();
    setPhase((prev) => (prev === 'idle' ? 'filter-select' : prev));
  }, [phase, reposition]);

  const onInputChange = useCallback((v: string) => {
    setInputValue(v);
    setActiveIdx(0);
  }, []);

  const onToggleMulti = useCallback((value: string) => {
    setPendingMulti((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const onRemoveToken = useCallback(
    (key: string, value?: string) => {
      if (value === undefined) {
        onChange(tokens.filter((t) => t.key !== key));
        return;
      }
      const token = tokens.find((t) => t.key === key);
      if (!token) return;
      const newValues = token.values.filter((v) => v !== value);
      onChange(
        newValues.length === 0
          ? tokens.filter((t) => t.key !== key)
          : tokens.map((t) => (t.key === key ? { key, values: newValues } : t)),
      );
    },
    [tokens, onChange],
  );

  const onClearAll = useCallback(() => {
    onChange([]);
    setLastAppliedFilter(null);
    close();
  }, [onChange, close]);

  const onInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (phase === 'value-select' && activeDef?.type !== 'text') {
          applyPending();
        }
        close();
        return;
      }

      if (phase === 'filter-select') {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIdx((i) => Math.min(i + 1, filteredDefs.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredDefs[activeIdx]) onSelectDef(filteredDefs[activeIdx]);
        } else if (e.key === 'Backspace' && inputValue === '' && tokens.length > 0) {
          onChange(tokens.slice(0, -1));
        }
        return;
      }

      if (phase === 'value-select' && activeDef) {
        if (activeDef.type === 'text') {
          if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            upsertToken(activeDef.key, [inputValue.trim()]);
            close();
          } else if (e.key === 'Backspace' && inputValue === '') {
            setPhase('filter-select');
            setActiveDef(null);
            setInputValue('');
            setActiveIdx(0);
          }
        } else {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIdx((i) => Math.min(i + 1, filteredOptions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === 'Enter' && filteredOptions[activeIdx]) {
            e.preventDefault();
            onToggleMulti(filteredOptions[activeIdx].value);
          } else if (e.key === 'Backspace' && inputValue === '') {
            setPhase('filter-select');
            setActiveDef(null);
            setPendingMulti([]);
            setInputValue('');
            setActiveIdx(0);
          }
        }
      }
    },
    [
      phase, activeDef, inputValue, activeIdx,
      filteredDefs, filteredOptions, tokens,
      close, onChange, onSelectDef, onToggleMulti, upsertToken, applyPending,
    ],
  );

  const onDateChange = useCallback((value: string) => {
    setPendingMulti([value]);
  }, []);

  const onMouseEnterOption = useCallback((idx: number) => setActiveIdx(idx), []);

  const onStartSave = useCallback(() => {
    setSaveName(lastAppliedFilter?.name ?? '');
    setIsSaving(true);
    setPhase('filter-select');
    setTimeout(() => saveInputRef.current?.focus(), 20);
  }, [lastAppliedFilter]);

  const onSaveNameChange = useCallback((name: string) => setSaveName(name), []);

  const onConfirmSave = useCallback(async () => {
    if (!screenKey || !saveName.trim()) return;
    const shouldOverwrite =
      lastAppliedFilter != null && saveName.trim() === lastAppliedFilter.name;
    const saved = await saveFilter(
      screenKey,
      saveName.trim(),
      tokens,
      shouldOverwrite ? lastAppliedFilter.id : null,
    );
    setLastAppliedFilter({ id: saved.id, name: saved.name });
    setIsSaving(false);
    setSaveName('');
    setTimeout(() => inputRef.current?.focus(), 20);
  }, [screenKey, saveName, tokens, lastAppliedFilter, saveFilter]);

  const onCancelSave = useCallback(() => {
    setIsSaving(false);
    setSaveName('');
    setTimeout(() => inputRef.current?.focus(), 20);
  }, []);

  const onSaveInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') void onConfirmSave();
      else if (e.key === 'Escape') onCancelSave();
    },
    [onConfirmSave, onCancelSave],
  );

  const onApplySavedFilter = useCallback(
    (filter: SavedFilter) => {
      onChange(filter.tokens as FilterToken[]);
      setLastAppliedFilter({ id: filter.id, name: filter.name });
      close();
    },
    [onChange, close],
  );

  const onRemoveSavedFilter = useCallback(
    async (id: string) => {
      await removeFilter(id);
      if (lastAppliedFilter?.id === id) setLastAppliedFilter(null);
    },
    [removeFilter, lastAppliedFilter],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting cursor index synchronously when search input changes is architecturally required
    setActiveIdx(0);
  }, [inputValue]);

  // Close dropdown when user clicks outside both the container and the portal
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inContainer = containerRef.current?.contains(e.target as Node);
      const inDropdown = dropdownRef.current?.contains(e.target as Node);
      if (!inContainer && !inDropdown) {
        if (phase === 'value-select' && activeDef?.type !== 'text') {
          applyPending();
        }
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [phase, activeDef, close, applyPending]);

  return {
    phase,
    inputValue,
    activeDef,
    pendingMulti,
    activeIdx,
    filteredDefs,
    filteredOptions,
    inputRef,
    dateInputRef,
    containerRef,
    dropdownRef,
    dropPos,
    screenFilters,
    isSaving,
    saveName,
    saveInputRef,
    onContainerClick,
    onInputFocus,
    onInputChange,
    onInputKeyDown,
    onSelectDef,
    onToggleMulti,
    onDateChange,
    onConfirmMulti,
    onRemoveToken,
    onEditToken,
    onClearAll,
    onMouseEnterOption,
    onStartSave,
    onSaveNameChange,
    onConfirmSave,
    onCancelSave,
    onSaveInputKeyDown,
    onApplySavedFilter,
    onRemoveSavedFilter,
  };
};
