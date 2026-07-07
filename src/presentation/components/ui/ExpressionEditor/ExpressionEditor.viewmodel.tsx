import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useExpressionFunctions } from '../../../../stores/useExpressionFunctions';
import { validateExpressionWithParser } from './expressionValidator';
import { buildAutocompleteItems, insertSnippet } from './autocompleteHelpers';
import type { AutocompleteItem } from './autocompleteHelpers';

export interface EventField {
  path: string;
  label: string;
}

export interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  eventFields?: EventField[];
}

export interface AutocompleteState {
  active: boolean;
  mode: 'function' | 'field' | 'context';
  query: string;
  triggerStart: number;
  position: { top: number; left: number } | null;
}

interface ValidationResult {
  isValid: boolean | null;
  message?: string;
}

export interface ExpressionEditorViewModel {
  isValid: boolean | null;
  validationMessage: string | null;
  autocompleteState: AutocompleteState;
  highlightedIndex: number;
  autocompleteItems: AutocompleteItem[];
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  selectItem: (item: AutocompleteItem) => void;
  onAutocompleteHover: (index: number) => void;
  closeAutocomplete: () => void;
  openFunctionRef: () => void;
}

const computeAutocompletePosition = (
  textarea: HTMLTextAreaElement,
  triggerStart: number,
): { top: number; left: number } => {
  const rect = textarea.getBoundingClientRect();
  const styles = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(styles.lineHeight) || 22;
  const paddingTop = parseFloat(styles.paddingTop) || 10;

  const textBefore = textarea.value.slice(0, triggerStart);
  const linesBefore = (textBefore.match(/\n/g) ?? []).length;
  const estimatedTop =
    rect.top + paddingTop + (linesBefore + 1) * lineHeight - textarea.scrollTop;

  const menuHeight = 300;
  const top =
    estimatedTop + menuHeight > window.innerHeight
      ? estimatedTop - lineHeight - menuHeight - 4
      : estimatedTop + 4;

  return { top, left: rect.left + 14 };
};

export const useExpressionEditorViewModel = (
  props: ExpressionEditorProps,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
): ExpressionEditorViewModel => {
  const { openTab } = useWorkspace();
  const { functions } = useExpressionFunctions();
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: null });
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState>({
    active: false,
    mode: 'function',
    query: '',
    triggerStart: -1,
    position: null,
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const functionNames = useMemo(() => functions.map((f) => f.name), [functions]);

  useEffect(() => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }

    validationTimerRef.current = setTimeout(() => {
      const result = validateExpressionWithParser(props.value, functionNames);
      setValidationResult(result);
    }, 400);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [props.value, functionNames]);

  const autocompleteItems = useMemo(
    (): AutocompleteItem[] =>
      buildAutocompleteItems(
        autocompleteState.mode,
        autocompleteState.query,
        functions,
        props.eventFields ?? [],
        true,
      ),
    [autocompleteState.mode, autocompleteState.query, props.eventFields, functions],
  );

  const closeAutocomplete = useCallback(() => {
    setAutocompleteState({ active: false, mode: 'function', query: '', triggerStart: -1, position: null });
    setHighlightedIndex(0);
  }, []);

  const selectItem = useCallback(
    (item: AutocompleteItem) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const before = props.value.slice(0, autocompleteState.triggerStart);
      const after = props.value.slice(textarea.selectionStart);

      let newValue: string;
      let cursorPos: number;

      if (item.snippet) {
        const { text: insertion, newCursor } = insertSnippet(item.snippet, before.length);
        newValue = `${insertion}${after}`;
        cursorPos = newCursor;
      } else {
        let insertion: string;
        if (autocompleteState.mode === 'function' && !item.value.endsWith(')')) {
          insertion = `${item.value}()`;
          cursorPos = before.length + item.value.length + 1;
        } else if (item.value === 'event.' || item.value === 'input.' || item.value === 'output.') {
          insertion = item.value;
          cursorPos = before.length + item.value.length;
        } else {
          insertion = item.value;
          cursorPos = before.length + item.value.length;
        }
        newValue = `${before}${insertion}${after}`;
      }

      props.onChange(newValue);
      closeAutocomplete();

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [props, textareaRef, autocompleteState.triggerStart, autocompleteState.mode, closeAutocomplete],
  );

  const onAutocompleteHover = useCallback((index: number) => {
    setHighlightedIndex(index);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      props.onChange(value);

      const pos = e.target.selectionStart;
      const textBefore = value.slice(0, pos);

      const eventDotMatch = textBefore.match(/event\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
      if (eventDotMatch) {
        const triggerStart = pos - eventDotMatch[1].length;
        const query = eventDotMatch[1];
        const textarea = e.target;

        setAutocompleteState({
          active: true,
          mode: 'field',
          query,
          triggerStart,
          position: computeAutocompletePosition(textarea, triggerStart),
        });
        setHighlightedIndex(0);
        return;
      }

      if (textBefore.endsWith('event.')) {
        const triggerStart = pos;
        const textarea = e.target;

        setAutocompleteState({
          active: true,
          mode: 'field',
          query: '',
          triggerStart,
          position: computeAutocompletePosition(textarea, triggerStart),
        });
        setHighlightedIndex(0);
        return;
      }

      const inputDotMatch = textBefore.match(/input\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
      if (inputDotMatch || textBefore.endsWith('input.')) {
        const triggerStart = inputDotMatch ? pos - inputDotMatch[1].length : pos;
        const query = inputDotMatch ? inputDotMatch[1] : '';
        const textarea = e.target;

        setAutocompleteState({
          active: true,
          mode: 'context',
          query,
          triggerStart,
          position: computeAutocompletePosition(textarea, triggerStart),
        });
        setHighlightedIndex(0);
        return;
      }

      const outputDotMatch = textBefore.match(/output\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
      if (outputDotMatch || textBefore.endsWith('output.')) {
        const triggerStart = outputDotMatch ? pos - outputDotMatch[1].length : pos;
        const query = outputDotMatch ? outputDotMatch[1] : '';
        const textarea = e.target;

        setAutocompleteState({
          active: true,
          mode: 'context',
          query,
          triggerStart,
          position: computeAutocompletePosition(textarea, triggerStart),
        });
        setHighlightedIndex(0);
        return;
      }

      const lastWordMatch = textBefore.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
      if (lastWordMatch && !textBefore.slice(0, pos - lastWordMatch[0].length).endsWith('.')) {
        const triggerStart = pos - lastWordMatch[0].length;
        const query = lastWordMatch[0];
        const textarea = e.target;

        setAutocompleteState({
          active: true,
          mode: 'function',
          query,
          triggerStart,
          position: computeAutocompletePosition(textarea, triggerStart),
        });
        setHighlightedIndex(0);
        return;
      }

      if (autocompleteState.active) closeAutocomplete();
    },
    [props, autocompleteState.active, closeAutocomplete],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!autocompleteState.active) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, autocompleteItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const item = autocompleteItems[highlightedIndex];
        if (item) selectItem(item);
      } else if (e.key === 'Escape') {
        closeAutocomplete();
      }
    },
    [autocompleteState.active, autocompleteItems, highlightedIndex, selectItem, closeAutocomplete],
  );

  const openFunctionRef = useCallback(() => {
    openTab('function-reference');
  }, [openTab]);

  return {
    isValid: validationResult.isValid,
    validationMessage: validationResult.message ?? null,
    autocompleteState,
    highlightedIndex,
    autocompleteItems,
    handleChange,
    handleKeyDown,
    selectItem,
    onAutocompleteHover,
    closeAutocomplete,
    openFunctionRef,
  };
};
