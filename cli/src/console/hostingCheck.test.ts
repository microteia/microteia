import { describe, expect, it } from 'vitest';
import { bundleReferenceIn, htmlIsRevalidated } from './hostingCheck.js';
import { failureReason } from './deployFunctions.js';

/**
 * As duas verificações desta suíte nasceram da MESMA instalação real: o rodapé mostrava uma versão
 * antiga depois de um deploy bem-sucedido, e uma function falhou sem dizer por quê.
 */
describe('o que o navegador realmente recebe', () => {
  it('acha o bundle referenciado no index.html', () => {
    const html = '<!doctype html><head><script type="module" crossorigin src="/assets/index-EUN-Jqje.js">'
      + '</script><link rel="stylesheet" href="/assets/index-ABC123.css"></head>';
    expect(bundleReferenceIn(html)).toBe('assets/index-EUN-Jqje.js');
  });

  it('devolve nulo quando o HTML não tem bundle — melhor "não sei" que um falso positivo', () => {
    expect(bundleReferenceIn('<html><body>nada</body></html>')).toBeNull();
  });

  /**
   * `max-age=3600` é o padrão do Firebase quando a configuração não diz nada sobre o HTML, e é
   * exatamente o valor que fez um deploy levar uma hora para aparecer.
   */
  it('reconhece que só revalidação serve para o HTML de um SPA', () => {
    expect(htmlIsRevalidated('no-cache, no-store, must-revalidate')).toBe(true);
    expect(htmlIsRevalidated('no-cache')).toBe(true);
    expect(htmlIsRevalidated('public, max-age=0')).toBe(true);
    expect(htmlIsRevalidated('max-age=3600')).toBe(false);
    expect(htmlIsRevalidated('public, max-age=31536000, immutable')).toBe(false);
    expect(htmlIsRevalidated(null)).toBe(false);
  });
});

describe('o motivo de uma function ter falhado', () => {
  it('prefere a linha de erro ao ruído em volta', () => {
    const output = [
      '=== Deploying to \'acme-microteia\'...',
      'i  deploying functions',
      'i  functions: preparing codebase default for deployment',
      '⚠  functions: failed to create function auditNestedEntityChange',
      'Error: Request to https://cloudfunctions.googleapis.com/... had HTTP Error: 400, Invalid trigger',
      '',
    ].join('\n');
    expect(failureReason(output)).toContain('HTTP Error: 400');
  });

  it('cai para a última linha quando nada parece erro — nunca devolve vazio', () => {
    expect(failureReason('primeira\nsegunda\n')).toBe('segunda');
    expect(failureReason('')).toBe('no output from firebase');
    expect(failureReason('   \n  \n')).toBe('no output from firebase');
  });

  it('trunca em vez de despejar a saída inteira numa linha', () => {
    expect(failureReason(`Error: ${'x'.repeat(500)}`)).toHaveLength(240);
  });
});
