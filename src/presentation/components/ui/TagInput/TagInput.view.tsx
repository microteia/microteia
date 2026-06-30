import React, { useState, useCallback, useRef } from 'react';
import { useTagInputViewModel } from './TagInput.viewmodel';
import { S } from './TagInput.styles';
import type { TagInputViewModelProps } from './TagInput.viewmodel';

interface TagInputViewProps extends Omit<TagInputViewModelProps, 'inputRef'> {
  label?: string;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const TagInput: React.FC<TagInputViewProps> = ({
  label,
  hint,
  disabled,
  placeholder,
  ...vmProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const vm = useTagInputViewModel({ ...vmProps, inputRef });
  const [focused, setFocused] = useState(false);

  const handleContainerClick = useCallback(() => {
    vm.focusInput();
  }, [vm]);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  return (
    <S.Container>
      {label && <S.Label>{label}</S.Label>}
      <S.InputContainer $focused={focused} onClick={handleContainerClick}>
        {vm.tags.map((tag) => (
          <S.Tag key={tag}>
            <S.TagText>{tag}</S.TagText>
            <S.RemoveButton
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                vm.handleRemoveTag(tag);
              }}
              disabled={disabled}
            >
              ×
            </S.RemoveButton>
          </S.Tag>
        ))}
        <S.Input
          ref={inputRef}
          type="text"
          value={vm.inputValue}
          onChange={vm.handleInputChange}
          onKeyDown={vm.handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={vm.tags.length === 0 ? placeholder : ''}
          disabled={disabled}
        />
      </S.InputContainer>
      {hint && <S.Hint>{hint}</S.Hint>}
    </S.Container>
  );
};
