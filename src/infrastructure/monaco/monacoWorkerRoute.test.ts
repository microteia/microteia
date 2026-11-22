import jsonWorkerManager from 'monaco-editor/esm/vs/language/json/workerManager.js?raw';
import { describe, expect, it } from 'vitest';
import { CODE_EDITOR_LANGUAGES, monacoWorkerKind } from './monacoWorkerRoute';

describe('monacoWorkerRoute', () => {
  it('manda cada linguagem do editor para um worker que tem o serviço dela', () => {
    for (const language of CODE_EDITOR_LANGUAGES) expect(monacoWorkerKind(language), language).not.toBe('editor');
  });

  it('manda o JSON para o worker de JSON e o JavaScript para o do TypeScript', () => {
    expect(monacoWorkerKind('json')).toBe('json');
    expect(monacoWorkerKind('typescript')).toBe('typescript');
    expect(monacoWorkerKind('javascript')).toBe('typescript');
  });

  it('deixa no worker genérico o que não é serviço de linguagem', () => {
    expect(monacoWorkerKind('editorWorkerService')).toBe('editor');
  });

  it('acompanha o rótulo com que o Monaco instalado cria o worker de JSON', () => {
    expect(jsonWorkerManager).toContain('label: this._defaults.languageId');
  });
});
