import { useCallback, useMemo, useState } from 'react';
import type React from 'react';
import { useLabel } from '../../../shared/i18n/useT';
import { useTemplateHistory } from '../../../shared/templateDesigner/useTemplateHistory';
import { isTemplateObject } from '../../../shared/templateDesigner/templateTree';
import type { TemplateNode } from '../../../shared/templateDesigner/templateTree';
import type { TemplateVocabulary } from '../../../shared/templateDesigner/templateVocabulary';
import type { TemplateDesignerField, TemplateDesignerIssue, TemplateDesignerOption } from '../TemplateDesigner';

export interface TemplateSourceEditorProps {
  vocabulary: TemplateVocabulary;
  /** O TEXTO do template — o mesmo que é gravado. Os dois modos editam só ele. */
  source: string;
  onSourceChange: (source: string) => void;
  /** O ponto de partida do "começar do padrão". */
  defaultSource: string;
  /** Já traduzidos: cada superfície diz do que é o padrão e o que se descreve no JSON. */
  resetLabel: string;
  jsonHint: string;
  issues: readonly TemplateDesignerIssue[];
  fields: readonly TemplateDesignerField[];
  actionOptions?: readonly TemplateDesignerOption[];
  /** A pré-visualização sobre um registro de verdade, quando a superfície tem uma. */
  preview?: React.ReactNode;
  /** A declaração é de uma extensão: mostra, mas não edita. */
  readOnly?: boolean;
  jsonMinHeight?: string;
  testId?: string;
}

export type TemplateEditorMode = 'visual' | 'json';

export interface TemplateSourceEditorViewModel {
  mode: TemplateEditorMode;
  setMode: (mode: TemplateEditorMode) => void;
  /** O desenho que o modo visual edita — `null` quando o texto não é um objeto JSON. */
  design: TemplateNode | null;
  /** Por que o modo visual está travado, já como frase. */
  visualLocked: string | null;
  /** Os problemas como frase, para o modo JSON. */
  issueTexts: string[];
  canUndo: boolean;
  canRedo: boolean;
  setDesign: (design: TemplateNode) => void;
  setSource: (source: string) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

type Parsed = { design: TemplateNode; locked: null } | { design: null; locked: { message: string; params: Record<string, string> } };

const parseSource = (source: string): Parsed => {
  if (!source.trim()) return { design: {}, locked: null };
  try {
    const parsed: unknown = JSON.parse(source);
    return isTemplateObject(parsed)
      ? { design: parsed, locked: null }
      : { design: null, locked: { message: '@core.records/template-designer.visual-locked.not-object', params: {} } };
  } catch (caught) {
    return {
      design: null,
      locked: {
        message: '@core.records/template-designer.visual-locked',
        params: { error: caught instanceof Error ? caught.message : String(caught) },
      },
    };
  }
};

/**
 * O par Visual/JSON de um template declarativo, ligado a um TEXTO. Visual é o padrão; o JSON fica para
 * quem escreve extensão ou já domina a DSL. Os dois editam a mesma fonte, e por isso trocar de modo
 * nunca perde nada: o texto que não parseia trava o visual em vez de ser reinterpretado.
 */
export const useTemplateSourceEditorViewModel = ({
  source,
  onSourceChange,
  defaultSource,
  issues,
  readOnly = false,
}: TemplateSourceEditorProps): TemplateSourceEditorViewModel => {
  const label = useLabel();
  const [mode, setMode] = useState<TemplateEditorMode>('visual');

  const apply = useCallback((next: string) => {
    if (!readOnly) onSourceChange(next);
  }, [readOnly, onSourceChange]);
  const history = useTemplateHistory(source, apply);

  const parsed = useMemo(() => parseSource(source), [source]);
  const issueTexts = useMemo(() => issues.map((issue) => label(issue.message, issue.messageParams)), [issues, label]);

  const setDesign = useCallback((design: TemplateNode) => history.record(JSON.stringify(design, null, 2)), [history]);
  const reset = useCallback(() => history.record(defaultSource), [history, defaultSource]);

  return {
    mode,
    setMode,
    design: parsed.design,
    visualLocked: parsed.locked ? label(parsed.locked.message, parsed.locked.params) : null,
    issueTexts,
    canUndo: !readOnly && history.canUndo,
    canRedo: !readOnly && history.canRedo,
    setDesign,
    setSource: apply,
    undo: history.undo,
    redo: history.redo,
    reset,
  };
};
