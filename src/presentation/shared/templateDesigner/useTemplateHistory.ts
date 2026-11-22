import { useCallback, useMemo, useState } from 'react';

export interface TemplateHistory {
  /** Aplica um texto novo guardando o atual para desfazer. */
  record: (next: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

interface HistoryState {
  past: string[];
  future: string[];
  /** O texto que o histórico deixou no ar — o que ele espera encontrar na próxima leitura. */
  last: string;
}

/** Passos guardados. É um cartão, não um documento: cinquenta voltas cobrem uma sessão de desenho. */
const HISTORY_LIMIT = 50;

/**
 * Desfazer e refazer do designer visual, sobre o TEXTO do template — a mesma fonte que o modo JSON
 * edita e que é gravada. Só registra o que passa por `record` (as edições visuais e o "começar do
 * padrão"): uma tecla no editor JSON não é um passo, e o editor de código já tem o próprio desfazer.
 *
 * Quando o texto muda por fora (alguém digitou no JSON), o histórico deixa de valer — voltar a um
 * passo anterior desfaria, em silêncio, o que foi digitado. Isso é DERIVADO na leitura, sem efeito.
 */
export const useTemplateHistory = (source: string, apply: (source: string) => void): TemplateHistory => {
  const [state, setState] = useState<HistoryState>({ past: [], future: [], last: source });
  const current = useMemo<HistoryState>(
    () => (state.last === source ? state : { past: [], future: [], last: source }),
    [state, source],
  );

  const record = useCallback((next: string) => {
    if (next === current.last) return;
    setState({ past: [...current.past, current.last].slice(-HISTORY_LIMIT), future: [], last: next });
    apply(next);
  }, [current, apply]);

  const undo = useCallback(() => {
    const previous = current.past[current.past.length - 1];
    if (previous === undefined) return;
    setState({ past: current.past.slice(0, -1), future: [current.last, ...current.future], last: previous });
    apply(previous);
  }, [current, apply]);

  const redo = useCallback(() => {
    const [next, ...rest] = current.future;
    if (next === undefined) return;
    setState({ past: [...current.past, current.last], future: rest, last: next });
    apply(next);
  }, [current, apply]);

  return { record, undo, redo, canUndo: current.past.length > 0, canRedo: current.future.length > 0 };
};
