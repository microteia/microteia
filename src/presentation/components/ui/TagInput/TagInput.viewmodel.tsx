import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react';

export interface TagInputViewModel {
  inputValue: string;
  tags: string[];
  handleInputChange: (e: ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  handleRemoveTag: (tag: string) => void;
  focusInput: () => void;
}

export interface TagInputViewModelProps {
  value: string[];
  onChange: (tags: string[]) => void;
  validator?: (value: string) => boolean;
  normalizer?: (value: string) => string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export const useTagInputViewModel = ({
  value,
  onChange,
  validator,
  normalizer,
  inputRef,
}: TagInputViewModelProps): TagInputViewModel => {
  const [inputValue, setInputValue] = useState('');
  const tags = value;

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  }, []);

  const addTag = useCallback((rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    
    const normalized = normalizer ? normalizer(trimmed) : trimmed;
    
    if (validator && !validator(normalized)) return;
    
    if (tags.includes(normalized)) return;
    
    onChange([...tags, normalized]);
    setInputValue('');
  }, [tags, onChange, validator, normalizer]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      e.preventDefault();
      onChange(tags.slice(0, -1));
    }
  }, [inputValue, tags, onChange, addTag]);

  const handleRemoveTag = useCallback((tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  }, [tags, onChange]);

  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return {
    inputValue,
    tags,
    handleInputChange,
    handleKeyDown,
    handleRemoveTag,
    focusInput,
  };
};
