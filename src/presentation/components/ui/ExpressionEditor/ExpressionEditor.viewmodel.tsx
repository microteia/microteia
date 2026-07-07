import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useExpressionFunctions } from '../../../../stores/useExpressionFunctions';

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
  mode: 'function' | 'field';
  query: string;
  triggerStart: number;
  position: { top: number; left: number } | null;
}

interface ValidationResult {
  isValid: boolean | null;
  message?: string;
}

export interface AutocompleteItem {
  value: string;
  label: string;
  description?: string;
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

const validateExpression = (
  expression: string,
  eventFields: EventField[],
  functionNames: string[],
): ValidationResult => {
  if (!expression.trim()) {
    return { isValid: true };
  }

  try {
    const validFunctionNames = functionNames;
    const validFieldPaths = eventFields.map((f) => f.path);

    let inString = false;
    let stringChar: '"' | "'" | null = null;
    let escaped = false;

    for (let i = 0; i < expression.length; i += 1) {
      const char = expression[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
        continue;
      }

      if (char === stringChar && inString) {
        inString = false;
        stringChar = null;
      }
    }

    if (inString) {
      return { isValid: false, message: 'String não fechada' };
    }

    const functionPattern = /([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
    const matches = [...expression.matchAll(functionPattern)];

    for (const match of matches) {
      const fnName = match[1];
      if (!validFunctionNames.includes(fnName)) {
        return {
          isValid: false,
          message: `Função desconhecida: "${fnName}"`,
        };
      }
    }

    const eventPattern = /event\.([a-zA-Z_][a-zA-Z0-9_.]*)/g;
    const eventMatches = [...expression.matchAll(eventPattern)];

    for (const match of eventMatches) {
      const fieldPath = match[1];
      if (!validFieldPaths.includes(fieldPath)) {
        return {
          isValid: false,
          message: `Campo do evento desconhecido: "event.${fieldPath}"`,
        };
      }
    }

    let parenCount = 0;
    for (const char of expression) {
      if (char === '(') parenCount += 1;
      if (char === ')') parenCount -= 1;
      if (parenCount < 0) {
        return { isValid: false, message: 'Parênteses não balanceados' };
      }
    }
    if (parenCount !== 0) {
      return { isValid: false, message: 'Parênteses não balanceados' };
    }

    return { isValid: true, message: 'Expressão válida' };
  } catch {
    return { isValid: false, message: 'Erro ao validar expressão' };
  }
};

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

  const menuHeight = 200;
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
      const result = validateExpression(props.value, props.eventFields ?? [], functionNames);
      setValidationResult(result);
    }, 300);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [props.value, props.eventFields, functionNames]);

  const autocompleteItems = useMemo((): AutocompleteItem[] => {
    if (autocompleteState.mode === 'function') {
      const q = autocompleteState.query.toLowerCase();
      const filtered = functions.filter((f) => f.name.toLowerCase().startsWith(q));
      return filtered.map((f) => ({
        value: f.name,
        label: `${f.name}()`,
        description: f.description,
      }));
    } else {
      const q = autocompleteState.query.toLowerCase();
      const filtered = (props.eventFields ?? []).filter((f) => f.path.toLowerCase().startsWith(q));
      return filtered.map((f) => ({
        value: f.path,
        label: f.path,
        description: f.label,
      }));
    }
  }, [autocompleteState.mode, autocompleteState.query, props.eventFields, functions]);

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

      let insertion: string;
      if (autocompleteState.mode === 'function') {
        insertion = `${item.value}()`;
      } else {
        insertion = item.value;
      }

      const newValue = `${before}${insertion}${after}`;
      props.onChange(newValue);
      closeAutocomplete();

      setTimeout(() => {
        textarea.focus();
        const cursorPos =
          autocompleteState.mode === 'function'
            ? before.length + item.value.length + 1
            : before.length + item.value.length;
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
