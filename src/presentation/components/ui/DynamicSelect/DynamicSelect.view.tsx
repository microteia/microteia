import React from 'react';
import ReactDOM from 'react-dom';
import {
  RiSearchLine,
  RiCloseLine,
  RiCheckLine,
  RiArrowDownSLine,
  RiDeleteBin6Line,
  RiAddLine,
  RiErrorWarningLine,
  RiAddCircleLine,
  RiPaletteLine,
} from 'react-icons/ri';
import { ColorSwatchPicker } from '../ColorSwatchPicker';
import { ConfirmModal } from '../ConfirmModal';
import { type DynamicSelectProps, useDynamicSelectViewModel } from './DynamicSelect.viewmodel';
import * as S from './DynamicSelect.styles';
import { useT } from '../../../shared/i18n/useT';


export const DynamicSelect: React.FC<DynamicSelectProps> = (props) => {
  const t = useT('core.ui');
  const orphanTitle = t('dynamic-select.orphan.title');
  const {
    open,
    query,
    activeIdx,
    dropPos,
    pendingDelete,
    deleteLoading,
    addLoading,
    recoloring,
    palette,
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
    handleRemove,
    onQueryChange,
    handleKeyDown,
    handleRecolorClick,
    handlePickColor,
    handleDeleteClick,
    handleRestoreClick,
    handleConfirmDelete,
    handleCancelDelete,
    handleAdd,
    setActiveIdx,
    placeholder,
    disabled,
    multiSelect,
    hasOnAdd,
    hasOnRecolor,
    hasOnDelete,
  } = useDynamicSelectViewModel(props);

  return (
    <S.Wrapper ref={wrapperRef}>
      <S.TriggerButton
        type="button"
        $hasValue={multiSelect ? selectedOptions.length > 0 : !!selectedOption}
        $disabled={disabled}
        $multiSelect={multiSelect}
        onClick={handleOpen}
        disabled={disabled}
      >
        {multiSelect ? (
          <>
            {selectedOptions.length > 0 ? (
              <S.SelectedPills>
                {selectedOptions.map(opt => (
                  <S.SelectedPill
                    key={opt.value}
                    $color={opt.color}
                    $orphan={opt.isOrphan}
                    title={opt.isOrphan ? orphanTitle : undefined}
                  >
                    {opt.isOrphan
                      ? <S.OrphanIcon><RiErrorWarningLine size={11} /></S.OrphanIcon>
                      : opt.color && <S.ColorDot $color={opt.color} />}
                    {opt.label}
                    {!disabled && (
                      <S.PillRemove
                        title={t('action.remove')}
                        onClick={e => handleRemove(e, opt.value)}
                      >
                        <RiCloseLine size={11} />
                      </S.PillRemove>
                    )}
                  </S.SelectedPill>
                ))}
              </S.SelectedPills>
            ) : (
              <S.TriggerLabel>{placeholder}</S.TriggerLabel>
            )}
            <S.TriggerRight>
              {selectedOptions.length > 0 && !disabled && (
                <S.ClearBtn onClick={handleClearAll} title={t('action.clear-all')}>
                  <RiCloseLine size={14} />
                </S.ClearBtn>
              )}
              <S.ChevronIcon $open={open}>
                <RiArrowDownSLine size={16} />
              </S.ChevronIcon>
            </S.TriggerRight>
          </>
        ) : (
          <>
            {selectedOption?.isOrphan
              ? <S.OrphanIcon title={orphanTitle}><RiErrorWarningLine size={14} /></S.OrphanIcon>
              : selectedOption?.color && <S.ColorDot $color={selectedOption.color} />}
            <S.TriggerLabel
              $orphan={selectedOption?.isOrphan}
              title={selectedOption?.isOrphan ? orphanTitle : undefined}
            >
              {selectedOption ? selectedOption.label : placeholder}
            </S.TriggerLabel>
            <S.TriggerRight>
              {selectedOption && !disabled && (
                <S.ClearBtn onClick={handleClear} title={t('action.clear')}>
                  <RiCloseLine size={14} />
                </S.ClearBtn>
              )}
              <S.ChevronIcon $open={open}>
                <RiArrowDownSLine size={16} />
              </S.ChevronIcon>
            </S.TriggerRight>
          </>
        )}
      </S.TriggerButton>

      {open && ReactDOM.createPortal(
        <S.Dropdown
          ref={dropdownRef}
          $top={dropPos.top}
          $bottom={dropPos.bottom}
          $left={dropPos.left}
          $minWidth={dropPos.minWidth}
          $maxHeight={dropPos.maxHeight}
        >
          <S.SearchRow>
            <RiSearchLine size={16} />
            <S.SearchInput
              ref={searchRef}
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('dynamic-select.search.placeholder')}
              disabled={addLoading}
            />
          </S.SearchRow>

          <S.OptionList>
            {filtered.length === 0 && !canAdd ? (
              <S.EmptyMsg>{t('dynamic-select.no-results')}</S.EmptyMsg>
            ) : (
              filtered.map((opt, idx) => (
                <React.Fragment key={opt.value}>
                  <S.OptionItem
                    $active={idx === activeIdx}
                    $selected={isSelected(opt.value)}
                    onMouseDown={() => handleSelect(opt.value)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    {opt.isOrphan
                      ? <S.OrphanIcon><RiErrorWarningLine size={13} /></S.OrphanIcon>
                      : opt.color && <S.ColorDot $color={opt.color} />}
                    <S.OptionText>
                      <S.OptionLabel $orphan={opt.isOrphan}>{opt.label}</S.OptionLabel>
                      {opt.isOrphan
                        ? <S.OptionMeta>{t('dynamic-select.orphan.meta')}</S.OptionMeta>
                        : opt.meta && <S.OptionMeta>{opt.meta}</S.OptionMeta>}
                    </S.OptionText>
                    {hasOnAdd && opt.isOrphan && (
                      <S.RestoreBtn
                        type="button"
                        title={t('dynamic-select.orphan.restore', { label: opt.label })}
                        onMouseDown={e => void handleRestoreClick(e, opt)}
                      >
                        <RiAddCircleLine size={15} />
                      </S.RestoreBtn>
                    )}
                    {hasOnRecolor && opt.isDynamic && opt.color && (
                      <S.RecolorBtn
                        type="button"
                        $open={recoloring === opt.value}
                        title={t('dynamic-select.option.recolor', { label: opt.label })}
                        onMouseDown={e => handleRecolorClick(e, opt)}
                      >
                        <RiPaletteLine size={14} />
                      </S.RecolorBtn>
                    )}
                    {hasOnDelete && opt.isDynamic && (
                      <S.DeleteBtn
                        type="button"
                        title={t('dynamic-select.option.delete', { label: opt.label })}
                        onMouseDown={e => handleDeleteClick(e, opt)}
                      >
                        <RiDeleteBin6Line size={13} />
                      </S.DeleteBtn>
                    )}
                    {isSelected(opt.value) && (
                      <S.CheckIcon>
                        <RiCheckLine size={16} />
                      </S.CheckIcon>
                    )}
                  </S.OptionItem>
                  {recoloring === opt.value && (
                    <S.PaletteRow onMouseDown={e => e.preventDefault()}>
                      <ColorSwatchPicker
                        colors={palette}
                        value={opt.color ?? ''}
                        onChange={color => void handlePickColor(opt.value, color)}
                      />
                    </S.PaletteRow>
                  )}
                </React.Fragment>
              ))
            )}

            {canAdd && (
              <S.AddRow
                $active={activeIdx === filtered.length}
                onMouseDown={() => void handleAdd()}
                onMouseEnter={() => setActiveIdx(filtered.length)}
              >
                <RiAddLine size={14} />
                <S.AddLabel>
                  {t('action.add')} <S.AddQueryText>"{query.trim()}" ?</S.AddQueryText>
                </S.AddLabel>
              </S.AddRow>
            )}
          </S.OptionList>
        </S.Dropdown>,
        document.body
      )}

      <ConfirmModal
        isOpen={pendingDelete !== null}
        title={deleteConfirmTitle}
        message={deleteConfirmMessage}
        confirmLabel={t('action.delete')}
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </S.Wrapper>
  );
};
