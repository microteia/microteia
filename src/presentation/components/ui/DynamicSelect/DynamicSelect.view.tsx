import React from 'react';
import ReactDOM from 'react-dom';
import {
  RiSearchLine,
  RiCloseLine,
  RiCheckLine,
  RiArrowDownSLine,
  RiDeleteBin6Line,
  RiAddLine,
} from 'react-icons/ri';
import { ConfirmModal } from '../ConfirmModal';
import { type DynamicSelectProps, useDynamicSelectViewModel } from './DynamicSelect.viewmodel';
import * as S from './DynamicSelect.styles';

export const DynamicSelect: React.FC<DynamicSelectProps> = (props) => {
  const {
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
                  <S.SelectedPill key={opt.value} $color={opt.color}>
                    {opt.color && <S.ColorDot $color={opt.color} />}
                    {opt.label}
                  </S.SelectedPill>
                ))}
              </S.SelectedPills>
            ) : (
              <S.TriggerLabel>{placeholder}</S.TriggerLabel>
            )}
            <S.TriggerRight>
              {selectedOptions.length > 0 && !disabled && (
                <S.ClearBtn onClick={handleClearAll} title="Limpar tudo">
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
            {selectedOption?.color && <S.ColorDot $color={selectedOption.color} />}
            <S.TriggerLabel>{selectedOption ? selectedOption.label : placeholder}</S.TriggerLabel>
            <S.TriggerRight>
              {selectedOption && !disabled && (
                <S.ClearBtn onClick={handleClear} title="Limpar">
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
          $left={dropPos.left}
          $minWidth={dropPos.minWidth}
        >
          <S.SearchRow>
            <RiSearchLine size={16} />
            <S.SearchInput
              ref={searchRef}
              value={query}
              onChange={e => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite para buscar ou adicionar..."
              disabled={addLoading}
            />
          </S.SearchRow>

          <S.OptionList>
            {filtered.length === 0 && !canAdd ? (
              <S.EmptyMsg>Nenhum resultado encontrado</S.EmptyMsg>
            ) : (
              filtered.map((opt, idx) => (
                <S.OptionItem
                  key={opt.value}
                  $active={idx === activeIdx}
                  $selected={isSelected(opt.value)}
                  onMouseDown={() => handleSelect(opt.value)}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  {opt.color && <S.ColorDot $color={opt.color} />}
                  <S.OptionText>
                    <S.OptionLabel>{opt.label}</S.OptionLabel>
                    {opt.meta && <S.OptionMeta>{opt.meta}</S.OptionMeta>}
                  </S.OptionText>
                  {hasOnDelete && opt.isDynamic && (
                    <S.DeleteBtn
                      type="button"
                      title={`Excluir ${opt.label}`}
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
                  Adicionar <S.AddQueryText>"{query.trim()}" ?</S.AddQueryText>
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
        confirmLabel="Excluir"
        variant="danger"
        loading={deleteLoading}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </S.Wrapper>
  );
};
