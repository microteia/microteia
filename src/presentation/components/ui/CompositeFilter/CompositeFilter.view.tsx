import React from 'react';
import ReactDOM from 'react-dom';
import {
  RiCloseLine, RiCheckLine, RiFilter3Line, RiCornerDownLeftLine,
  RiBookmarkLine, RiBookmarkFill,
} from 'react-icons/ri';
import { S } from './CompositeFilter.styles';
import { useCompositeFilterViewModel } from './CompositeFilter.viewmodel';
import type { FilterDef, FilterToken } from './CompositeFilter.viewmodel';
import { useT, useLocaleFormat } from '../../../shared/i18n/useT';

interface CompositeFilterProps {
  defs: FilterDef[];
  tokens: FilterToken[];
  onChange: (tokens: FilterToken[]) => void;
  placeholder?: string;
  screenKey?: string | null;
}

export const CompositeFilter: React.FC<CompositeFilterProps> = ({
  defs,
  tokens,
  onChange,
  placeholder,
  screenKey,
}) => {
  const vm = useCompositeFilterViewModel(defs, tokens, onChange, screenKey);
  const t = useT('core.ui');
  const { formatDate } = useLocaleFormat();
  const defMap = Object.fromEntries(defs.map((d) => [d.key, d]));
  const isOpen = vm.phase !== 'idle' || vm.isSaving;

  const formatIsoDay = (iso: string): string => (iso ? formatDate(`${iso}T12:00:00`) : '');

  const getChipDisplayValue = (token: FilterToken): string => {
    const def = defMap[token.key];
    if (!def) return token.values.join(', ');
    if (def.type === 'text') return token.values[0] ?? '';
    if (def.type === 'date') return formatIsoDay(token.values[0] ?? '');
    return token.values
      .map((v) => def.options?.find((o) => o.value === v)?.label ?? v)
      .join(', ');
  };

  const getChipColor = (token: FilterToken): string | undefined => {
    const def = defMap[token.key];
    if (!def || token.values.length !== 1) return undefined;
    return def.options?.find((o) => o.value === token.values[0])?.color;
  };

  const inputPlaceholder = (() => {
    if (vm.phase === 'value-select' && vm.activeDef?.type === 'text') {
      return vm.activeDef.placeholder ?? t('filter.type-and-enter');
    }
    if (vm.phase === 'filter-select') return t('filter.search.placeholder');
    if (tokens.length === 0) return placeholder ?? t('filter.add');
    return '';
  })();

  /* eslint-disable react-hooks/refs -- vm ViewModel exposes refs only for DOM passing; no ref.current is read during render */
  const dropdownContent = (
    <>
      {vm.isSaving ? (
        <S.SaveBar onClick={(e) => e.stopPropagation()}>
          <S.SaveInput
            ref={vm.saveInputRef}
            value={vm.saveName}
            placeholder={t('filter.saved.name')}
            onChange={(e) => vm.onSaveNameChange(e.target.value)}
            onKeyDown={vm.onSaveInputKeyDown}
          />
          <S.FooterActions>
            <S.FooterBtn
              type="button"
              $variant="primary"
              onClick={(e) => { e.stopPropagation(); void vm.onConfirmSave(); }}
            >
              <RiCheckLine size={14} />
            </S.FooterBtn>
            <S.FooterBtn
              type="button"
              onClick={(e) => { e.stopPropagation(); vm.onCancelSave(); }}
            >
              <RiCloseLine size={14} />
            </S.FooterBtn>
          </S.FooterActions>
        </S.SaveBar>
      ) : (
        <>
          {vm.phase === 'filter-select' && (
            <>
              <S.DropdownHeader>{t('filter.by')}</S.DropdownHeader>

              {screenKey && vm.screenFilters.length > 0 && (
                <S.SavedSection>
                  <S.SavedHeader>{t('filter.saved')}</S.SavedHeader>
                  <S.SavedList>
                    {vm.screenFilters.map((sf) => (
                      <S.SavedItem key={sf.id}>
                        <S.SavedItemApply
                          type="button"
                          title={t('filter.saved.apply', { name: sf.name })}
                          onClick={(e) => { e.stopPropagation(); vm.onApplySavedFilter(sf); }}
                        >
                          <S.SavedItemIcon><RiBookmarkLine size={12} /></S.SavedItemIcon>
                          <S.SavedItemName>{sf.name}</S.SavedItemName>
                        </S.SavedItemApply>
                        <S.SavedItemRemove
                          type="button"
                          title={t('filter.saved.remove')}
                          onClick={(e) => { e.stopPropagation(); void vm.onRemoveSavedFilter(sf.id); }}
                        >
                          <RiCloseLine size={12} />
                        </S.SavedItemRemove>
                      </S.SavedItem>
                    ))}
                  </S.SavedList>
                </S.SavedSection>
              )}

              <S.OptionList>
                {vm.filteredDefs.length === 0 ? (
                  <S.EmptyMsg>{t('filter.none-available')}</S.EmptyMsg>
                ) : (
                  vm.filteredDefs.map((def, idx) => (
                    <S.OptionItem
                      key={def.key}
                      $active={idx === vm.activeIdx}
                      onClick={(e) => { e.stopPropagation(); vm.onSelectDef(def); }}
                      onMouseEnter={() => vm.onMouseEnterOption(idx)}
                    >
                      <S.OptionLabel>{def.label}</S.OptionLabel>
                      {def.type === 'multiselect' && (
                        <S.OptionTypeBadge>{t('filter.type.multiselect')}</S.OptionTypeBadge>
                      )}
                      {def.type === 'text' && (
                        <S.OptionTypeBadge>{t('filter.type.text')}</S.OptionTypeBadge>
                      )}
                      {def.type === 'date' && (
                        <S.OptionTypeBadge>{t('filter.type.date')}</S.OptionTypeBadge>
                      )}
                    </S.OptionItem>
                  ))
                )}
              </S.OptionList>

              {tokens.length > 0 && (
                <S.DropdownFooter>
                  <S.FooterCount>
                    {t('filter.active', { count: tokens.length })}
                  </S.FooterCount>
                </S.DropdownFooter>
              )}
            </>
          )}

          {vm.phase === 'value-select' && vm.activeDef && (
            vm.activeDef.type === 'text' ? (
              <S.TextHint>
                <RiCornerDownLeftLine size={14} />
                {t('filter.enter-to-apply')}
              </S.TextHint>
            ) : vm.activeDef.type === 'date' ? (
              <>
                <S.TextHint>
                  <RiCornerDownLeftLine size={14} />
                  {t('filter.pick-date')}
                </S.TextHint>
                <S.DropdownFooter>
                  <S.FooterCount>
                    {vm.pendingMulti[0] ? t('filter.date.set') : t('filter.date.unset')}
                  </S.FooterCount>
                  <S.FooterActions>
                    <S.FooterBtn
                      type="button"
                      onClick={(e) => { e.stopPropagation(); vm.onConfirmMulti(); }}
                      $variant="primary"
                    >
                      {t('action.apply')}
                    </S.FooterBtn>
                  </S.FooterActions>
                </S.DropdownFooter>
              </>
            ) : (
              <>
                <S.OptionList>
                  {vm.filteredOptions.length === 0 ? (
                    <S.EmptyMsg>{t('filter.no-options')}</S.EmptyMsg>
                  ) : (
                    vm.filteredOptions.map((opt, idx) => {
                      const isSelected = vm.pendingMulti.includes(opt.value);
                      return (
                        <S.OptionItem
                          key={opt.value}
                          $active={idx === vm.activeIdx}
                          $selected={isSelected}
                          onClick={(e) => { e.stopPropagation(); vm.onToggleMulti(opt.value); }}
                          onMouseEnter={() => vm.onMouseEnterOption(idx)}
                        >
                          {opt.color && <S.OptionColorDot $color={opt.color} />}
                          <S.OptionLabel>{opt.label}</S.OptionLabel>
                          {isSelected && (
                            <S.CheckMark><RiCheckLine size={14} /></S.CheckMark>
                          )}
                        </S.OptionItem>
                      );
                    })
                  )}
                </S.OptionList>
                <S.DropdownFooter>
                  <S.FooterCount>
                    {vm.pendingMulti.length > 0
                      ? t('filter.selected', { count: vm.pendingMulti.length })
                      : t('filter.none-selected')}
                  </S.FooterCount>
                  <S.FooterActions>
                    <S.FooterBtn
                      type="button"
                      onClick={(e) => { e.stopPropagation(); vm.onConfirmMulti(); }}
                      $variant="primary"
                    >
                      {t('action.apply')}
                    </S.FooterBtn>
                  </S.FooterActions>
                </S.DropdownFooter>
              </>
            )
          )}
        </>
      )}
    </>
  );

  return (
    <S.Container
      ref={vm.containerRef}
      $focused={isOpen}
      onClick={vm.onContainerClick}
    >
      <S.FilterIcon>
        <RiFilter3Line size={15} />
      </S.FilterIcon>

      <S.TokensRow>
        {tokens.map((token) => {
          const def = defMap[token.key];
          if (!def) return null;

          if (def.type === 'multiselect' && token.values.length > 1) {
            return (
              <S.Chip key={token.key} onClick={(e) => e.stopPropagation()}>
                <S.ChipBody
                  title={t('filter.edit', { field: def.label })}
                  onClick={() => vm.onEditToken(token.key)}
                >
                  <S.ChipKey>{def.label}:</S.ChipKey>
                </S.ChipBody>
                {token.values.map((value) => {
                  const optLabel = def.options?.find((o) => o.value === value)?.label ?? value;
                  const optColor = def.options?.find((o) => o.value === value)?.color;
                  return (
                    <S.ChipValuePill key={value}>
                      {optColor && <S.ChipColorDot $color={optColor} />}
                      {optLabel}
                      <S.ChipPillRemove
                        type="button"
                        title={t('filter.value.remove')}
                        onClick={(e) => { e.stopPropagation(); vm.onRemoveToken(token.key, value); }}
                      >
                        <RiCloseLine size={10} />
                      </S.ChipPillRemove>
                    </S.ChipValuePill>
                  );
                })}
              </S.Chip>
            );
          }

          const displayValue = getChipDisplayValue(token);
          const color = getChipColor(token);
          return (
            <S.Chip key={token.key}>
              <S.ChipBody
                title={t('filter.edit', { field: def.label })}
                onClick={(e) => { e.stopPropagation(); vm.onEditToken(token.key); }}
              >
                {color && <S.ChipColorDot $color={color} />}
                <S.ChipKey>{def.label}:</S.ChipKey>
                <S.ChipValue title={displayValue}>{displayValue}</S.ChipValue>
              </S.ChipBody>
              <S.ChipRemove
                type="button"
                title={`Remover filtro ${def.label}`}
                onClick={(e) => { e.stopPropagation(); vm.onRemoveToken(token.key); }}
              >
                <RiCloseLine size={11} />
              </S.ChipRemove>
            </S.Chip>
          );
        })}

        {vm.phase === 'value-select' && vm.activeDef && (
          <S.ActiveDefBadge>{vm.activeDef.label}:</S.ActiveDefBadge>
        )}

        {vm.phase === 'value-select' && vm.activeDef?.type === 'date' ? (
          <S.InlineDateInput
            ref={vm.dateInputRef}
            type="date"
            value={vm.pendingMulti[0] ?? ''}
            onChange={(e) => vm.onDateChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); vm.onConfirmMulti(); } }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <S.Input
            ref={vm.inputRef}
            value={vm.inputValue}
            placeholder={inputPlaceholder}
            onChange={(e) => vm.onInputChange(e.target.value)}
            onKeyDown={vm.onInputKeyDown}
            onFocus={vm.onInputFocus}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </S.TokensRow>

      {screenKey && tokens.length > 0 && (
        <S.SaveBtn
          type="button"
          title={t('filter.save-current')}
          onClick={(e) => { e.stopPropagation(); vm.onStartSave(); }}
        >
          {vm.isSaving ? <RiBookmarkFill size={15} /> : <RiBookmarkLine size={15} />}
        </S.SaveBtn>
      )}

      {tokens.length > 0 && (
        <S.ClearAll
          type="button"
          title={t('filter.clear-all')}
          onClick={(e) => { e.stopPropagation(); vm.onClearAll(); }}
        >
          <RiCloseLine size={15} />
        </S.ClearAll>
      )}

      {isOpen && ReactDOM.createPortal(
        <S.PortalDropdown
          ref={vm.dropdownRef}
          $top={vm.dropPos.top}
          $bottom={vm.dropPos.bottom}
          $left={vm.dropPos.left}
          $minWidth={vm.dropPos.minWidth}
          $maxHeight={vm.dropPos.maxHeight}
        >
          {dropdownContent}
        </S.PortalDropdown>,
        document.body,
      )}
    </S.Container>
  );
  /* eslint-enable react-hooks/refs */
};

