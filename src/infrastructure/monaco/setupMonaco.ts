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
};

setupMonaco();
