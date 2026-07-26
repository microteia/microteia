import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTheme } from 'styled-components';
import type * as Monaco from 'monaco-editor';
import type { OnChange, OnMount } from '@monaco-editor/react';
import type { Theme } from '../../../../shared/styles/theme';

const AUTO_FORMAT_KEY = 'microteia:scriptEditorAutoFormat';
const THEME_NAME = 'microteia-script';

const hexWithAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
};

const isDarkColor = (hex: string): boolean => {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

const buildMonacoTheme = (theme: Theme): Monaco.editor.IStandaloneThemeData => ({
  base: isDarkColor(theme.colors.background) ? 'vs-dark' : 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': theme.colors.inputBackground,
    'editor.foreground': theme.colors.text,
    'editorLineNumber.foreground': theme.colors.textMuted,
    'editorLineNumber.activeForeground': theme.colors.textSecondary,
    'editor.lineHighlightBackground': theme.colors.surfaceHover,
    'editor.selectionBackground': hexWithAlpha(theme.colors.primary, 0.35),
    'editor.inactiveSelectionBackground': hexWithAlpha(theme.colors.primary, 0.2),
    'editor.selectionHighlightBackground': hexWithAlpha(theme.colors.primary, 0.18),
    'editorCursor.foreground': theme.colors.primary,
    'editorIndentGuide.background': theme.colors.border,
    'editorWidget.background': theme.colors.surface,
    'editorWidget.border': theme.colors.border,
    'editorSuggestWidget.background': theme.colors.surface,
    'editorSuggestWidget.border': theme.colors.border,
    'editorSuggestWidget.selectedBackground': theme.colors.surfaceHover,
    'editorHoverWidget.background': theme.colors.surface,
    'editorHoverWidget.border': theme.colors.border,
    'input.background': theme.colors.inputBackground,
    'input.border': theme.colors.border,
  },
});

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  extraLib?: string;
  minHeight?: string;
  language?: 'typescript' | 'json';
}

export interface CodeEditorViewModel {
  value: string;
  modelPath: string;
  language: 'typescript' | 'json';
  autoFormat: boolean;
  toggleAutoFormat: () => void;
  handleFormat: () => void;
  handleMount: OnMount;
  handleChange: OnChange;
  editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions;
  minHeight: string;
}

export const useCodeEditorViewModel = (props: CodeEditorProps): CodeEditorViewModel => {
  const { value, onChange, extraLib, minHeight = '420px', language = 'typescript' } = props;
  const theme = useTheme();

  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const modelPath =
    language === 'json'
      ? `file:///microteia-params-${instanceId}.json`
      : `file:///microteia-script-${instanceId}.tsx`;  // .tsx para reconhecer JSX!

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const extraLibRef = useRef<Monaco.IDisposable | null>(null);

  const [autoFormat, setAutoFormat] = useState<boolean>(
    () => localStorage.getItem(AUTO_FORMAT_KEY) !== 'false',
  );

  useEffect(() => {
    localStorage.setItem(AUTO_FORMAT_KEY, autoFormat ? 'true' : 'false');
  }, [autoFormat]);

  const applyExtraLib = useCallback((monaco: typeof Monaco, lib: string | undefined) => {
    extraLibRef.current?.dispose();
    extraLibRef.current = lib
      ? monaco.typescript.typescriptDefaults.addExtraLib(lib, 'file:///node_modules/@types/microteia-extension-api/index.d.ts')
      : null;
  }, []);

  const handleMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      applyExtraLib(monaco, extraLib);
      monaco.editor.defineTheme(THEME_NAME, buildMonacoTheme(theme));
      monaco.editor.setTheme(THEME_NAME);
    },
    [applyExtraLib, extraLib, theme],
  );

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    monaco.editor.defineTheme(THEME_NAME, buildMonacoTheme(theme));
    monaco.editor.setTheme(THEME_NAME);
  }, [theme]);

  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco) return;
    applyExtraLib(monaco, extraLib);
  }, [applyExtraLib, extraLib]);

  useEffect(() => () => extraLibRef.current?.dispose(), []);

  const handleChange = useCallback<OnChange>(
    (nextValue) => onChange(nextValue ?? ''),
    [onChange],
  );

  const toggleAutoFormat = useCallback(() => setAutoFormat((prev) => !prev), []);

  const handleFormat = useCallback(() => {
    void editorRef.current?.getAction('editor.action.formatDocument')?.run();
  }, []);

  const editorOptions = useMemo<Monaco.editor.IStandaloneEditorConstructionOptions>(
    () => ({
      fontFamily: theme.fonts.mono,
      fontSize: 13,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      formatOnType: autoFormat,
      formatOnPaste: autoFormat,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderLineHighlight: 'line',
      padding: { top: 12, bottom: 12 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
      fixedOverflowWidgets: true,
    }),
    [theme.fonts.mono, autoFormat],
  );

  return {
    value,
    modelPath,
    language,
    autoFormat,
    toggleAutoFormat,
    handleFormat,
    handleMount,
    handleChange,
    editorOptions,
    minHeight,
  };
};
