import { useState, useCallback, useRef, useMemo } from 'react';
import type { News, Case, Person, Contract } from '../../../../domain/entities';
import { MENTION_COMMANDS } from '../MentionMenu/MentionMenu.viewmodel';

export type EditorMode = 'edit' | 'split' | 'preview';

export const HIGHLIGHT_COLORS = [
  { value: '#fef3c7', label: 'Amarelo' },
  { value: '#fecaca', label: 'Vermelho' },
  { value: '#ddd6fe', label: 'Roxo' },
  { value: '#bfdbfe', label: 'Azul' },
  { value: '#bbf7d0', label: 'Verde' },
  { value: '#fed7aa', label: 'Laranja' },
] as const;

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export interface MentionState {
  active: boolean;
  query: string;
  triggerStart: number;
  position: { top: number; left: number } | null;
}

export interface MarkdownEditorViewModel {
  mode: EditorMode;
  splitRatio: number;
  setMode: (mode: EditorMode) => void;
  insertFormat: (prefix: string, suffix?: string) => void;
  insertLinePrefix: (prefix: string) => void;
  applyHighlight: (color: string) => void;
  handleResizerMouseDown: (e: React.MouseEvent) => void;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleTextareaKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  mentionState: MentionState;
  mentionHighlightedIndex: number;
  filteredMentionCommands: typeof MENTION_COMMANDS;
  closeMention: () => void;
  selectMentionCommand: (key: string) => void;
  onMentionHover: (index: number) => void;
  newsPickerOpen: boolean;
  closeNewsPicker: () => void;
  insertNewsLink: (n: News) => void;
  casePickerOpen: boolean;
  closeCasePicker: () => void;
  insertCaseLink: (c: Case) => void;
  personPickerOpen: boolean;
  closePersonPicker: () => void;
  insertPersonLink: (c: Person) => void;
  contractPickerOpen: boolean;
  closeContractPicker: () => void;
  insertContractLink: (c: Contract) => void;
}

const computeMentionPosition = (
  textarea: HTMLTextAreaElement,
  triggerStart: number,
): { top: number; left: number } => {
  const rect = textarea.getBoundingClientRect();
  const styles = window.getComputedStyle(textarea);
  const lineHeight = parseFloat(styles.lineHeight) || 22;
  const paddingTop = parseFloat(styles.paddingTop) || 14;

  const textBefore = textarea.value.slice(0, triggerStart);
  const linesBefore = (textBefore.match(/\n/g) ?? []).length;
  const estimatedTop =
    rect.top + paddingTop + (linesBefore + 1) * lineHeight - textarea.scrollTop;

  const menuHeight = 160;
  const top =
    estimatedTop + menuHeight > window.innerHeight
      ? estimatedTop - lineHeight - menuHeight - 4
      : estimatedTop + 4;

  return { top, left: rect.left + 14 };
};

export const useMarkdownEditorViewModel = (
  props: MarkdownEditorProps,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
  contentAreaRef: React.RefObject<HTMLDivElement | null>,
): MarkdownEditorViewModel => {
  const [mode, setMode] = useState<EditorMode>(() =>
    props.readOnly ? 'preview' : 'edit',
  );
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [mentionState, setMentionState] = useState<MentionState>({
    active: false,
    query: '',
    triggerStart: -1,
    position: null,
  });
  const [mentionHighlightedIndex, setMentionHighlightedIndex] = useState(0);
  const [newsPickerOpen, setNewsPickerOpen] = useState(false);
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [personPickerOpen, setPersonPickerOpen] = useState(false);
  const [contractPickerOpen, setContractPickerOpen] = useState(false);

  const mentionRangeRef = useRef<{ start: number; end: number }>({ start: -1, end: -1 });

  const filteredMentionCommands = useMemo(() => {
    const q = mentionState.query.toLowerCase();
    if (!q) return MENTION_COMMANDS;
    return MENTION_COMMANDS.filter((c) => c.label.toLowerCase().startsWith(q));
  }, [mentionState.query]);

  const closeMention = useCallback(() => {
    setMentionState({ active: false, query: '', triggerStart: -1, position: null });
    setMentionHighlightedIndex(0);
  }, []);

  const selectMentionCommand = useCallback(
    (key: string) => {
      const end = mentionState.triggerStart + mentionState.query.length + 1;
      mentionRangeRef.current = { start: mentionState.triggerStart, end };
      closeMention();
      if (key === 'news') setNewsPickerOpen(true);
      if (key === 'case') setCasePickerOpen(true);
      if (key === 'person') setPersonPickerOpen(true);
      if (key === 'contract') setContractPickerOpen(true);
    },
    [mentionState, closeMention],
  );

  const onMentionHover = useCallback((index: number) => {
    setMentionHighlightedIndex(index);
  }, []);

  const insertLink = useCallback(
    (text: string, href: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const { start, end } = mentionRangeRef.current;
      const safeStart = start >= 0 ? start : textarea.selectionStart;
      const safeEnd   = end   >= 0 ? end   : textarea.selectionEnd;
      const link = `[${text}](${href})`;
      const before = props.value.slice(0, safeStart);
      const after  = props.value.slice(safeEnd);
      props.onChange(`${before}${link}${after}`);
      mentionRangeRef.current = { start: -1, end: -1 };
      setTimeout(() => {
        textarea.focus();
        const pos = safeStart + link.length;
        textarea.setSelectionRange(pos, pos);
      }, 0);
    },
    [props, textareaRef],
  );

  const insertNewsLink = useCallback(
    (n: News) => {
      insertLink(n.title, `/curatino/view-news:${n.id}`);
      setNewsPickerOpen(false);
    },
    [insertLink],
  );

  const insertCaseLink = useCallback(
    (c: Case) => {
      insertLink(c.title, `/curatino/view-case:${c.id}`);
      setCasePickerOpen(false);
    },
    [insertLink],
  );

  const closeNewsPicker = useCallback(() => setNewsPickerOpen(false), []);
  const closeCasePicker = useCallback(() => setCasePickerOpen(false), []);
  const closePersonPicker = useCallback(() => setPersonPickerOpen(false), []);
  const closeContractPicker = useCallback(() => setContractPickerOpen(false), []);

  const insertPersonLink = useCallback(
    (c: Person) => {
      insertLink(c.name, `/curatino/view-person:${c.id}`);
      setPersonPickerOpen(false);
    },
    [insertLink],
  );

  const insertContractLink = useCallback(
    (c: Contract) => {
      insertLink(c.title, `/curatino/view-contract:${c.id}`);
      setContractPickerOpen(false);
    },
    [insertLink],
  );

  const insertFormat = useCallback(
    (prefix: string, suffix: string = prefix) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start    = textarea.selectionStart;
      const end      = textarea.selectionEnd;
      const selected = props.value.slice(start, end);
      const before   = props.value.slice(0, start);
      const after    = props.value.slice(end);
      props.onChange(`${before}${prefix}${selected}${suffix}${after}`);
      setTimeout(() => {
        textarea.focus();
        if (selected) {
          textarea.setSelectionRange(start + prefix.length, end + prefix.length);
        } else {
          textarea.setSelectionRange(start + prefix.length, start + prefix.length);
        }
      }, 0);
    },
    [props, textareaRef],
  );

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start     = textarea.selectionStart;
      const lineStart = props.value.lastIndexOf('\n', start - 1) + 1;
      const before    = props.value.slice(0, lineStart);
      const rest      = props.value.slice(lineStart);
      props.onChange(`${before}${prefix}${rest}`);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + prefix.length, start + prefix.length);
      }, 0);
    },
    [props, textareaRef],
  );

  const applyHighlight = useCallback(
    (color: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const start    = textarea.selectionStart;
      const end      = textarea.selectionEnd;
      const selected = props.value.slice(start, end) || 'texto';
      const before   = props.value.slice(0, start);
      const after    = props.value.slice(end);
      props.onChange(`${before}<mark style="background:${color}">${selected}</mark>${after}`);
      setTimeout(() => textarea.focus(), 0);
    },
    [props, textareaRef],
  );

  const handleResizerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = contentAreaRef.current;
      if (!container) return;

      const onMouseMove = (ev: MouseEvent) => {
        const rect  = container.getBoundingClientRect();
        const pos   = ev.clientX - rect.left;
        const ratio = Math.max(0.2, Math.min(0.8, pos / rect.width));
        setSplitRatio(ratio);
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [contentAreaRef],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      props.onChange(value);

      const pos = e.target.selectionStart;
      const textBefore = value.slice(0, pos);
      const lastAt = textBefore.lastIndexOf('@');

      if (lastAt >= 0) {
        const afterAt = textBefore.slice(lastAt + 1);
        if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
          const textarea = e.target;
          setMentionState({
            active: true,
            query: afterAt,
            triggerStart: lastAt,
            position: computeMentionPosition(textarea, lastAt),
          });
          return;
        }
      }

      if (mentionState.active) closeMention();
    },
    [props, mentionState.active, closeMention],
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!mentionState.active) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionHighlightedIndex((i) => Math.min(i + 1, filteredMentionCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const cmd = filteredMentionCommands[mentionHighlightedIndex];
        if (cmd) selectMentionCommand(cmd.key);
      } else if (e.key === 'Escape') {
        closeMention();
      }
    },
    [mentionState.active, filteredMentionCommands, mentionHighlightedIndex, selectMentionCommand, closeMention],
  );

  return {
    mode,
    splitRatio,
    setMode,
    insertFormat,
    insertLinePrefix,
    applyHighlight,
    handleResizerMouseDown,
    handleTextareaChange,
    handleTextareaKeyDown,
    mentionState,
    mentionHighlightedIndex,
    filteredMentionCommands,
    closeMention,
    selectMentionCommand,
    onMentionHover,
    newsPickerOpen,
    closeNewsPicker,
    insertNewsLink,
    casePickerOpen,
    closeCasePicker,
    insertCaseLink,
    personPickerOpen,
    closePersonPicker,
    insertPersonLink,
    contractPickerOpen,
    closeContractPicker,
    insertContractLink,
  };
};
