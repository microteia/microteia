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

export interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export interface AutocompleteState {
  active: boolean;
  query: string;
  triggerStart: number;
  position: { top: number; left: number } | null;
}

interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export interface ExpressionEditorViewModel {
  isValid: boolean | null;
  validationMessage: string | null;
  autocompleteState: AutocompleteState;
  highlightedIndex: number;
  filteredFunctions: ExpressionFunction[];
  functionRefOpen: boolean;
  handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  selectFunction: (fn: ExpressionFunction) => void;
  onAutocompleteHover: (index: number) => void;
  closeAutocomplete: () => void;
  openFunctionRef: () => void;
  closeFunctionRef: () => void;
}

const validateExpression = (expression: string): ValidationResult => {
  if (!expression.trim()) {
    return { isValid: true };
  }

  try {
    const validFunctionNames = EXPRESSION_FUNCTIONS.map((f) => f.name);
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
      const result = validateExpression(props.value);
      setValidationResult(result);
    }, 300);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [props.value]);

  const filteredFunctions = useMemo(() => {
    const q = autocompleteState.query.toLowerCase();
    if (!q) return EXPRESSION_FUNCTIONS;
    return EXPRESSION_FUNCTIONS.filter((f) => f.name.toLowerCase().startsWith(q));
  }, [autocompleteState.query]);

  const closeAutocomplete = useCallback(() => {
    setAutocompleteState({ active: false, query: '', triggerStart: -1, position: null });
    setHighlightedIndex(0);
  }, []);

  const selectFunction = useCallback(
    (fn: ExpressionFunction) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const before = props.value.slice(0, autocompleteState.triggerStart);
      const after = props.value.slice(textarea.selectionStart);
      const insertion = `${fn.name}()`;
      const newValue = `${before}${insertion}${after}`;

      props.onChange(newValue);
      closeAutocomplete();

      setTimeout(() => {
        textarea.focus();
        const cursorPos = before.length + fn.name.length + 1;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [props, textareaRef, autocompleteState.triggerStart, closeAutocomplete],
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

      const lastWordMatch = textBefore.match(/[a-zA-Z_][a-zA-Z0-9_]*$/);
      if (lastWordMatch) {
        const triggerStart = pos - lastWordMatch[0].length;
        const query = lastWordMatch[0];
        const textarea = e.target;

        setAutocompleteState({
          active: true,
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
        setHighlightedIndex((i) => Math.min(i + 1, filteredFunctions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const fn = filteredFunctions[highlightedIndex];
        if (fn) selectFunction(fn);
      } else if (e.key === 'Escape') {
        closeAutocomplete();
      }
    },
    [autocompleteState.active, filteredFunctions, highlightedIndex, selectFunction, closeAutocomplete],
  );

  const openFunctionRef = useCallback(() => setFunctionRefOpen(true), []);
  const closeFunctionRef = useCallback(() => setFunctionRefOpen(false), []);

  return {
    isValid: validationResult.isValid,
    validationMessage: validationResult.message ?? null,
    autocompleteState,
    highlightedIndex,
    filteredFunctions,
    functionRefOpen,
    handleChange,
    handleKeyDown,
    selectFunction,
    onAutocompleteHover,
    closeAutocomplete,
    openFunctionRef,
    closeFunctionRef,
  };
};
