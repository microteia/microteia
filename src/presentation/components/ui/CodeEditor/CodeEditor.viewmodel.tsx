import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'styled-components';
import type * as Monaco from 'monaco-editor';
import type { OnChange, OnMount } from '@monaco-editor/react';
import type { Theme } from '../../../../shared/styles/theme';

const AUTO_FORMAT_KEY = 'curatino:scriptEditorAutoFormat';
const THEME_NAME = 'curatino-script';
const MODEL_PATH = 'file:///curatino-script.ts';

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
    'editor.selectionBackground': theme.colors.surfaceHover,
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

const configureCompiler = (monaco: typeof Monaco): void => {
  const ts = monaco.typescript.typescriptDefaults;
  ts.setCompilerOptions({
    target: monaco.typescript.ScriptTarget.ES2020,
    lib: ['es2021'],
    allowNonTsExtensions: true,
    noEmit: true,
  });
  ts.setEagerModelSync(true);
};

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  extraLib?: string;
  minHeight?: string;
}

export interface CodeEditorViewModel {
  value: string;
  modelPath: string;
  autoFormat: boolean;
  toggleAutoFormat: () => void;
  handleFormat: () => void;
  handleMount: OnMount;
  handleChange: OnChange;
  editorOptions: Monaco.editor.IStandaloneEditorConstructionOptions;
  minHeight: string;
}

export const useCodeEditorViewModel = (props: CodeEditorProps): CodeEditorViewModel => {
  const { value, onChange, extraLib, minHeight = '420px' } = props;
  const theme = useTheme();

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
      ? monaco.typescript.typescriptDefaults.addExtraLib(lib, 'file:///curatino-globals.d.ts')
      : null;
  }, []);

  const handleMount = useCallback<OnMount>(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      configureCompiler(monaco);
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
    modelPath: MODEL_PATH,
    autoFormat,
    toggleAutoFormat,
    handleFormat,
    handleMount,
    handleChange,
    editorOptions,
    minHeight,
  };
};
