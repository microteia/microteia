import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useExpressionFunctions } from '../../../../stores/useExpressionFunctions';
import { useSchemaContext } from '../../../shared/useSchemaContext';
import type { PathRoot } from '../../../../domain/schema/pathResolver';
import { parsePath, suggestNextSegments } from '../../../../domain/schema/pathResolver';
import { validateExpressionWithParser } from './expressionValidator';
import { useT } from '../../../shared/i18n/useT';
import { buildAutocompleteItems, insertSnippet } from './autocompleteHelpers';
import type { AutocompleteItem, ExpressionContextRoot, StepOutputField, WorkflowVariable } from './autocompleteHelpers';
import { buildPathAutocompleteItems, extractActiveEventPath, extractActiveInputPath, findInvalidEventPath } from './pathAutocomplete';

export interface EventField {
  path: string;
  label: string;
}

export interface ExpressionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  eventFields?: EventField[];
  stepOutputFields?: StepOutputField[];
  workflowVariables?: WorkflowVariable[];
  pathRoot?: PathRoot | null;
  inputRoot?: PathRoot | null;
}

export interface AutocompleteState {
  active: boolean;
  mode: 'function' | 'field' | 'input' | 'input-field' | 'output';
  query: string;
  pathBase: string;
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

const AUTOCOMPLETE_ITEM_HEIGHT = 56;
const AUTOCOMPLETE_MAX_MENU_HEIGHT = 300;

const computeAutocompletePosition = (
  textarea: HTMLTextAreaElement,
  triggerStart: number,
  itemCount: number,
): { top: number; left: number } => {
  const rect = textarea.getBoundingClientRect();
  const styles = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(styles.lineHeight) || 22;
  const paddingTop = parseFloat(styles.paddingTop) || 10;

  const textBefore = textarea.value.slice(0, triggerStart);
  const linesBefore = (textBefore.match(/\n/g) ?? []).length;
  const estimatedTop =
    rect.top + paddingTop + (linesBefore + 1) * lineHeight - textarea.scrollTop;

  const menuHeight = Math.min(
    Math.max(itemCount, 1) * AUTOCOMPLETE_ITEM_HEIGHT,
    AUTOCOMPLETE_MAX_MENU_HEIGHT,
  );
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
  const schemaContext = useSchemaContext();
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: null });
  const [autocompleteState, setAutocompleteState] = useState<AutocompleteState>({
    active: false,
    mode: 'function',
    query: '',
    pathBase: '',
    triggerStart: -1,
    position: null,
  });
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const validationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const t = useT('core.ui');

  const pathRoot = props.pathRoot ?? null;
  const inputRoot = props.inputRoot ?? null;

  useEffect(() => {
    if (validationTimerRef.current) {
      clearTimeout(validationTimerRef.current);
    }

    validationTimerRef.current = setTimeout(() => {
      const result = validateExpressionWithParser(t, props.value, functions);
      if (result.isValid && pathRoot) {
        const issue = findInvalidEventPath(schemaContext, pathRoot, props.value);
        if (issue) {
          setValidationResult({ isValid: false, message: t('expression.error.path', { path: issue.path, error: issue.error }) });
          return;
        }
      }
      setValidationResult(result);
    }, 400);

    return () => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }
    };
  }, [props.value, functions, pathRoot, schemaContext, t]);

  // As raízes de contexto saem do que o chamador realmente forneceu: quem edita expressão de campo
  // ou de Action não passa nenhuma delas, e lá o escopo é plano (`isNew`, não `input.isNew`).
  const contextRoots = useMemo<ExpressionContextRoot[]>(() => {
    const roots: ExpressionContextRoot[] = [];
    if (pathRoot || (props.eventFields?.length ?? 0) > 0) roots.push('event');
    if (inputRoot || (props.stepOutputFields?.length ?? 0) > 0) roots.push('input');
    if ((props.stepOutputFields?.length ?? 0) > 0) roots.push('output');
    return roots;
  }, [pathRoot, inputRoot, props.eventFields, props.stepOutputFields]);

  const autocompleteItems = useMemo((): AutocompleteItem[] => {
    if (autocompleteState.mode === 'field' && pathRoot) {
      return buildPathAutocompleteItems(schemaContext, pathRoot, {
        completedPath: autocompleteState.pathBase,
        query: autocompleteState.query,
        queryStart: autocompleteState.triggerStart,
      });
    }
    if (autocompleteState.mode === 'input-field' && inputRoot) {
      return buildPathAutocompleteItems(schemaContext, inputRoot, {
        completedPath: autocompleteState.pathBase,
        query: autocompleteState.query,
        queryStart: autocompleteState.triggerStart,
      });
    }
    return buildAutocompleteItems(
      t,
      autocompleteState.mode === 'input-field' ? 'input' : autocompleteState.mode,
      autocompleteState.query,
      functions,
      props.eventFields ?? [],
      props.stepOutputFields ?? [],
      props.workflowVariables ?? [],
      true,
      contextRoots,
    );
  }, [
    contextRoots,
    autocompleteState.mode,
    autocompleteState.query,
    autocompleteState.pathBase,
    autocompleteState.triggerStart,
    pathRoot,
    inputRoot,
    schemaContext,
    props.eventFields,
    props.stepOutputFields,
    props.workflowVariables,
    functions,
    t,
  ]);

  // Calcula posição do autocomplete quando ativa ou muda de contexto
  useEffect(() => {
    if (!autocompleteState.active) return;
    
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Usa requestAnimationFrame para não bloquear a thread principal
    requestAnimationFrame(() => {
      setAutocompleteState((prev) => {
        // Só calcula e atualiza se ainda está ativo e position é null
        if (!prev.active || prev.position !== null) return prev;
        
        const position = computeAutocompletePosition(
          textarea,
          prev.triggerStart,
          autocompleteItems.length,
        );
        
        return { ...prev, position };
      });
    });
  }, [autocompleteState.active, autocompleteState.triggerStart, autocompleteItems.length, textareaRef]);

  const closeAutocomplete = useCallback(() => {
    setAutocompleteState({ active: false, mode: 'function', query: '', pathBase: '', triggerStart: -1, position: null });
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
        const isBareIdentifier = item.category === t('expression.category.variable') || item.category === t('expression.category.field');
        if (
          autocompleteState.mode === 'function' &&
          !isBareIdentifier &&
          !item.value.endsWith(')') &&
          !item.value.endsWith('.')
        ) {
          insertion = `${item.value}()`;
          cursorPos = before.length + item.value.length + 1;
        } else {
          insertion = item.value;
          cursorPos = before.length + item.value.length;
        }
        newValue = `${before}${insertion}${after}`;
      }

      props.onChange(newValue);

      const canReopen = !item.snippet && item.value.endsWith('.');
      // Em `output.` a consulta é sempre o trecho inteiro depois do ponto da raiz (`buscarProcesso.`),
      // então escolher o step reabre o menu no mesmo ponto de disparo, agora listando as saídas dele.
      const reopened = canReopen
        ? autocompleteState.mode === 'output'
          ? {
              path: { completedPath: '', query: item.value, queryStart: autocompleteState.triggerStart },
              mode: 'output' as const,
            }
          : autocompleteState.mode === 'input-field' && inputRoot
            ? { path: extractActiveInputPath(newValue.slice(0, cursorPos)), mode: 'input-field' as const }
            : pathRoot
              ? { path: extractActiveEventPath(newValue.slice(0, cursorPos)), mode: 'field' as const }
              : null
        : null;
      if (reopened && reopened.path) {
        setAutocompleteState({
          active: true,
          mode: reopened.mode,
          query: reopened.path.query,
          pathBase: reopened.path.completedPath,
          triggerStart: reopened.path.queryStart,
          position: null,
        });
        setHighlightedIndex(0);
      } else {
        closeAutocomplete();
      }

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [props, textareaRef, autocompleteState.triggerStart, autocompleteState.mode, pathRoot, inputRoot, closeAutocomplete, t],
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

      if (pathRoot) {
        const activePath = extractActiveEventPath(textBefore);
        if (activePath) {
          setAutocompleteState({
            active: true,
            mode: 'field',
            query: activePath.query,
            pathBase: activePath.completedPath,
            triggerStart: activePath.queryStart,
            position: null,
          });
          setHighlightedIndex(0);
          return;
        }
      } else {
        const eventOldDotMatch = textBefore.match(/event\.old\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
        if (eventOldDotMatch) {
          setAutocompleteState({
            active: true,
            mode: 'field',
            query: eventOldDotMatch[1],
            pathBase: '',
            triggerStart: pos - eventOldDotMatch[1].length,
            position: null,
          });
          setHighlightedIndex(0);
          return;
        }

        if (textBefore.endsWith('event.old.')) {
          setAutocompleteState({
            active: true,
            mode: 'field',
            query: '',
            pathBase: '',
            triggerStart: pos,
            position: null,
          });
          setHighlightedIndex(0);
          return;
        }

        const eventDotMatch = textBefore.match(/event\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
        if (eventDotMatch) {
          setAutocompleteState({
            active: true,
            mode: 'field',
            query: eventDotMatch[1],
            pathBase: '',
            triggerStart: pos - eventDotMatch[1].length,
            position: null,
          });
          setHighlightedIndex(0);
          return;
        }

        if (textBefore.endsWith('event.')) {
          setAutocompleteState({
            active: true,
            mode: 'field',
            query: '',
            pathBase: '',
            triggerStart: pos,
            position: null,
          });
          setHighlightedIndex(0);
          return;
        }
      }

      // Detecta "input.pessoa.<campo>" → expande as propriedades da entidade referenciada,
      // seguindo o mesmo mecanismo de schema usado por "event.". Só entra aqui quando o
      // caminho já percorrido resolve para algo navegável (ex: uma saída EntityReference);
      // caso contrário, cai no modo plano abaixo (que lista as saídas dos steps anteriores).
      if (inputRoot) {
        const nested = extractActiveInputPath(textBefore);
        if (nested && nested.completedPath && suggestNextSegments(schemaContext, inputRoot, parsePath(nested.completedPath)).length > 0) {
          setAutocompleteState({
            active: true,
            mode: 'input-field',
            query: nested.query,
            pathBase: nested.completedPath,
            triggerStart: nested.queryStart,
            position: null,
          });
          setHighlightedIndex(0);
          return;
        }
      }

      // Detecta "input.campo" → outputs de steps anteriores
      const inputDotMatch = textBefore.match(/input\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
      if (contextRoots.includes('input') && (inputDotMatch || textBefore.endsWith('input.'))) {
        const triggerStart = inputDotMatch ? pos - inputDotMatch[1].length : pos;
        const query = inputDotMatch ? inputDotMatch[1] : '';

        setAutocompleteState({
          active: true,
          mode: 'input',
          query,
          pathBase: '',
          triggerStart,
          position: null,
        });
        setHighlightedIndex(0);
        return;
      }

      const outputDotMatch = textBefore.match(/output\.([a-zA-Z_][a-zA-Z0-9_.]*)$/);
      if (contextRoots.includes('output') && (outputDotMatch || textBefore.endsWith('output.'))) {
        const triggerStart = outputDotMatch ? pos - outputDotMatch[1].length : pos;
        const query = outputDotMatch ? outputDotMatch[1] : '';

        setAutocompleteState({
          active: true,
          mode: 'output',
          query,
          pathBase: '',
          triggerStart,
          position: null,
        });
        setHighlightedIndex(0);
        return;
      }

      // Identificador possivelmente pontilhado (`produto`, `produto.`, `produto.pre`): campos de
      // referência são navegáveis nos slots front-only e chegam como variáveis já concatenadas
      // (`produto.preco`), então parar no ponto fecharia o menu logo ao digitá-lo.
      const lastWordMatch = textBefore.match(/[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]*)*$/);
      if (lastWordMatch && !textBefore.slice(0, pos - lastWordMatch[0].length).endsWith('.')) {
        const triggerStart = pos - lastWordMatch[0].length;
        const query = lastWordMatch[0];

        setAutocompleteState({
          active: true,
          mode: 'function',
          query,
          pathBase: '',
          triggerStart,
          position: null,
        });
        setHighlightedIndex(0);
        return;
      }

      if (autocompleteState.active) closeAutocomplete();
    },
    [props, pathRoot, inputRoot, contextRoots, schemaContext, autocompleteState.active, closeAutocomplete],
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
