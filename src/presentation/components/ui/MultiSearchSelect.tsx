import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { RiSearchLine, RiCloseLine, RiCheckLine, RiArrowDownSLine, RiErrorWarningLine, RiArrowRightUpLine } from 'react-icons/ri';
import { useAnchoredDropdown } from '../../hooks/useAnchoredDropdown';

import { useT } from '../../shared/i18n/useT';
export interface MultiSearchSelectOption {
  value: string;
  label: string;
  meta?: string;
  color?: string;
  statusDot?: string;
}

interface MultiSearchSelectProps {
  options: MultiSearchSelectOption[];
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /**
   * O DESTINO de cada valor escolhido, quando ele é um registro que alguma tela apresenta. Presente,
   * cada etiqueta ganha o gesto de ir até o SEU registro — dois escolhidos são dois destinos, e um
   * atalho só para o controle teria de eleger um deles. O rótulo continua abrindo a lista, como no
   * `SearchSelect`: quem navega é a seta. Ausente, nada aparece.
   */
  onOpenSelected?: (value: string) => void;
}

const Wrapper = styled.div`
  position: relative;
`;

const TriggerButton = styled.button<{ $hasValue: boolean; $disabled?: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme, $hasValue }) => $hasValue ? theme.colors.text : theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-align: left;
  transition: border-color ${({ theme }) => theme.transitions.fast};
  cursor: ${({ $disabled }) => $disabled ? 'not-allowed' : 'pointer'};
  opacity: ${({ $disabled }) => $disabled ? 0.5 : 1};
  min-height: 42px;
  flex-wrap: wrap;

  &:focus { outline: none; border-color: ${({ theme }) => theme.colors.primary}; }
  &:hover:not(:disabled) {
    border-color: ${({ theme, $disabled }) => !$disabled ? theme.colors.primary : theme.colors.border};
  }
`;

const SelectedPills = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  min-width: 0;
`;

const SelectedPill = styled.span<{ $color?: string; $orphan?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  background: ${({ $color }) => $color ? `${$color}22` : 'rgba(0,0,0,0.08)'};
  color: ${({ theme, $color, $orphan }) => $orphan ? theme.colors.warning : ($color ?? theme.colors.text)};
  border: 1px solid ${({ theme, $color, $orphan }) => $orphan ? theme.colors.warning : ($color ? `${$color}44` : 'transparent')};
  border-style: ${({ $orphan }) => $orphan ? 'dashed' : 'solid'};
  white-space: nowrap;
  flex-shrink: 0;
`;

const OrphanIcon = styled.span`
  display: inline-flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.warning};
  flex-shrink: 0;
`;

const PillOpenBtn = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: 1px;
  opacity: 0.6;
  cursor: pointer;
  flex-shrink: 0;
  transition: opacity ${({ theme }) => theme.transitions.fast};

  &:hover { opacity: 1; }
`;


const PlaceholderText = styled.span`
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TriggerRight = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;
`;

const ClearBtn = styled.button`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 2px;
  border-radius: 50%;
  transition: color ${({ theme }) => theme.transitions.fast};
  flex-shrink: 0;
  &:hover { color: ${({ theme }) => theme.colors.text}; }
`;

const ChevronIcon = styled.span<{ $open: boolean }>`
  display: flex;
  align-items: center;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: transform 200ms ease;
  transform: rotate(${({ $open }) => $open ? '180deg' : '0deg'});
`;

const Dropdown = styled.div<{ $top: number | null; $bottom: number | null; $left: number; $minWidth: number; $maxHeight: number }>`
  position: fixed;
  top: ${({ $top }) => ($top != null ? `${$top}px` : 'auto')};
  bottom: ${({ $bottom }) => ($bottom != null ? `${$bottom}px` : 'auto')};
  left: ${({ $left }) => $left}px;
  min-width: ${({ $minWidth }) => $minWidth}px;
  width: max-content;
  max-width: 420px;
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
    $active ? theme.colors.surfaceHover : 'transparent'};
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

const CheckIcon = styled.span`
  color: ${({ theme }) => theme.colors.primary};
  flex-shrink: 0;
`;

const StatusDot = styled.span<{ $color: string }>`
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

const EmptyMsg = styled.div`
  padding: 20px 14px;
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

export const MultiSearchSelect: React.FC<MultiSearchSelectProps> = ({
  options,
  values,
  onChange,
  placeholder = 'Selecionar...',
  disabled,
  onOpenSelected,
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

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()) ||
    (o.meta ?? '').toLowerCase().includes(query.toLowerCase())
  );

  const knownValues = new Set(options.map((o) => o.value));
  const selectedOptions = options.filter((o) => values.includes(o.value));
  const orphanValues = values.filter((v) => v && !knownValues.has(v));

  const handleOpen = () => {
    if (disabled) return;
    reposition();
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
    setTimeout(() => searchRef.current?.focus(), 50);
  };

  const handleToggle = useCallback((val: string) => {
    const next = values.includes(val)
      ? values.filter((v) => v !== val)
      : [...values, val];
    onChange(next);
  }, [values, onChange]);

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleOpenSelected = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onOpenSelected?.(val);
  };

  /**
   * O botão nativo `disabled` engole o clique de TUDO que está dentro dele — inclusive o das setas.
   * Um campo somente-leitura é justamente onde mais se quer chegar aos registros apontados, então
   * ali o desabilitado passa a ser dito por `aria-disabled` e pela aparência: `handleOpen` já recusa
   * abrir a lista, e nenhum outro uso do controle muda, porque isso só vale quando há atalho.
   */
  const hasOpenShortcut = !!onOpenSelected && selectedOptions.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (filtered[activeIdx]) handleToggle(filtered[activeIdx].value); }
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
        $hasValue={selectedOptions.length > 0 || orphanValues.length > 0}
        $disabled={disabled}
        onClick={handleOpen}
        disabled={disabled && !hasOpenShortcut}
        aria-disabled={disabled}
      >
        {selectedOptions.length > 0 || orphanValues.length > 0 ? (
          <SelectedPills>
            {selectedOptions.map((opt) => (
              <SelectedPill key={opt.value} $color={opt.color}>
                {opt.label}
                {onOpenSelected && (
                  <PillOpenBtn
                    onClick={(e) => handleOpenSelected(e, opt.value)}
                    title={t('reference.open')}
                  >
                    <RiArrowRightUpLine size={11} />
                  </PillOpenBtn>
                )}
              </SelectedPill>
            ))}
            {orphanValues.map((val) => (
              <SelectedPill key={val} $orphan title={orphanTitle}>
                <OrphanIcon><RiErrorWarningLine size={11} /></OrphanIcon>
                {t('reference.not-found', { id: val })}
              </SelectedPill>
            ))}
          </SelectedPills>
        ) : (
          <PlaceholderText>{placeholder}</PlaceholderText>
        )}
        <TriggerRight>
          {(selectedOptions.length > 0 || orphanValues.length > 0) && !disabled && (
            <ClearBtn type="button" onClick={handleClearAll} title={t('action.clear-all')}>
              <RiCloseLine size={14} />
            </ClearBtn>
          )}
          <ChevronIcon $open={open}>
            <RiArrowDownSLine size={16} />
          </ChevronIcon>
        </TriggerRight>
      </TriggerButton>

      {open && ReactDOM.createPortal(
        <Dropdown
          ref={dropdownRef}
          $top={dropPos.top}
          $bottom={dropPos.bottom}
          $left={dropPos.left}
          $minWidth={dropPos.minWidth}
          $maxHeight={dropPos.maxHeight}
        >
          <SearchRow>
            <RiSearchLine size={16} />
            <SearchInput
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('action.search')}
            />
          </SearchRow>
          <OptionList>
            {filtered.length === 0 ? (
              <EmptyMsg>{t('filter.no-options')}</EmptyMsg>
            ) : (
              filtered.map((opt, idx) => {
                const selected = values.includes(opt.value);
                return (
                  <OptionItem
                    key={opt.value}
                    $active={idx === activeIdx}
                    $selected={selected}
                    onMouseDown={() => handleToggle(opt.value)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    {opt.statusDot && <StatusDot $color={opt.statusDot} />}
                    <OptionText>
                      <OptionLabel>{opt.label}</OptionLabel>
                      {opt.meta && <OptionMeta>{opt.meta}</OptionMeta>}
                    </OptionText>
                    {selected && <CheckIcon><RiCheckLine size={15} /></CheckIcon>}
                  </OptionItem>
                );
              })
            )}
          </OptionList>
        </Dropdown>,
        document.body
      )}
    </Wrapper>
  );
};
