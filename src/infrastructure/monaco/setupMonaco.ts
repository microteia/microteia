import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

let configured = false;

export const setupMonaco = (): void => {
  if (configured) return;
  configured = true;

  (self as unknown as { MonacoEnvironment: monaco.Environment }).MonacoEnvironment = {
    getWorker: (_workerId: string, label: string) =>
      label === 'typescript' || label === 'javascript' ? new tsWorker() : new editorWorker(),
  };

  loader.config({ monaco });

  // Configuração global do compilador TypeScript para suportar JSX
  const ts = monaco.typescript.typescriptDefaults;
  ts.setCompilerOptions({
    target: monaco.typescript.ScriptTarget.ES2020,
    allowNonTsExtensions: true,
    noEmit: true,
    jsx: monaco.typescript.JsxEmit.React,  // Modo clássico React (não ReactJSX)
    reactNamespace: 'React',
    moduleResolution: monaco.typescript.ModuleResolutionKind.NodeJs,
    module: monaco.typescript.ModuleKind.ESNext,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true,
    strict: false,
    noImplicitAny: false,
  });
  ts.setEagerModelSync(true);
  
  // Diagnostics options para reduzir ruído de erros
  ts.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    noSuggestionDiagnostics: true,
  });
};

setupMonaco();
