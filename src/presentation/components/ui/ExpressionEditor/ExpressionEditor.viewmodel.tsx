import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

export interface ExpressionFunction {
  name: string;
  label: string;
  description: string;
  example: string;
  signature: string;
}

export const EXPRESSION_FUNCTIONS: ExpressionFunction[] = [
  {
    name: 'today',
    label: 'today()',
    description: 'Retorna a data de hoje (início do dia)',
    example: 'today() + 5',
    signature: 'today()',
  },
  {
    name: 'now',
    label: 'now()',
    description: 'Retorna a data e hora atual',
    example: 'now()',
    signature: 'now()',
  },
  {
    name: 'if',
    label: 'if()',
    description: 'Retorna um valor baseado em uma condição',
    example: 'if(5 > 3, "sim", "não")',
    signature: 'if(condição, valorSeVerdadeiro, valorSeFalso)',
  },
  {
    name: 'concat',
    label: 'concat()',
    description: 'Concatena valores em uma string',
    example: 'concat("Processo ", "123")',
    signature: 'concat(valor1, valor2, ...)',
  },
  {
    name: 'lower',
    label: 'lower()',
    description: 'Converte texto para minúsculas',
    example: 'lower("TEXTO")',
    signature: 'lower(texto)',
  },
  {
    name: 'upper',
    label: 'upper()',
    description: 'Converte texto para MAIÚSCULAS',
    example: 'upper("texto")',
    signature: 'upper(texto)',
  },
  {
    name: 'length',
    label: 'length()',
    description: 'Retorna o tamanho de um texto ou array',
    example: 'length("texto")',
    signature: 'length(valor)',
  },
];

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
  isValid: boolean;
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
  functionRefOpen: boolean;
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  selectItem: (item: AutocompleteItem) => void;
  onAutocompleteHover: (index: number) => void;
  closeAutocomplete: () => void;
  openFunctionRef: () => void;
  closeFunctionRef: () => void;
}

const validateExpression = (expression: string, eventFields: EventField[]): ValidationResult => {
  if (!expression.trim()) {
    return { isValid: true };
  }

  try {
    const validFunctionNames = EXPRESSION_FUNCTIONS.map((f) => f.name);
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

    const inputPattern = /input\.([a-zA-Z_][a-zA-Z0-9_]*)/g;
    const inputMatches = [...expression.matchAll(inputPattern)];

    for (const match of inputMatches) {
      const fieldPath = match[1];
      if (!validFieldPaths.includes(fieldPath)) {
        return {
          isValid: false,
          message: `Campo do evento desconhecido: "input.${fieldPath}"`,
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
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: null });
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState>({
    active: false,
    mode: 'function',
    query: '',
    triggerStart: -1,
    position: null,
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [functionRefOpen, setFunctionRefOpen] = useState(false);

  const validationTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }

    validationTimerRef.current = setTimeout(() => {
      const result = validateExpression(props.value, props.eventFields ?? []);
      setValidationResult(result);
    }, 300);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [props.value, props.eventFields]);

  const autocompleteItems = useMemo((): AutocompleteItem[] => {
    if (autocompleteState.mode === 'function') {
      const q = autocompleteState.query.toLowerCase();
      const filtered = EXPRESSION_FUNCTIONS.filter((f) => f.name.toLowerCase().startsWith(q));
      return filtered.map((f) => ({
        value: f.name,
        label: f.label,
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
  }, [autocompleteState.mode, autocompleteState.query, props.eventFields]);

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

      const inputDotMatch = textBefore.match(/input\.([a-zA-Z_][a-zA-Z0-9_]*)$/);
      if (inputDotMatch) {
        const triggerStart = pos - inputDotMatch[1].length;
        const query = inputDotMatch[1];
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

      if (textBefore.endsWith('input.')) {
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

  const openFunctionRef = useCallback(() => setFunctionRefOpen(true), []);
  const closeFunctionRef = useCallback(() => setFunctionRefOpen(false), []);

  return {
    isValid: validationResult.isValid,
    validationMessage: validationResult.message ?? null,
    autocompleteState,
    highlightedIndex,
    autocompleteItems,
    functionRefOpen,
    handleChange,
    handleKeyDown,
    selectItem,
    onAutocompleteHover,
    closeAutocomplete,
    openFunctionRef,
    closeFunctionRef,
  };
};
