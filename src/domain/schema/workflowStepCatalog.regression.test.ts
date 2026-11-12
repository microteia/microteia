import { describe, expect, it } from 'vitest';
import { CORE_STEP_CATALOG } from './workflowStepCatalog';

/**
 * A IMPRESSÃO de cada passo que existia ANTES do passo HTTP, tirada da `main` antes de o catálogo
 * receber qualquer passo novo. É o que prova que acrescentar um passo não mexeu na declaração de
 * nenhum outro: um fluxo salvo é lido contra esta metadata, e mudá-la em silêncio muda o que ele faz.
 *
 * Mesma mecânica de `VERSAO_CONFERIDA`: mudar um destes passos não é proibido, é obrigado a passar por
 * aqui — a impressão nova vai junto no mesmo commit, e é onde a decisão fica registrada. Um passo NOVO
 * entra na tabela já com a impressão dele.
 */
const CONFERIDOS: Record<string, string> = {
  notify: '07000d18c3e562',
  'register-audit': '1819cccd3eea17',
  'set-variable': '058cec28c2495f',
  map: '10c3bf56229ff1',
  'validate-object': '03f7a091c0c598',
  exit: '02dbca36aef9e6',
  delay: '1a4cef55c0a350',
  'call-workflow': '0b88286ce67838',
  script: '04a7ac3c09bcb2',
  'ai-detect-workflow': '1d8f59ebef72ef',
  // 9.238.0: os campos declarados no passo (`fields`), com lista fechada para classificar, e a saída `matched`.
  'ai-extract-parameters': '1cc561f5f54142',
  query: '14b4bb8a823b1c',
  upsert: '0ff6ee551a0e58',
  remove: '18ad0b28013cf8',
  'render-document': '1dfdbecf95b206',
  'share-documents': '0d830d57f12e9a',
  'portal-invite': '011a390e0bf30b',
  'portal-revoke': '0e8105faa3e399',
  // 9.217.0: o modo assíncrono acrescentou o callback (`targetWorkflowId` + `param.<chave>`) e a saída `dispatchId`.
  'http-request': '1b0d018be3252c',
  // 9.227.0: a tarefa humana — o passo que para a execução até uma pessoa decidir.
  approval: '0096488f2a08d9',
  // 9.228.0: o relatório como passo. 9.239.0: o arquivo em Downloads (`file`) e a tabela legível (`table`).
  'run-report': '1488298e85b10e',
  // 9.230.0: esperar o próximo evento de um registro, com condição e prazo.
  'wait-for': '197d258050dfe2',
  // 9.234.0: escrever um texto com a IA do escritório.
  'ai-generate': '14ad08654df165',
};

/**
 * cyrb53, e não `node:crypto`: os testes de `src/` são checados pelo `tsconfig.app.json`, que não tem
 * os tipos do Node. Aqui não há adversário — só o descuido de mudar a metadata sem ver.
 */
const impressao = (step: unknown): string => {
  const text = JSON.stringify(step);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
};

describe('catálogo de passos — não regressão', () => {
  it('todo passo do catálogo está conferido, e nenhum sumiu', () => {
    expect(CORE_STEP_CATALOG.map((step) => step.id).sort()).toEqual(Object.keys(CONFERIDOS).sort());
  });

  it.each(CORE_STEP_CATALOG.map((step) => [step.id, step] as const))(
    '%s continua declarado exatamente como foi conferido',
    (id, step) => {
      expect(impressao(step), `a metadata de "${id}" mudou — se foi de propósito, registre a impressão nova`)
        .toBe(CONFERIDOS[id]);
    },
  );
});
