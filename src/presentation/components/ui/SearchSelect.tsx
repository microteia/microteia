import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import type { IconType } from 'react-icons';
import { RiSearchLine, RiCloseLine, RiCheckLine, RiErrorWarningLine } from 'react-icons/ri';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';

import { useT } from '../../shared/i18n/useT';
export interface SearchSelectOption {
  value: string;
  label: string;
  meta?: string;
  color?: string;
  icon?: IconType;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
}

const Wrapper = styled.div`
  position: relative;
`;

const TriggerButton = styled.button<{ $hasValue: boolean; $disabled?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme, $hasValue }) => $hasValue ? theme.colors.text : theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-align: left;
  transition: border-color ${({ theme }) => theme.transitions.fast};
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:hover:not(:disabled) {
    border-color: ${({ theme, $disabled }) => !$disabled ? theme.colors.primary : theme.colors.border};
  }
`;

const ColorDot = styled.span<{ $color: string }>`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const OptionIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme }) => theme.colors.textSecondary};
`;

const TriggerLabel = styled.span<{ $orphan?: boolean }>`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: ${({ theme, $orphan }) => $orphan ? theme.colors.warning : 'inherit'};
`;

const OrphanIcon = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.warning};
  flex-shrink: 0;
`;


const ClearBtn = styled.span`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 2px;
  border-radius: 50%;
  transition: color ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;

  &:hover { color: ${({ theme }) => theme.colors.text}; }
`;

const Dropdown = styled.div<{ $top: number | null; $bottom: number | null; $left: number; $minWidth: number; $maxHeight: number }>`
  position: fixed;
  top: ${({ $top }) => ($top != null ? `${$top}px` : 'auto')};
  bottom: ${({ $bottom }) => ($bottom != null ? `${$bottom}px` : 'auto')};
  left: ${({ $left }) => $left}px;
  min-width: ${({ $minWidth }) => $minWidth}px;
  width: max-content;
  max-height: ${({ $maxHeight }) => $maxHeight}px;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  box-shadow: 0 12px 32px ${({ theme }) => theme.colors.shadow};
  z-index: 9999;
  overflow: hidden;
  animation: dropIn 120ms ease;

  @keyframes dropIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const SearchRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  flex-shrink: 0;
`;

const SearchInput = styled.input`
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};

  &::placeholder { color: ${({ theme }) => theme.colors.textMuted}; }
`;

const OptionList = styled.ul`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

const OptionItem = styled.li<{ $active: boolean; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme, $selected }) => $selected ? theme.colors.primary : theme.colors.text};
  background: ${({ theme, $active, $selected }) =>
    $selected ? theme.colors.primaryLight :
    $active ? theme.colors.surfaceHover :
    'transparent'};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
`;

const OptionText = styled.div`
  flex: 1;
  min-width: 0;
`;

const OptionLabel = styled.div`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const OptionMeta = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 1px;
`;

const EmptyMsg = styled.div`
  padding: 20px 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

export const SearchSelect: React.FC<SearchSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Selecione...',
  disabled,
}) => {
  const t = useT('core.ui');
  const orphanTitle = t('reference.orphan.title');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { dropPos, reposition } = useAnchoredDropdown({ open, anchorRef: wrapperRef, dropdownRef });

  const selected = options.find((o) => o.value === value);
  const isOrphan = !!value && !selected;

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    (o.meta ?? '').toLowerCase().includes(query.toLowerCase())
  );

  const handleOpen = () => {
    if (disabled) return;
    reposition();
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  }, [onChange]);

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[activeIdx]) handleSelect(filtered[activeIdx].value); }
    if (e.key === 'Escape')    { setOpen(false); }
  };

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

  return (
    <Wrapper ref={wrapperRef}>
      <TriggerButton
        type="button"
        $hasValue={!!selected}
        $disabled={disabled}
        onClick={handleOpen}
        disabled={disabled}
      >
        {isOrphan && <OrphanIcon title={orphanTitle}><RiErrorWarningLine size={14} /></OrphanIcon>}
        {selected?.color && <ColorDot $color={selected.color} />}
        {selected?.icon && <OptionIcon><selected.icon size={14} /></OptionIcon>}
        <TriggerLabel $orphan={isOrphan} title={isOrphan ? orphanTitle : undefined}>
          {selected ? selected.label : isOrphan ? t('reference.not-found', { id: value }) : placeholder}
        </TriggerLabel>
        {(selected || isOrphan) && !disabled && (
          <ClearBtn onClick={handleClear} title="Limpar">
            <RiCloseLine size={14} />
          </ClearBtn>
        )}
      </TriggerButton>

      {open && ReactDOM.createPortal(
        <Dropdown ref={dropdownRef} $top={dropPos.top} $bottom={dropPos.bottom} $left={dropPos.left} $minWidth={dropPos.minWidth} $maxHeight={dropPos.maxHeight}>
          <SearchRow>
            <RiSearchLine size={16} />
            <SearchInput
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar..."
            />
          </SearchRow>
          <OptionList>
            {filtered.length === 0 ? (
              <EmptyMsg>Nenhum resultado encontrado</EmptyMsg>
            ) : (
              filtered.map((opt, idx) => (
                <OptionItem
                  key={opt.value}
                  $active={idx === activeIdx}
                  $selected={opt.value === value}
                  onMouseDown={() => handleSelect(opt.value)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  {opt.color && <ColorDot $color={opt.color} />}
                  {opt.icon && <OptionIcon><opt.icon size={16} /></OptionIcon>}
                  <OptionText>
                    <OptionLabel>{opt.label}</OptionLabel>
                    {opt.meta && <OptionMeta>{opt.meta}</OptionMeta>}
                  </OptionText>
                  {opt.value === value && <RiCheckLine size={16} />}
                </OptionItem>
              ))
            )}
          </OptionList>
        </Dropdown>,
        document.body
      )}
    </Wrapper>
  );
};
