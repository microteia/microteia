/**
 * As linguagens que o `CodeEditor` oferece e o worker que cada uma exige.
 *
 * O `MonacoEnvironment.getWorker` tem prioridade sobre o `createWorker` da própria linguagem: rótulo
 * que cai no worker genérico fica sem nenhum serviço — sem validação, completar, recolher nem formatar,
 * e com `Missing requestHandler or method` no console. Foi o que o JSON viveu desde que o modo dele
 * entrou (#21). `monacoWorkerRoute.test.ts` reprova linguagem nova aqui sem worker próprio.
 */
export const CODE_EDITOR_LANGUAGES = ['typescript', 'json'] as const;

export type CodeEditorLanguage = (typeof CODE_EDITOR_LANGUAGES)[number];

export type MonacoWorkerKind = 'typescript' | 'json' | 'editor';

/** O rótulo é o `languageId` com que cada serviço do Monaco cria o worker dele. */
export const monacoWorkerKind = (label: string): MonacoWorkerKind => {
  if (label === 'typescript' || label === 'javascript') return 'typescript';
  if (label === 'json') return 'json';
  return 'editor';
};
